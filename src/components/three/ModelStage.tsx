import { useEffect, useRef } from 'react'
import type { MotionValue } from 'framer-motion'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * One step of the move the scroll drives.
 *
 * Written as camera language rather than object language — yaw turns the
 * subject, `elevation` raises the eye, `dolly` scales the fitted distance and
 * `lift` re-aims it — because that is how the move was designed and how it
 * has to be re-tuned later. Storing it as raw `rotation.x/y` on the mesh
 * would encode the *result* of those decisions and lose the reason.
 */
export interface Pose {
  /** Where in the scroll this pose lands, 0 at the top of the run, 1 at the end. */
  at: number
  /** Turn of the subject around its own vertical, radians. Negative shows its left. */
  yaw: number
  /** Height of the eye, radians of orbit. Positive looks down onto the subject. */
  elevation: number
  /** Multiplier on the fitted distance. Under 1 crops in, over 1 pulls back. */
  dolly: number
  /** Re-aim up or down the subject, in units of its own height. */
  lift: number
}

/**
 * One .glb placed on the stage.
 *
 * Everything is expressed in *stage units*, where 1 is the height of the first
 * piece. A .glb arrives at whatever scale it was exported at — these scans are
 * each normalised into a unit box by their generator, so nothing about their
 * raw numbers relates them to each other — and a composition of two of them
 * has to be stated in terms of one of them or it means nothing. Saying the
 * guitar is 0.62 is saying it comes up to just past the singer's waist, which
 * is a fact about the picture and survives either file being re-exported.
 */
export interface Piece {
  /**
   * The .glb, as a site-root path.
   *
   * Not run through `mediaUrl`: the models sit at the root of public/, outside
   * the public/media/ tree that scripts/upload-media.mjs mirrors into R2, so
   * the bucket has no such key.
   */
  src: string
  /** Its height in stage units. Leave at 1 for the piece the stage is sized by. */
  height?: number
  /** Where its anchor sits, in stage units from the turn axis. */
  position?: [number, number, number]
  /**
   * Turn and lean, in radians, about the piece's own centre.
   *
   * About the centre rather than the anchor, which means a leaned piece walks
   * its base sideways by half its height times the sine of the lean. At the
   * few degrees a lean wants that is under a centimetre of stage unit, and
   * there is no floor in the shot for it to be measured against.
   */
  rotation?: [number, number, number]
  /**
   * Which point of the piece `position` places.
   *
   * 'base' is what puts two pieces on the same floor without having to know
   * either one's height: the guitar stands where the singer stands because
   * both their bases are at the same y, not because their centres are.
   */
  anchor?: 'centre' | 'base'
}

export interface Framing {
  /**
   * Half the width the frame must hold, in stage units.
   *
   * Stated as a box to fill rather than as a margin around what is on stage,
   * because what is on stage changes size as it turns — the guitar swings out
   * beside the singer at one end of the move and tucks in behind her at the
   * other — and a fit computed from the bounding box would breathe in and out
   * with it. A fixed box means the camera holds still and the scene moves
   * inside it, which is the whole illusion.
   */
  halfWidth: number
  /** Half the height the frame must hold, same units. Under 0.5 crops. */
  halfHeight: number
  /**
   * Where the camera points, in stage units from the turn axis.
   *
   * Separate from the axis itself, and it has to be. The axis belongs on the
   * singer — she is what the scene turns about — but she is not what the
   * frame is about once there is a guitar standing beside her, and centring
   * the shot on her leaves the composition heavy on one side and empty on the
   * other. So the camera trucks across to sit over the pair. It trucks rather
   * than swivels: pointing a camera off its own axis skews everything in the
   * frame, and a subject leaning out of the picture is a worse fault than an
   * off-centre one.
   */
  aim: { x: number; y: number }
}

interface Props {
  /** What stands on the stage. The first piece defines the unit of every other. */
  pieces: Piece[]
  /** Scroll position through the section, 0 to 1. */
  progress: MotionValue<number>
  /** The move, as poses in ascending `at` order. */
  poses: Pose[]
  framing: Framing
  /** The barely-there float that keeps a still frame from reading as a freeze. */
  idle?: boolean
  onProgress?: (fraction: number) => void
  onReady?: () => void
  onError?: () => void
}

const FOV = 30

/** Smoothstep, so the seam between two poses has no corner in it. */
function ease(t: number) {
  return t * t * (3 - 2 * t)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** The pose at an arbitrary point in the run, interpolated between keyframes. */
function poseAt(poses: Pose[], t: number): Omit<Pose, 'at'> {
  if (t <= poses[0].at) return poses[0]
  const last = poses[poses.length - 1]
  if (t >= last.at) return last

  for (let i = 0; i < poses.length - 1; i++) {
    const a = poses[i]
    const b = poses[i + 1]
    if (t > b.at) continue
    const k = ease((t - a.at) / (b.at - a.at))
    return {
      yaw: lerp(a.yaw, b.yaw, k),
      elevation: lerp(a.elevation, b.elevation, k),
      dolly: lerp(a.dolly, b.dolly, k),
      lift: lerp(a.lift, b.lift, k),
    }
  }
  return last
}

/**
 * A single .glb on a black stage, turned by the page's scroll position.
 *
 * Deliberately imperative and deliberately alone in the tree. Everything here
 * is one-way — the React side hands it a scroll `MotionValue` and never reads
 * anything back — so wrapping it in a renderer reconciler would buy nothing
 * and cost a second scheduler running against the same frames. The component
 * mounts a canvas, owns it until unmount, and re-renders zero times in
 * between: the scroll subscription writes to a ref that the animation loop
 * reads, so a scroll never touches React at all.
 *
 * It is also expensive enough that it must not exist until it is wanted —
 * the singer scan alone is eleven megabytes. Mounting is the caller's
 * decision, and `ModelSection` makes it off an IntersectionObserver.
 */
export default function ModelStage({
  pieces,
  progress,
  poses,
  framing,
  idle = true,
  onProgress,
  onReady,
  onError,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)

  // What the running scene reads without being rebuilt for it.
  //
  // The effect below builds a renderer and downloads eleven megabytes, so its
  // dependencies have to be things that genuinely mean "start over". These are
  // not. The callbacks are new functions on every render because the parent
  // re-renders on load state, and `idle` flips when the reader changes an OS
  // motion setting — neither is a reason to throw away a live context and
  // fetch the model again, so both are read through a ref the loop polls.
  const live = useRef({ onProgress, onReady, onError, idle })
  live.current = { onProgress, onReady, onError, idle }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        // The stage sits over a CSS pool of light, and it has to show through.
        alpha: true,
        powerPreference: 'high-performance',
      })
    } catch {
      live.current.onError?.()
      return
    }

    // Capped at 2: the scan is 285k triangles and the gain from a third
    // sample per axis is not visible on any screen that asks for one.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    // Neutral rather than ACES. ACES is a film look — it warms the highlights
    // and pulls saturation out of everything else, which on a site with no
    // accent colour is a tint applied to the one thing that has real colour
    // in it. Neutral rolls off the highlights and leaves the hue alone.
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = 1.2
    host.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 100)

    /* ---------------- light ----------------
       Five white lights and no environment map. The scans' material declares
       metalness 1 and leans on its metallic-roughness texture to bring that
       back down, so anything the texture leaves metallic has nothing to
       reflect and renders black. Every light here is therefore direct.

       The two rims are doing most of the work, and they are why the ambient
       and the key stay low. The subject is a woman dressed head to foot in
       black leather standing on a black ground: raise the front light until
       the jacket reads and her face and arms blow out long before it does,
       because skin is already three stops up on the clothes. Light from
       behind solves the actual problem — it draws the edge of the coat, the
       chain, the hair and the guitar necks as lines rather than trying to
       fill them, and it leaves the front exposed for the skin. Two of them,
       from opposite quarters, so the edge survives the turn: one rim alone
       goes dark down one side halfway through the move.
    */
    scene.add(new THREE.AmbientLight(0xffffff, 1.3))

    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(2.5, 3.4, 4)
    scene.add(key)

    const fill = new THREE.DirectionalLight(0xffffff, 0.8)
    fill.position.set(-3.5, 0.6, 2)
    scene.add(fill)

    const rimLeft = new THREE.DirectionalLight(0xffffff, 3)
    rimLeft.position.set(-1.6, 2, -3.2)
    scene.add(rimLeft)

    const rimRight = new THREE.DirectionalLight(0xffffff, 2)
    rimRight.position.set(2.4, 1.4, -3)
    scene.add(rimRight)

    /* ---------------- the scene ----------------
       Everything hangs off one pivot, so `yaw` turns the whole composition
       about a single axis. That is what makes two separate scans read as one
       place rather than as two objects being animated near each other: the
       guitar keeps its station beside the singer through the entire move,
       because it is not being moved at all — the room is. */
    const pivot = new THREE.Group()
    scene.add(pivot)

    /** The height every stage unit is measured in, set by the first piece. */
    const UNIT = 1
    let disposed = false

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy()

    function place(gltf: { scene: THREE.Group }, piece: Piece) {
      const model = gltf.scene
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      const centre = box.getCenter(new THREE.Vector3())

      // Normalised on height rather than on the longest side. A scan's
      // longest side may well be a mic boom or a guitar neck, and sizing the
      // shot to a piece of hardware makes the subject smaller the further
      // that hardware happens to reach.
      const scale = (piece.height ?? 1) / (size.y || 1)
      model.scale.setScalar(scale)
      // Scale applies to the geometry, position does not, so landing a point
      // of the mesh on its parent's origin means placing it at minus that
      // point *scaled*. Subtracting the raw centre instead leaves the model
      // off by centre × (scale − 1) — invisible on a mesh already near the
      // origin, and badly wrong on one that is not.
      model.position.copy(centre).multiplyScalar(-scale)

      model.traverse((node) => {
        if (!(node as THREE.Mesh).isMesh) return
        const mesh = node as THREE.Mesh
        // The pieces sit close together and the camera is long; culling them
        // against a frustum they are always inside costs more than it saves,
        // and gets it wrong on a mesh whose bounds three.js computed before
        // the group above it was rotated.
        mesh.frustumCulled = false
        const map = (mesh.material as THREE.MeshStandardMaterial).map
        if (map) {
          // Photogrammetry-style texture on a surface seen at every angle as
          // it turns; without this the far side of the figure smears.
          map.anisotropy = maxAnisotropy
          map.needsUpdate = true
        }
      })

      // The holder is what carries the piece's own turn and lean, so those
      // happen about its centre and stay independent of where it stands.
      const holder = new THREE.Group()
      holder.add(model)
      const [rx, ry, rz] = piece.rotation ?? [0, 0, 0]
      holder.rotation.set(rx, ry, rz)
      const [px, py, pz] = piece.position ?? [0, 0, 0]
      const base = piece.anchor === 'base' ? (size.y * scale) / 2 : 0
      holder.position.set(px, py + base, pz)
      pivot.add(holder)
    }

    /* ---------------- loading ----------------
       Two scans of eleven-odd megabytes each, in flight together. The bar has
       to mean something across both of them, so bytes are tracked per file
       rather than counting files done — a bar that sits at 0% and then jumps
       to 50% is worse than no bar. */
    const bytes = new Map<string, { loaded: number; total: number }>()
    let outstanding = pieces.length
    let placed = 0

    function report() {
      let loaded = 0
      let total = 0
      for (const entry of bytes.values()) {
        loaded += entry.loaded
        total += entry.total
      }
      if (!bytes.size) return
      // A file that has not sent its first progress event yet is assumed to
      // be the size of the average of those that have. These scans are within
      // a tenth of each other, so the bar does not lurch when the second one
      // starts reporting.
      const projected = (total / bytes.size) * pieces.length
      live.current.onProgress?.(Math.min(1, loaded / projected))
    }

    function settle() {
      if (--outstanding > 0 || disposed) return
      // Anything at all on stage is worth showing; only a scene that came back
      // completely empty is a failure the caller should swap a photograph for.
      if (placed) {
        resize()
        live.current.onReady?.()
      } else {
        live.current.onError?.()
      }
    }

    const loader = new GLTFLoader()
    for (const piece of pieces) {
      loader.load(
        piece.src,
        (gltf) => {
          if (!disposed) {
            place(gltf, piece)
            placed++
          }
          settle()
        },
        (event) => {
          if (event.lengthComputable && event.total > 0) {
            bytes.set(piece.src, { loaded: event.loaded, total: event.total })
            report()
          }
        },
        settle,
      )
    }

    /* ---------------- fitting ---------------- */
    const target = new THREE.Vector3()
    let fitted = 1

    function resize() {
      const w = host!.clientWidth
      const h = host!.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()

      // The distance at which the requested box exactly fills the frame,
      // taken as the worse of the two axes so the same shot survives a tall
      // narrow column and a short wide one. Everything outside the box is
      // free to leave the frame; that is the point of stating it as a box.
      const halfFov = (FOV * Math.PI) / 180 / 2
      const vertical = (framing.halfHeight * UNIT) / Math.tan(halfFov)
      const horizontal =
        (framing.halfWidth * UNIT) / (Math.tan(halfFov) * camera.aspect)
      fitted = Math.max(vertical, horizontal)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    /* ---------------- the loop ----------------
       Scroll is read from a ref rather than through state, and the loop is
       only alive while the section is mounted, which the caller ties to the
       viewport. Nothing here renders a frame the reader cannot see. */
    let scroll = progress.get()
    const unsubscribe = progress.on('change', (v) => {
      scroll = v
    })

    const start = performance.now()

    renderer.setAnimationLoop(() => {
      if (document.hidden) return
      const pose = poseAt(poses, THREE.MathUtils.clamp(scroll, 0, 1))

      // A hair under a degree of sway and a hair over a millimetre of rise,
      // on two periods that do not divide into each other so the pair never
      // returns to the same place. It is meant to be felt and not seen: a
      // frozen 3D frame reads as a broken one, and this is the smallest
      // motion that stops it.
      const t = live.current.idle ? (performance.now() - start) / 1000 : 0
      const bob = t ? Math.sin(t * 0.62) * 0.006 : 0
      const sway = t ? Math.sin(t * 0.41) * 0.014 : 0

      pivot.rotation.y = pose.yaw + sway

      target.set(
        framing.aim.x * UNIT,
        (framing.aim.y + pose.lift) * UNIT + bob,
        0,
      )
      const distance = fitted * pose.dolly
      camera.position.set(
        target.x,
        target.y + Math.sin(pose.elevation) * distance,
        Math.cos(pose.elevation) * distance,
      )
      camera.lookAt(target)

      renderer.render(scene, camera)
    })

    /* ---------------- teardown ----------------
       Two eleven-megabyte scans do not get to stay resident because the
       reader moved to another page. Textures and geometry are released by
       hand — the GPU copies are not reachable by the collector — and the
       context is force-lost so the browser reclaims the drawing buffer
       instead of holding it against its limit of live contexts. */
    return () => {
      disposed = true
      unsubscribe()
      observer.disconnect()
      renderer.setAnimationLoop(null)

      scene.traverse((node) => {
        const mesh = node as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.geometry?.dispose()
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const material of materials) {
          if (!material) continue
          for (const value of Object.values(material)) {
            if (value && (value as THREE.Texture).isTexture) (value as THREE.Texture).dispose()
          }
          material.dispose()
        }
      })

      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
    // The three things that really do mean "build a different scene". Callers
    // pass module constants for all of them, so in practice this is built
    // once — which is right, because rebuilding it is a fresh download of
    // twenty-odd megabytes.
  }, [pieces, poses, framing])

  return <div ref={hostRef} className="h-full w-full" aria-hidden />
}
