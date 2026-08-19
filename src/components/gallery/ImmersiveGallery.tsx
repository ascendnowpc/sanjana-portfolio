import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Performance } from '@/types/content'
import { buildCloud, DEFAULT_CLOUD, type TileLayout } from './layout'
import { GalleryTile, type TileRefs } from './GalleryTile'
import { usePointer } from '@/hooks/usePointer'
import { useIsMobile, usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { useTransition } from '@/components/layout/TransitionProvider'
import { clamp, smoothstep } from '@/lib/utils'

/** How far past the camera plane a tile travels before it wraps to the back. */
const FRONT = 620
/** Focal length of the projection. Must stay above FRONT or tiles invert. */
const PERSPECTIVE = 1400
/** Ambient forward drift, in px per 60fps frame. */
const DRIFT = 1.1
/**
 * Sideways steering is a straight translation of the wall, not a rotation.
 *
 * Rotating the ring made the tiles swing around the viewer like a carousel,
 * which fought the straight-line travel that gives the tunnel its depth. The
 * wall now only ever slides — forward on its own, sideways when steered — so
 * every tile keeps moving parallel to its neighbours.
 *
 * There is no ambient sideways drift: left untouched, the index looks exactly
 * as it did before steering existed.
 */
const PAN_PER_PX = 1.35
/** Clamp, so the wall can be nudged aside but never steered off screen. */
const PAN_LIMIT = 620

/**
 * Every tile in frame plays.
 *
 * A 1456×839 viewport puts ~59 tiles on screen, so this has to clear that or
 * it silently becomes a budget and some visible tiles stay frozen. It is a
 * backstop against a pathological viewport, not a quality knob.
 *
 * This is only affordable because the previews are cut for it: 480px at 15fps
 * is roughly a third of the decode cost of the 640px/30fps cut they replaced,
 * and all 36 together are 2.4 MB. Tiles off the edge are still skipped — a
 * decoder spent on something invisible buys nothing.
 *
 * If this ever costs too many frames on weaker hardware, turning it down is
 * the single-line fix: the set is depth-ranked, so the furthest and faintest
 * tiles are the ones that lose their decoder first.
 */
const MAX_PLAYING = 72
const MAX_PLAYING_MOBILE = 8

/** Depth band worth spending a decoder on — see the opacity ramp below. */
const PLAY_FAR = 0.1
const PLAY_NEAR = 0.94
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
 * ~32 simultaneously-composited tiles smooth. Tiles wrap modulo the total
 * tunnel depth, so the wall never runs out.
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
  // Reduced-motion users get stills only: a frame full of autoplaying video is
  // precisely what that preference is asking us not to do.
  const maxPlaying = reduced ? 0 : isMobile ? MAX_PLAYING_MOBILE : MAX_PLAYING
  const cloud = useMemo(
    () =>
      buildCloud(performances, {
        repeats,
        outerRadius: isMobile ? 620 : DEFAULT_CLOUD.outerRadius,
        innerRadius: isMobile ? 190 : DEFAULT_CLOUD.innerRadius,
        minWidth: isMobile ? 170 : DEFAULT_CLOUD.minWidth,
        maxWidth: isMobile ? 300 : DEFAULT_CLOUD.maxWidth,
      }),
    [performances, repeats, isMobile],
  )

  const travel = useRef(0)
  const targetTravel = useRef(0)
  /** Horizontal offset of the whole wall, in px. */
  const pan = useRef(0)
  const targetPan = useRef(0)
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

    // Trackpads report both axes, so a two-finger sideways swipe slides the
    // wall across while a vertical one flies down the tunnel.
    const onWheel = (e: WheelEvent) => {
      targetTravel.current += e.deltaY * 1.5
      targetPan.current = clamp(
        targetPan.current - e.deltaX * PAN_PER_PX,
        -PAN_LIMIT,
        PAN_LIMIT,
      )
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
      targetTravel.current += dy * 2.6
      targetPan.current = clamp(
        targetPan.current + dx * PAN_PER_PX,
        -PAN_LIMIT,
        PAN_LIMIT,
      )
      lastX = e.clientX
      lastY = e.clientY
    }
    const onUp = () => {
      dragging = false
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') targetTravel.current += 700
      if (e.key === 'ArrowUp' || e.key === 'PageUp') targetTravel.current -= 700
      if (e.key === 'ArrowLeft')
        targetPan.current = clamp(targetPan.current + 220, -PAN_LIMIT, PAN_LIMIT)
      if (e.key === 'ArrowRight')
        targetPan.current = clamp(targetPan.current - 220, -PAN_LIMIT, PAN_LIMIT)
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

    const TOTAL = DEFAULT_CLOUD.depth * repeats
    let raf = 0
    let last = 0
    let hitFrame = 0

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

      registry.current.forEach(({ root, tile, depth }) => {
        // Skip tiles that have faded out at either end of the tunnel.
        if (depth < 0.1 || depth > 0.94 || depth <= bestDepth) return
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
     * Every tile visible in the frame runs its loop.
     *
     * Ranked by depth only so that if the cap ever bites, it is the furthest
     * (smallest, most heavily shaded) tiles that lose their decoder rather
     * than whatever happened to be iterated last.
     *
     * Membership changes slowly — tiles enter and leave the frame at drift
     * speed — so the re-render this triggers stays rare even though the set
     * is now large.
     */
    const updatePlaying = () => {
      if (maxPlaying === 0) {
        if (playingRef.current.size) {
          playingRef.current = new Set()
          setPlaying(playingRef.current)
        }
        return
      }
      const vw = window.innerWidth
      const vh = window.innerHeight
      const near: { key: string; depth: number }[] = []

      registry.current.forEach(({ root, tile, depth }) => {
        if (depth < PLAY_FAR || depth > PLAY_NEAR) return
        const r = root.getBoundingClientRect()
        if (r.width < PLAY_MIN_WIDTH) return
        // A tile that has flown past the edge of the viewport is still in the
        // registry and still near the camera; it is not worth a decoder.
        if (r.right < 0 || r.left > vw || r.bottom < 0 || r.top > vh) return
        near.push({ key: tile.key, depth })
      })

      near.sort((a, b) => b.depth - a.depth)
      const next = near.slice(0, maxPlaying)

      const prev = playingRef.current
      if (next.length === prev.size && next.every((n) => prev.has(n.key))) return
      playingRef.current = new Set(next.map((n) => n.key))
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

      // Ambient drift halts while a tile is focused, so reading is easy.
      if (!hoveredRef.current && !reduced) targetTravel.current += DRIFT * f
      travel.current +=
        (targetTravel.current - travel.current) * (1 - Math.pow(1 - 0.075, f))
      pan.current += (targetPan.current - pan.current) * (1 - Math.pow(1 - 0.075, f))

      const pt = pointer.step()
      const t = now / 1000
      const focus = hoveredRef.current

      registry.current.forEach((entry) => {
        const { root, shade, tile } = entry
        // Wrap into (-TOTAL, 0] so tiles recycle to the back of the tunnel.
        const wrapped =
          ((((tile.z + travel.current) % TOTAL) + TOTAL) % TOTAL) - TOTAL
        const depth = (wrapped + TOTAL) / TOTAL // 0 = furthest, 1 = at camera
        entry.depth = depth
        const float = reduced ? 0 : Math.sin(t * 0.45 + tile.phase) * 14

        // Look-around parallax, applied per tile rather than to a shared 3D
        // container: near tiles slide further than far ones, which is the
        // depth cue a single container translate cannot give.
        const shift = 0.4 + depth * 1.2
        // Steering slides the wall sideways as a whole; tiles keep their
        // fixed places on it, so everything moves in parallel.
        const px = tile.x + pan.current - pt.x * 58 * shift
        const py = tile.y + float - pt.y * 36 * shift

        root.style.transform =
          `perspective(${PERSPECTIVE}px) ` +
          `translate3d(${px}px, ${py}px, ${wrapped + FRONT}px) ` +
          // rotateY/rotateX by position curves the flat wall into a cylinder
          // wrapped around the viewer — the look from the reference site.
          `rotateY(${tile.x * 0.014 - pt.x * 5}deg) ` +
          `rotateX(${-tile.y * 0.012 + pt.y * 3.2}deg) ` +
          `rotateZ(${tile.tilt}deg)`

        // Without a shared 3D context, paint order is DOM order — so depth has
        // to drive z-index, which also makes hit-testing pick the front tile.
        root.style.zIndex = String(Math.round(depth * 1000))

        root.style.opacity = String(
          smoothstep(0, 0.09, depth) * (1 - smoothstep(0.9, 1, depth)),
        )

        // One layer carries both jobs: depth shading, plus pushing every
        // other tile back when one is focused.
        const shading = clamp(0.74 - depth * 0.6, 0, 0.8)
        shade.style.opacity = String(
          focus === tile.key
            ? shading * 0.2
            : focus
              ? Math.min(0.92, shading + 0.3)
              : shading,
        )
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
      <div ref={worldRef} className="absolute inset-0 z-0">
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
            'radial-gradient(ellipse 48% 40% at 50% 50%, rgba(4,7,15,0.96) 0%, rgba(4,7,15,0.8) 48%, transparent 80%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(4,7,15,0.85)_100%)]" />

      {/* Edge scrims: the wall runs behind the wordmark and the bottom links,
          and a bright tile drifting past must never eat them. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-void via-void/75 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-56 bg-gradient-to-t from-void via-void/80 to-transparent" />
    </div>
  )
}
