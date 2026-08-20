import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Performance } from '@/types/content'
import { buildCloud, DEFAULT_CLOUD, type TileLayout } from './layout'
import { GalleryTile, type TileRefs } from './GalleryTile'
import { usePointer } from '@/hooks/usePointer'
import { useIsMobile, usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { useTransition } from '@/components/layout/TransitionProvider'
import { clamp, smoothstep } from '@/lib/utils'

/**
 * Focal length of the projection, in px.
 *
 * With a per-tile `perspective(P)`, an element pushed to translateZ(P − D)
 * sits exactly D px from the eye and is scaled by P/D — a textbook pinhole.
 * Everything below is written in those terms.
 *
 * Short, because focal length *is* the field of view: a tile lands at
 * P·tan(bearing) px from centre, so at 1400 a frame on the edge of a 1456px
 * viewport is only 27° off-axis and turns barely a tenth of the way toward
 * the eye. The reference skews its edge frames hard — one measures 210px on
 * the near edge against 340 on the far — which needs roughly 45°, and that
 * means a wide lens. Radii come down to match, since scale is P/distance.
 */
const PERSPECTIVE = 780

const TAU = Math.PI * 2

/**
 * The viewer does not travel. They turn.
 *
 * Every previous version of this flew a camera forward down a tunnel of
 * pictures, with a sideways pan bolted on. Watching the reference frame by
 * frame kills that reading outright: between two frames half a second apart,
 * tiles on the *left*, in the *centre* and on the *right* all slide the same
 * direction, and none of them changes size. Forward travel would push the left
 * ones left and the right ones right, growing as they came. This is a yaw — a
 * head turning inside a room that stays put.
 *
 * So there is no travel axis any more, no wrap-around depth, no drift toward
 * the camera. There is a heading, and input changes it.
 */
/** Radians of yaw per pixel of drag. */
const YAW_PER_PX = 0.0022
/** Radians of pitch per pixel of drag. Slower — the band is shallow. */
const PITCH_PER_PX = 0.0016
/** Radians of yaw per unit of wheel delta, so a scroll orbits the room. */
const YAW_PER_WHEEL = 0.0016
/**
 * How far the head may tip. Beyond this the band of work leaves the frame and
 * the viewer is staring at empty ceiling.
 */
const PITCH_LIMIT = 0.2
/**
 * How far the cursor alone turns the head, in radians at full deflection.
 *
 * Sneha asked to move around by pointing rather than only by scrolling. At 0.55
 * the pointer covers about two-thirds of a viewport of yaw edge to edge, which
 * is enough to feel like steering without making the room lurch every time the
 * mouse crosses the page.
 */
const LOOK_YAW = 0.55
const LOOK_PITCH = 0.16

/** Ambient yaw, radians per 60fps frame — the room turning gently on its own. */
const DRIFT = 0.00042
/**
 * Seconds the ambient turn takes to reach full speed on arrival.
 *
 * A frame-difference trace of the reference capture shows it hold still, then
 * ramp 0.11 → 2.73 over about a second before settling. It starts *moving*
 * rather than being already in motion the instant you look at it.
 */
const SPIN_UP = 1.15

/**
 * Half-angle of the view, in radians.
 *
 * Tiles beyond CULL are behind the viewer's shoulders and are skipped
 * entirely; between FADE and CULL they wash out, so nothing pops at the edge
 * of vision. Generous, because on a shell the flanks come close to the eye and
 * a wide field is what fills the corners of the frame.
 */
const FOV_FADE = 1.02
const FOV_CULL = 1.36

/** Nearest a tile may come to the eye before it is skipped, in px. Guards the
 *  divide-by-depth: a tile at the eye projects to infinity. */
const NEAR_CLIP = 190

/**
 * How many tiles may hold a video decoder at once.
 *
 * This used to be 72 — "every tile in frame plays" — and that is what cost the
 * wall its smoothness. A browser has a small pool of hardware video decoders;
 * past roughly a dozen concurrent streams Chrome quietly drops the rest to
 * software decode on the main thread, which is the same thread writing the
 * transforms, so the whole wall stutters. Firefox and Safari cap harder still
 * and simply refuse to start the surplus, leaving frozen tiles.
 *
 * A dozen moving frames already reads as "the whole wall is alive", because
 * the ones that get them are the nearest and largest. The rest hold their
 * poster, which at tunnel depth is indistinguishable at a glance.
 */
const MAX_PLAYING = 12
const MAX_PLAYING_MOBILE = 3

/**
 * Nudge given to a tile that is already playing when ranking candidates.
 *
 * Without it, two tiles either side of the cut swap places every time the
 * ranking runs, and each swap tears down a decoder and starts a new one —
 * the most expensive thing this component can do. The bonus is small enough
 * that a genuinely nearer tile still takes the slot.
 */
const PLAY_STICKY = 0.08

/**
 * Delay, in ms, before the first decoder is handed out.
 *
 * Video elements created during first paint compete with the posters for
 * bandwidth and hold `window.load` open, which is what kept the preloader
 * pinned to its ceiling. Posters land first, the wall is interactive
 * immediately, and the footage fades in behind it a moment later.
 */
const WARMUP_MS = 900

/** Below this on-screen width a tile is too small for motion to register. */
const PLAY_MIN_WIDTH = 60

interface Props {
  performances: Performance[]
  /** Fires when the focused tile changes, so the hero copy can follow it. */
  onFocusChange?: (performance: Performance | null) => void
}

/**
 * An endless 3D wall of stage frames that the viewer flies through.
 *
 * The React tree renders once and then stays still: all motion is written
 * straight to `style.transform` from a single rAF loop, which is what keeps
 * eighty simultaneously-composited tiles smooth. Tiles wrap modulo the total
 * tunnel depth, so the wall never runs out.
 *
 * Only the nearest dozen carry live footage — see MAX_PLAYING. Everything
 * else holds a poster, which is what keeps the wall a wall and not a stack of
 * video decoders fighting over the main thread.
 */
export function ImmersiveGallery({ performances, onFocusChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const registry = useRef(new Map<string, TileRefs>())

  const [hovered, setHovered] = useState<string | null>(null)
  const hoveredRef = useRef<string | null>(null)

  /** Keys of the tiles currently running footage. Mirrored in a ref so the
   *  loop can diff against it without re-subscribing. */
  const [playing, setPlaying] = useState<ReadonlySet<string>>(() => new Set())
  const playingRef = useRef<ReadonlySet<string>>(playing)

  const isMobile = useIsMobile()
  const reduced = usePrefersReducedMotion()
  const { zoomTo } = useTransition()

  const repeats = isMobile ? 1 : 2

  /** False until the posters have settled — see WARMUP_MS. */
  const [warm, setWarm] = useState(false)
  useEffect(() => {
    let t = 0
    const arm = () => {
      t = window.setTimeout(() => setWarm(true), WARMUP_MS)
    }
    if (document.readyState === 'complete') arm()
    else window.addEventListener('load', arm, { once: true })
    return () => {
      window.removeEventListener('load', arm)
      clearTimeout(t)
    }
  }, [])

  // Reduced-motion users get stills only: a frame full of autoplaying video is
  // precisely what that preference is asking us not to do.
  const maxPlaying = !warm || reduced
    ? 0
    : isMobile
      ? MAX_PLAYING_MOBILE
      : MAX_PLAYING
  const cloud = useMemo(
    () =>
      buildCloud(performances, {
        repeats,
        // Nearer shell and a shallower band on a phone: a narrow viewport
        // sees a much smaller slice of the horizon, so work has to sit closer
        // to fill it.
        minRadius: isMobile ? 700 : DEFAULT_CLOUD.minRadius,
        maxRadius: isMobile ? 1500 : DEFAULT_CLOUD.maxRadius,
        elevationSpread: isMobile ? 0.34 : DEFAULT_CLOUD.elevationSpread,
        minWidth: isMobile ? 84 : DEFAULT_CLOUD.minWidth,
        maxWidth: isMobile ? 240 : DEFAULT_CLOUD.maxWidth,
      }),
    [performances, repeats, isMobile],
  )

  /** Where the viewer is looking. Eased toward the target every frame. */
  const yaw = useRef(0)
  const targetYaw = useRef(0)
  const pitch = useRef(0)
  const targetPitch = useRef(0)
  const pointer = usePointer(0.07)
  /** Distance dragged since pointerdown — a drag must not open a page. */
  const dragDistance = useRef(0)

  // The loop reads these through refs so it never has to be torn down and
  // rebuilt when the cloud is recomputed or the parent re-renders.
  const cloudRef = useRef(cloud)
  cloudRef.current = cloud
  const onFocusChangeRef = useRef(onFocusChange)
  onFocusChangeRef.current = onFocusChange

  const register = useCallback((key: string, refs: TileRefs | null) => {
    if (refs) registry.current.set(key, refs)
    else registry.current.delete(key)
  }, [])

  const handleSelect = useCallback(
    (tile: TileLayout, el: HTMLElement) => {
      if (dragDistance.current > 8) return
      zoomTo(
        el,
        tile.performance.poster,
        tile.performance.title,
        `/work/${tile.performance.slug}`,
      )
    },
    [zoomTo],
  )

  /* ---------------- input: wheel, drag, keyboard ---------------- */
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Both wheel axes turn the head. Vertical scroll drives *yaw* rather than
    // pitch on purpose: pitch is clamped to a shallow band, so a wheel mapped
    // to it would hit the stop within one flick and feel broken, while yaw
    // goes round forever.
    const onWheel = (e: WheelEvent) => {
      targetYaw.current += (e.deltaY + e.deltaX) * YAW_PER_WHEEL
    }

    let dragging = false
    let lastX = 0
    let lastY = 0
    const onDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      dragDistance.current = 0
    }
    // Deliberately not setPointerCapture: capturing retargets pointerup to the
    // container, which stops the tile button from ever receiving a click.
    // Listening on window covers dragging past the edge just as well.
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      // Both axes count toward the drag threshold, or a purely sideways drag
      // would still register as a click and open a page.
      dragDistance.current += Math.abs(dx) + Math.abs(dy)
      // Drag moves the world with the hand: pull right and the room comes
      // right, which means the heading goes the other way.
      targetYaw.current -= dx * YAW_PER_PX
      targetPitch.current = clamp(
        targetPitch.current + dy * PITCH_PER_PX,
        -PITCH_LIMIT,
        PITCH_LIMIT,
      )
      lastX = e.clientX
      lastY = e.clientY
    }
    const onUp = () => {
      dragging = false
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') targetYaw.current -= 0.28
      if (e.key === 'ArrowRight' || e.key === 'PageDown') targetYaw.current += 0.28
      if (e.key === 'ArrowUp')
        targetPitch.current = clamp(
          targetPitch.current - 0.08,
          -PITCH_LIMIT,
          PITCH_LIMIT,
        )
      if (e.key === 'ArrowDown')
        targetPitch.current = clamp(
          targetPitch.current + 0.08,
          -PITCH_LIMIT,
          PITCH_LIMIT,
        )
    }

    el.addEventListener('wheel', onWheel, { passive: true })
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)

    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  /* ---------------- the single animation loop ---------------- */
  useEffect(() => {
    const world = worldRef.current
    if (!world) return

    let raf = 0
    let last = 0
    let hitFrame = 0
    /** Timestamp the ambient drift began, for the spin-up ramp. */
    let started = 0

    /**
     * The wall drifts continuously, so a tile slides under a stationary cursor
     * and CSS transforms alone never fire pointerenter — focus has to be
     * resolved from the loop instead.
     *
     * Rect intersection rather than elementFromPoint: hit-testing into a
     * preserve-3d subtree is unreliable mid-frame, and this also runs as a
     * pure read before any style writes, so it never forces an extra layout.
     * Candidates are ranked by depth, matching what paints on top.
     */
    const updateFocus = () => {
      const { x, y } = pointer.client.current
      if (x < 0) return setFocus(null)

      let best: string | null = null
      let bestDepth = -1

      registry.current.forEach(({ root, tile, depth, hidden }) => {
        // Skip anything behind the viewer or already beaten on depth.
        if (hidden || depth <= bestDepth) return
        const r = root.getBoundingClientRect()
        if (r.width < 8) return
        // The rect is the axis-aligned bound of a slightly rotated quad, so
        // trim the edges to keep hover honest.
        const ix = r.width * 0.07
        const iy = r.height * 0.07
        if (x < r.left + ix || x > r.right - ix) return
        if (y < r.top + iy || y > r.bottom - iy) return
        best = tile.key
        bestDepth = depth
      })

      setFocus(best)
    }

    /**
     * Hands the decoder budget to the nearest tiles on screen.
     *
     * Ranked by depth, so the tiles that get footage are the big ones at the
     * front — where motion actually reads — and the ones that lose it are the
     * far, small, heavily-shaded ones where a still is indistinguishable.
     *
     * One clip per performance. The wall stacks `repeats` copies of the
     * catalogue down the tunnel, so without this the same eight seconds of
     * footage can hold two or three decoders at once for no visible gain.
     *
     * Membership changes slowly — tiles enter and leave the frame at drift
     * speed, and PLAY_STICKY keeps a tile that already has a decoder from
     * losing it to a marginally nearer neighbour — so the re-render this
     * triggers stays rare.
     */
    const updatePlaying = () => {
      if (maxPlaying === 0) {
        if (playingRef.current.size) {
          playingRef.current = new Set()
          setPlaying(playingRef.current)
        }
        return
      }
      const prev = playingRef.current
      const vw = window.innerWidth
      const vh = window.innerHeight
      const near: { key: string; slug: string; rank: number }[] = []

      registry.current.forEach(({ root, tile, depth, hidden }) => {
        if (hidden) return
        const r = root.getBoundingClientRect()
        if (r.width < PLAY_MIN_WIDTH) return
        // A tile that has flown past the edge of the viewport is still in the
        // registry and still near the camera; it is not worth a decoder.
        if (r.right < 0 || r.left > vw || r.bottom < 0 || r.top > vh) return
        near.push({
          key: tile.key,
          slug: tile.performance.slug,
          rank: depth + (prev.has(tile.key) ? PLAY_STICKY : 0),
        })
      })

      near.sort((a, b) => b.rank - a.rank)

      const next: string[] = []
      const claimed = new Set<string>()
      for (const n of near) {
        if (next.length >= maxPlaying) break
        if (claimed.has(n.slug)) continue
        claimed.add(n.slug)
        next.push(n.key)
      }

      if (next.length === prev.size && next.every((k) => prev.has(k))) return
      playingRef.current = new Set(next)
      setPlaying(playingRef.current)
    }

    const setFocus = (key: string | null) => {
      if (hoveredRef.current === key) return
      hoveredRef.current = key
      setHovered(key)
      const tile = key ? cloudRef.current.find((t) => t.key === key) : null
      onFocusChangeRef.current?.(tile?.performance ?? null)
    }

    const frame = (now: number) => {
      // Read phase first — layout is still clean from the last paint.
      if (++hitFrame % 3 === 0) updateFocus()
      // Frame 2 rather than 1: this runs in the read phase, so it sees the
      // depths written at the end of the *previous* frame, and on frame 1
      // every entry.depth is still its initial 0. After that, rarely — the
      // set only turns over as tiles wrap past the camera.
      if (hitFrame === 2 || hitFrame % 20 === 0) updatePlaying()

      const dt = last ? Math.min(64, now - last) : 16.667
      last = now
      const f = dt / 16.667

      // The room turns gently on its own, and stops dead while a tile is
      // focused so it can be read.
      if (!hoveredRef.current && !reduced) {
        if (!started) started = now
        const age = (now - started) / 1000
        const spin = age >= SPIN_UP ? 1 : 1 - Math.pow(1 - age / SPIN_UP, 3)
        targetYaw.current += DRIFT * spin * f
      }
      const ease = 1 - Math.pow(1 - 0.075, f)
      yaw.current += (targetYaw.current - yaw.current) * ease
      pitch.current += (targetPitch.current - pitch.current) * ease

      const pt = pointer.step()
      const t = now / 1000
      const focus = hoveredRef.current

      // The cursor steers. Moving the mouse to the edge of the screen turns
      // the head most of a viewport's worth in that direction, so the room can
      // be explored by pointing at it — dragging and scrolling are then extra
      // ways in rather than the only ones. `pt` is already eased, so this
      // inherits the smoothing for free.
      const viewYaw = yaw.current + pt.x * LOOK_YAW
      const viewPitch = clamp(
        pitch.current + pt.y * LOOK_PITCH,
        -PITCH_LIMIT - LOOK_PITCH,
        PITCH_LIMIT + LOOK_PITCH,
      )

      registry.current.forEach((entry) => {
        const { root, shade, tile } = entry

        // Bearing relative to where the viewer is facing, wrapped into
        // (−π, π] so the shell has no seam to cross.
        let a = (tile.azimuth - viewYaw) % TAU
        if (a > Math.PI) a -= TAU
        else if (a < -Math.PI) a += TAU

        const away = Math.abs(a)
        if (away > FOV_CULL) {
          // Behind the viewer. Hiding rather than merely fading keeps it out
          // of hit-testing and off the compositor entirely.
          if (!entry.hidden) {
            entry.hidden = true
            entry.lastAlpha = 0
            root.style.opacity = '0'
          }
          entry.depth = 0
          return
        }

        // Barely there. A 14px bob on every tile made the whole thing
        // shimmer; at this amplitude it reads as the room breathing.
        const float = reduced ? 0 : Math.sin(t * 0.32 + tile.phase) * 0.0016
        const e = tile.elevation - viewPitch + float

        const cosA = Math.cos(a)
        const sinA = Math.sin(a)
        const cosE = Math.cos(e)
        const sinE = Math.sin(e)
        const R = tile.radius

        // Straight spherical-to-camera. D is the distance in front of the
        // eye; on a shell the flanks swing close, so it falls off sharply
        // toward the edges of vision and those tiles read large.
        const D = R * cosA * cosE
        if (D < NEAR_CLIP) {
          if (!entry.hidden) {
            entry.hidden = true
            entry.lastAlpha = 0
            root.style.opacity = '0'
          }
          entry.depth = 0
          return
        }
        const X = R * sinA * cosE
        const Y = -R * sinE

        // Deliberately not toggling `visibility`: that invalidates layout on
        // every change, and updateFocus calls getBoundingClientRect three
        // frames later, which then forces a synchronous reflow. Opacity alone
        // stays on the compositor. This was the stutter.
        if (entry.hidden) entry.hidden = false

        // Nearness, 0..1, used to rank who gets a decoder and who paints on
        // top. Not a tunnel position any more — just "how big is this".
        const depth = clamp(1 - D / (DEFAULT_CLOUD.maxRadius * 1.05), 0, 1)
        entry.depth = depth

        // translateZ(P − D) puts the element exactly D from the eye under a
        // perspective of P, so CSS scales it by P/D — the pinhole projection,
        // done by the compositor.
        //
        // The two rotations turn each frame to face the viewer, and their
        // signs are the whole of "inward, not outward". A tile off to the
        // right has a > 0; rotateY(−a) swings its *right* edge toward the eye,
        // so the shell closes around the viewer like the inside of a drum.
        // Positive rotateY would push that edge away instead and the wall
        // would bulge outward at you, which is what it did before.
        root.style.transform =
          `perspective(${PERSPECTIVE}px) ` +
          `translate3d(${X.toFixed(1)}px, ${Y.toFixed(1)}px, ${(PERSPECTIVE - D).toFixed(1)}px) ` +
          `rotateY(${(-a).toFixed(4)}rad) ` +
          `rotateX(${(-e).toFixed(4)}rad)`

        // Paint order is DOM order without a shared 3D context, so depth has
        // to drive z-index — which also makes hit-testing pick the front tile.
        // Written only when the rounded value changes: an inline style costs a
        // parse and an invalidation whether or not it differs.
        const z = Math.round(depth * 1000)
        if (z !== entry.lastZ) {
          entry.lastZ = z
          root.style.zIndex = String(z)
        }

        // Wash out toward the edge of vision so nothing pops in at the
        // shoulder, and let the very back of the shell fall away a little.
        // Edge-of-vision fade only. The extra (0.55 + 0.45·depth) term here
        // was knocking every far frame down to little over half opacity on top
        // of the shading below, which is why the room read as dim and empty.
        const alpha =
          Math.round((1 - smoothstep(FOV_FADE, FOV_CULL, away)) * 200) / 200
        if (alpha !== entry.lastAlpha) {
          entry.lastAlpha = alpha
          root.style.opacity = String(alpha)
        }

        // Light. The reference sits close to the footage's own brightness and
        // only the far shell falls away; a heavy veil greys everything into a
        // smudge where nothing separates from its neighbours.
        const shading = clamp(0.34 - depth * 0.34, 0, 0.34)
        // Focus softens the room rather than erasing it. Taking everything
        // else to 0.975 black left the page looking broken — one picture
        // floating in a void — when all it needs is for the surroundings to
        // step back. The blur below does most of the separating; this only
        // has to take the edge off.
        const dim =
          Math.round(
            (focus === tile.key
              ? 0
              : focus
                ? Math.min(0.62, shading + 0.34)
                : shading) * 200,
          ) / 200
        if (dim !== entry.lastShade) {
          entry.lastShade = dim
          shade.style.opacity = String(dim)
        }
      })

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [repeats, reduced, pointer, maxPlaying])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 touch-none select-none"
      aria-hidden="true"
    >
      {/* z-0 is load-bearing: it makes the wall its own stacking context, so
          the depth-derived z-index on each tile stays local and cannot paint
          over the scrims and vignette below. */}
      {/* One blur on the whole room while a frame is focused, rather than a
          filter per tile: eighty individual blurs would each force their own
          paint pass. The focused tile is lifted out of it by its own z-index
          and its shade going to zero. */}
      <div
        ref={worldRef}
        className="absolute inset-0 z-0"
        style={{
          filter: hovered ? 'blur(2.5px)' : 'none',
          transition: 'filter 520ms var(--ease-out-expo)',
        }}
      >
        {cloud.map((tile) => (
          <GalleryTile
            key={tile.key}
            tile={tile}
            register={register}
            active={hovered === tile.key}
            playing={playing.has(tile.key)}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Keeps the hero copy sitting on darkness no matter what flies past. */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'radial-gradient(ellipse 46% 38% at 50% 50%, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.72) 46%, transparent 78%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(0,0,0,0.9)_100%)]" />

      {/* Edge scrims: the wall runs behind the wordmark and the bottom links,
          and a bright tile drifting past must never eat them. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-void via-void/75 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-56 bg-gradient-to-t from-void via-void/80 to-transparent" />
    </div>
  )
}
