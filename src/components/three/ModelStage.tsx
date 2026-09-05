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

export interface Framing {
  /**
   * Where the subject's own centre sits, relative to the centre of the mesh's
   * bounding box, in units of the model's height.
   *
   * It is not always zero and on these scans it never is. A .glb of a singer
   * with a mic stand has a bounding box that spans both, so its centre falls
   * in the empty air between them — turn about that and the person swings
   * around a point beside herself, and frame on it and she sits off to one
   * side with a stand in the middle of the shot. This moves the axis onto the
   * subject, which is both where the turn should happen and where the camera
   * should point.
   */
  subject: { x: number; y: number; z: number }
  /**
   * Half the width the frame must hold, in units of the model's height.
   *
   * Stated as a box to fill rather than as a margin around the bounding box,
   * because the bounding box is the wrong thing to frame on — most of this
   * one's width is a boom arm reaching away from the person, and holding all
   * of it costs a third of the frame to keep an empty arm on screen. Letting
   * the boom leave the frame is the better picture, so the shot is sized to
   * the subject and the box says so directly.
   */
  halfWidth: number
  /** Half the height the frame must hold, same units. Under 0.5 crops the model. */
  halfHeight: number
  /** Vertical aim, in units of the model's height above the subject's centre. */
  aim: number
}

interface Props {
  /**
   * The .glb to show, as a site-root path.
   *
   * Not run through `mediaUrl`: the models sit at the root of public/ rather
   * than under public/media/, so they are bundle assets served from the site's
   * own origin and the R2 rewrite would point them at a key that is not there.
   */
  src: string
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
  src,
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
    renderer.toneMappingExposure = 1.15
    host.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 100)

    /* ---------------- light ----------------
       Four white lights and no environment map. The scan's material declares
       metalness 1 and leans on its metallic-roughness texture to bring that
       back down, so anything the texture leaves metallic has nothing to
       reflect and renders black. Every light here is therefore direct, and
       the ambient is high enough that a fully metallic pixel still reads.

       The rim is the one doing the real work: the stage is black and the
       subject is lit warm-neutral, so without a light behind her the dark
       side of the figure has no edge and she dissolves into the ground. */
    scene.add(new THREE.AmbientLight(0xffffff, 1.15))

    const key = new THREE.DirectionalLight(0xffffff, 2.1)
    key.position.set(2.5, 3.4, 4)
    scene.add(key)

    const fill = new THREE.DirectionalLight(0xffffff, 0.65)
    fill.position.set(-3.5, 0.6, 2)
    scene.add(fill)

    const rim = new THREE.DirectionalLight(0xffffff, 1.5)
    rim.position.set(-1.2, 2.2, -3.5)
    scene.add(rim)

    /* ---------------- the subject ----------------
       A pivot the loaded scene hangs under, so `yaw` turns the model about
       its own centre no matter where the .glb happened to put its origin. */
    const pivot = new THREE.Group()
    scene.add(pivot)

    let height = 1
    let disposed = false

    const loader = new GLTFLoader()
    loader.load(
      src,
      (gltf) => {
        if (disposed) return
        const model = gltf.scene

        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const centre = box.getCenter(new THREE.Vector3())

        // Normalised on height rather than on the longest side. The longest
        // side of the singer is the mic boom, so scaling by it would size the
        // shot to a piece of hardware and make the person smaller the further
        // the stand reaches.
        const scale = 1 / (size.y || 1)
        model.scale.setScalar(scale)
        // Scale applies to the geometry, position does not, so landing a
        // point of the mesh on the pivot means placing it at minus that point
        // *scaled*. Subtracting the raw centre instead leaves the model off by
        // centre × (scale − 1), which is invisible on a mesh that is already
        // near the origin and badly wrong on one that is not.
        model.position.copy(centre).multiplyScalar(-scale)
        // Then off the bounding centre and onto the subject, so the turn
        // happens about her and the stand swings around her rather than the
        // other way about.
        model.position.x -= framing.subject.x
        model.position.y -= framing.subject.y
        model.position.z -= framing.subject.z
        height = 1

        const maxAnisotropy = renderer.capabilities.getMaxAnisotropy()
        model.traverse((node) => {
          if (!(node as THREE.Mesh).isMesh) return
          const mesh = node as THREE.Mesh
          mesh.frustumCulled = false
          const material = mesh.material as THREE.MeshStandardMaterial
          const map = material.map
          if (map) {
            // Photogrammetry-style texture on a surface seen at every angle
            // as it turns; without this the far side of the figure smears.
            map.anisotropy = maxAnisotropy
            map.needsUpdate = true
          }
        })

        pivot.add(model)
        resize()
        live.current.onReady?.()
      },
      (event) => {
        if (event.lengthComputable && event.total > 0) {
          live.current.onProgress?.(event.loaded / event.total)
        }
      },
      () => {
        if (!disposed) live.current.onError?.()
      },
    )

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
      const vertical = (framing.halfHeight * height) / Math.tan(halfFov)
      const horizontal =
        (framing.halfWidth * height) / (Math.tan(halfFov) * camera.aspect)
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

      target.set(0, (framing.aim + pose.lift) * height + bob, 0)
      const distance = fitted * pose.dolly
      camera.position.set(
        0,
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
    // pass module constants for `poses` and `framing`, so in practice only a
    // change of model ever tears this down — which is exactly right, because
    // a different model is a different download.
  }, [src, poses, framing])

  return <div ref={hostRef} className="h-full w-full" aria-hidden />
}
