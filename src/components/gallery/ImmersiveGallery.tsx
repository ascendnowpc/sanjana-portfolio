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

/**
 * The same, for a phone.
 *
 * Focal length is field of view, and a 390px-wide viewport at 780 sees a
 * 0.49rad slice of the horizon — four frames, with the rest of the catalogue
 * behind the viewer's shoulders. A shorter lens opens that to 0.8rad and fills
 * the screen. It costs nothing in size: tile widths are solved against
 * whichever focal length is in play, so the frames stay exactly as big as they
 * were asked to be and simply have company.
 */
const PERSPECTIVE_MOBILE = 460

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
 * Steering with the cursor.
 *
 * Sneha asked to move around by pointing, not only by scrolling, and the last
 * attempt at that gave the pointer a fixed *offset* — hold the mouse right and
 * the heading leans 0.55rad right. That is not moving around. It turns once,
 * stops, and rewinds the moment the mouse comes back to the middle, so the
 * room can never actually be explored by pointing at it.
 *
 * So the cursor drives a *rate* instead. Past a dead centre, holding the
 * pointer out keeps the room turning for as long as it is held, and the yaw it
 * produces is kept rather than unwound — the same contract a camera stick has.
 * A small offset still rides on top for parallax, small enough that it cannot
 * fight the rate it sits on.
 */
/**
 * Fraction of the half-viewport that steers nothing.
 *
 * This is also the reading window, and that is the whole of how steering and
 * hover get along. Inside it the room is still and the cursor picks out
 * whatever it is over; outside it the cursor is turning the room and picks out
 * nothing. Two controls that never fight, on one rule.
 *
 * The alternative — hover everywhere, steering damped while hovering — was
 * tried and does not survive contact with the wall this size: frames cover
 * most of the screen, so the cursor is almost always over one, so the steering
 * is almost always damped, so pointing at the room barely moves it.
 *
 * 0.33 of the half-viewport is a window of about 490×280 on a 1456×840 screen,
 * which sits where the hero copy already is. Frames are read by turning them
 * into it, which is what looking at something means.
 */
const STEER_DEAD = 0.33
/** Radians per second of yaw at full deflection. A full turn in about six
 *  seconds with the cursor pinned to the edge. */
const STEER_YAW = 1.15
/** Radians per second of pitch. Shallower, because the band is shallow. */
const STEER_PITCH = 0.4
/** Parallax lean, in radians at full deflection. */
const LOOK_YAW = 0.1
const LOOK_PITCH = 0.05

/**
 * Deadzoned, squared response for one steering axis.
 *
 * Squared rather than linear so the middle of the screen is gentle and the
 * edges are quick. A linear response makes every stray mouse movement shove
 * the room, which is the failure mode that made the last version feel like a
 * glitch rather than a camera.
 */
function steerAxis(v: number) {
  const a = Math.abs(v)
  if (a <= STEER_DEAD) return 0
  const t = (a - STEER_DEAD) / (1 - STEER_DEAD)
  return Math.sign(v) * Math.min(1, t * t)
}

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
 * A backstop, not the real cull — that is now the projected box below, which
 * knows the actual viewport. These angles only have to sit outside any screen
 * anyone might have: at 1.34rad a frame lands 2800px from centre, past the
 * edge of a 5K display, so nothing visible is ever touched by this fade.
 *
 * They used to be 1.02/1.36, and 1.02 is exactly the edge angle of a 2560px
 * monitor — every frame along both edges of a wide display was being faded out
 * for no reason at all.
 */
const FOV_FADE = 1.34
const FOV_CULL = 1.46

/** Nearest a tile may come to the eye before it is skipped, in px. Guards the
 *  divide-by-depth: a tile at the eye projects to infinity. Only ever reached
 *  well off the side of the screen, so it can never pop in view. */
const NEAR_CLIP = 150

/** How far outside the viewport a tile's projected box may sit before it stops
 *  being drawn. Generous, so a frame is never cut while any of it could show. */
const OFFSCREEN_MARGIN = 260

/**
 * Insets on the projected box for hover, as a fraction of its size.
 *
 * Asymmetric on purpose. Taking focus asks for the cursor to be properly
 * inside the picture; keeping it allows a little slop past the edge. Without
 * that hysteresis a frame drifting under a still cursor flickers on and off
 * along its own border several times a second, which is half of what read as
 * glitching.
 */
const HOVER_GAIN = 0.12
const HOVER_KEEP = -0.06

/** Just under a right angle: tan() is asked for the edges of a tile's angular
 *  span, and beyond this it flips sign and the box turns inside out. */
const ANGLE_LIMIT = Math.PI / 2 - 0.02

/**
 * Stacking order for the hover treatment.
 *
 * Depth gives every tile a z-index of 0..1000. The veil sits above all of
 * them and the focused frame sits above the veil, which is the whole trick:
 * one full-screen `backdrop-filter` softens everything painted below it, and
 * the frame being read is painted above and so is untouched.
 */
const VEIL_Z = 1100
const FOCUS_Z = 1200

/** How long the veil takes to come and go. */
const VEIL_MS = 420

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
 * A shell of stage frames hung around the viewer, who turns inside it.
 *
 * The React tree renders once and then stays still: all motion is written
 * straight to `style.transform` from a single rAF loop. Tiles are placed once,
 * at a bearing and an elevation, and never move again — the loop only changes
 * where the viewer is looking, and the horizon goes round forever with no seam.
 *
 * The loop is careful about three things, and each of them was a stutter:
 *  - it measures nothing. Every frame's box on screen is computed from the
 *    same projection that produced its transform, so hover and the decoder
 *    budget never ask the DOM anything and never force a layout.
 *  - it draws only what is on screen. A frame whose projected box misses the
 *    viewport is skipped outright, which is about twenty tiles a frame rather
 *    than eighty.
 *  - it writes only what changed. Transform, opacity, z-index and shading each
 *    carry their last value, so a still room costs nothing.
 *
 * Only the nearest dozen carry live footage — see MAX_PLAYING. Everything
 * else holds a poster, which is what keeps this a wall and not a stack of
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
        // Authoritative: sizes below are given on screen, and the layout
        // solves each tile's cut width against this lens.
        focal: isMobile ? PERSPECTIVE_MOBILE : PERSPECTIVE,
        // A shallower band on a phone. The desktop shell deliberately hangs a
        // third of the work off the top and bottom of the frame, which is a
        // luxury a 700px-tall screen cannot afford — there it just reads as
        // most of the catalogue being missing.
        elevationSpread: isMobile ? 0.44 : DEFAULT_CLOUD.elevationSpread,
        // Smaller than desktop in absolute px, but far larger relative to the
        // viewport: a phone is where the frames were smallest of all.
        minScreen: isMobile ? 130 : DEFAULT_CLOUD.minScreen,
        maxScreen: isMobile ? 300 : DEFAULT_CLOUD.maxScreen,
      }),
    [performances, repeats, isMobile],
  )

  /**
   * The hover veil, mounted only while it is needed.
   *
   * `veil` keeps the sheet in the tree, `veilOn` runs its opacity. Two states
   * rather than one because a `backdrop-filter` is not free to leave sitting
   * on the page: at zero opacity browsers will still keep the blurred copy of
   * the backdrop up to date, and this page is eighty moving pictures. So the
   * sheet is mounted a frame before it fades in, and unmounted only after it
   * has finished fading out.
   */
  const [veil, setVeil] = useState(false)
  const [veilOn, setVeilOn] = useState(false)
  useEffect(() => {
    if (hovered) {
      setVeil(true)
      // Next frame, so the element is in the tree at opacity 0 first and the
      // transition has something to run from.
      const id = requestAnimationFrame(() => setVeilOn(true))
      return () => cancelAnimationFrame(id)
    }
    setVeilOn(false)
    const id = window.setTimeout(() => setVeil(false), VEIL_MS)
    return () => clearTimeout(id)
  }, [hovered])

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
    // goes round forever. This is now one way in among three — the cursor
    // steers and the hand drags — rather than the only one.
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

    /** The lens in play. Layout is built against the same one. */
    const P = isMobile ? PERSPECTIVE_MOBILE : PERSPECTIVE

    let raf = 0
    let last = 0
    let tick = 0
    /** Timestamp the ambient drift began, for the spin-up ramp. */
    let started = 0

    // Cached rather than read per frame: `innerWidth` can force the engine to
    // settle pending style work before it answers, and this loop has just
    // written a transform to every frame on screen.
    let vw = window.innerWidth
    let vh = window.innerHeight
    const onResize = () => {
      vw = window.innerWidth
      vh = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    const conceal = (entry: TileRefs) => {
      if (!entry.hidden) {
        entry.hidden = true
        entry.lastAlpha = 0
        entry.root.style.opacity = '0'
      }
      entry.depth = 0
    }

    const setFocus = (key: string | null) => {
      if (hoveredRef.current === key) return
      hoveredRef.current = key
      setHovered(key)
      const tile = key ? cloudRef.current.find((t) => t.key === key) : null
      onFocusChangeRef.current?.(tile?.performance ?? null)
    }

    /**
     * Works out which frame the cursor is over, from the boxes the write phase
     * just computed.
     *
     * The room turns continuously, so a tile slides under a stationary cursor
     * and CSS alone never fires pointerenter — focus has to be resolved here.
     * It used to be resolved by asking every registered element for its
     * `getBoundingClientRect`, twenty times a second, each call having to
     * settle the style writes the loop had just made. The projection is exact
     * arithmetic, so the boxes are already known and this reads nothing: over
     * ten seconds of drifting, steering and hovering, style recalculations
     * fell from 636 to 484 and scripting from 335ms to 291ms.
     */
    const resolveFocus = () => {
      const { x, y } = pointer.client.current
      if (x < 0) return setFocus(null)

      const held = hoveredRef.current
      let best: string | null = null
      let bestDepth = -1

      registry.current.forEach((e) => {
        if (e.hidden || e.depth <= bestDepth) return
        const l = e.left!
        const r = e.right!
        const tp = e.top!
        const b = e.bottom!
        const inset = e.tile.key === held ? HOVER_KEEP : HOVER_GAIN
        const ix = (r - l) * inset
        const iy = (b - tp) * inset
        if (x < l + ix || x > r - ix) return
        if (y < tp + iy || y > b - iy) return
        best = e.tile.key
        bestDepth = e.depth
      })

      setFocus(best)
    }

    /**
     * Hands the decoder budget to the nearest frames on screen.
     *
     * Ranked by depth, so footage goes to the big ones at the front — where
     * motion actually reads — and the ones that lose it are far, small and
     * shaded, where a still is indistinguishable.
     *
     * One clip per performance: the shell hangs `repeats` copies of the
     * catalogue, so without this the same eight seconds can hold two decoders
     * at once for no visible gain.
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
      const near: { key: string; slug: string; rank: number }[] = []

      registry.current.forEach((e) => {
        // `hidden` already covers both behind-the-viewer and off-screen, so
        // there is nothing left to test against the viewport here.
        if (e.hidden) return
        if (e.right! - e.left! < PLAY_MIN_WIDTH) return
        near.push({
          key: e.tile.key,
          slug: e.tile.performance.slug,
          rank: e.depth + (prev.has(e.tile.key) ? PLAY_STICKY : 0),
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

    /** Screen offset, in px, of a point at this bearing off the view axis. */
    const project = (angle: number) =>
      P * Math.tan(clamp(angle, -ANGLE_LIMIT, ANGLE_LIMIT))

    const frame = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16.667
      last = now
      const f = dt / 16.667
      const secs = dt / 1000

      const pt = pointer.step(f)
      const focus = hoveredRef.current

      /* ---- input: the cursor steers, and drift fills the gaps ---- */
      let steering = 0
      if (!isMobile && pointer.client.current.x >= 0) {
        const sx = steerAxis(pt.x)
        const sy = steerAxis(pt.y)
        steering = Math.max(Math.abs(sx), Math.abs(sy))
        targetYaw.current += sx * STEER_YAW * secs
        targetPitch.current = clamp(
          targetPitch.current + sy * STEER_PITCH * secs,
          -PITCH_LIMIT,
          PITCH_LIMIT,
        )
      }

      // The room turns gently on its own — but only while nobody is steering
      // it, and not at all while a frame is being read.
      if (!focus && !reduced) {
        if (!started) started = now
        const age = (now - started) / 1000
        const spin = age >= SPIN_UP ? 1 : 1 - Math.pow(1 - age / SPIN_UP, 3)
        targetYaw.current += DRIFT * spin * (1 - steering) * f
      }

      const ease = 1 - Math.pow(1 - 0.075, f)
      yaw.current += (targetYaw.current - yaw.current) * ease
      pitch.current += (targetPitch.current - pitch.current) * ease

      const t = now / 1000
      const cx = vw / 2
      const cy = vh / 2

      // The parallax lean, on top of the heading the steering has built up.
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
        if (away > FOV_CULL) return conceal(entry)

        // Barely there. A 14px bob on every tile made the whole thing
        // shimmer; at this amplitude it reads as the room breathing.
        const float = reduced ? 0 : Math.sin(t * 0.32 + tile.phase) * 0.0016
        const e = tile.elevation - viewPitch + float

        const cosA = Math.cos(a)
        const cosE = Math.cos(e)
        const R = tile.radius

        // Straight spherical-to-camera. D is the distance in front of the
        // eye; on a shell the flanks swing close, so it falls off sharply
        // toward the edges of vision and those tiles read large.
        const D = R * cosA * cosE
        if (D < NEAR_CLIP) return conceal(entry)

        // Where the frame lands on screen, in closed form.
        //
        // The projection is rectilinear — a point at bearing θ lands at
        // P·tan(θ) from centre — and a tile of width w hung at radius R
        // subtends ±atan(w / 2R·cos e) about its own bearing, so its edges are
        // just two more tangents. Height is the same about its elevation, with
        // the 1/cos a that a horizontal angle adds to everything vertical.
        // Nothing here has to be measured.
        const phi = Math.atan2(tile.width / 2, R * cosE)
        const psi = Math.atan2(tile.width / tile.aspect / 2, R)
        const left = cx + project(a - phi)
        const right = cx + project(a + phi)
        const top = cy - project(e + psi) / cosA
        const bottom = cy - project(e - psi) / cosA

        // The real cull: a frame with no part of it near the viewport costs
        // nothing to skip, and skipping it is what keeps the number of tiles
        // being transformed each frame at what is actually on screen — about
        // twenty — rather than every one within the angular field.
        if (
          right < -OFFSCREEN_MARGIN ||
          left > vw + OFFSCREEN_MARGIN ||
          bottom < -OFFSCREEN_MARGIN ||
          top > vh + OFFSCREEN_MARGIN
        ) {
          return conceal(entry)
        }

        entry.left = left
        entry.right = right
        entry.top = top
        entry.bottom = bottom

        const X = R * Math.sin(a) * cosE
        const Y = -R * Math.sin(e)

        // Deliberately not toggling `visibility`: that invalidates layout on
        // every change, and the loop would then be forcing a reflow every time
        // a frame crossed the edge of the screen. Opacity alone stays on the
        // compositor.
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
        const transform =
          `perspective(${P}px) ` +
          `translate3d(${X.toFixed(1)}px, ${Y.toFixed(1)}px, ${(P - D).toFixed(1)}px) ` +
          `rotateY(${(-a).toFixed(4)}rad) ` +
          `rotateX(${(-e).toFixed(4)}rad)`
        // Composing the string is cheap; handing it to the style system is
        // not, and while a frame is being read the room is still and every
        // one of these is identical to the last.
        if (transform !== entry.lastTransform) {
          entry.lastTransform = transform
          root.style.transform = transform
        }

        // Paint order is DOM order without a shared 3D context, so depth has
        // to drive z-index — which also decides what the focused frame sits in
        // front of, including the veil that softens everything behind it.
        const z = focus === tile.key ? FOCUS_Z : Math.round(depth * 1000)
        if (z !== entry.lastZ) {
          entry.lastZ = z
          root.style.zIndex = String(z)
        }

        // Wash out toward the edge of vision so nothing pops in at the
        // shoulder. With the box cull above doing the real work this almost
        // never fires, which is the point: it is a backstop.
        const alpha =
          Math.round((1 - smoothstep(FOV_FADE, FOV_CULL, away)) * 200) / 200
        if (alpha !== entry.lastAlpha) {
          entry.lastAlpha = alpha
          root.style.opacity = String(alpha)
        }

        // Light. The reference sits close to the footage's own brightness and
        // only the far shell falls away; a heavy veil greys everything into a
        // smudge where nothing separates from its neighbours.
        const shading = clamp(0.24 - depth * 0.24, 0, 0.24)
        // Focus steps the room back; it does not clear it away. The veil below
        // is what separates the picture from its surroundings, so all this has
        // to do is take a little light off, and 0.16 is a little.
        const dim =
          Math.round(
            (focus === tile.key
              ? 0
              : focus
                ? Math.min(0.4, shading + 0.16)
                : shading) * 200,
          ) / 200
        if (dim !== entry.lastShade) {
          entry.lastShade = dim
          shade.style.opacity = String(dim)
        }
      })

      // Both of these read the boxes written just above, in the same frame, so
      // hover no longer trails the picture it is meant to be over.
      //
      // Nothing is focused while the room is being turned: a frame is read by
      // bringing it into the still centre, not by chasing it around the edge
      // of the screen. It also means the veil — the one genuinely expensive
      // thing on the page — is only ever up while nothing is moving.
      tick++
      if (steering > 0) setFocus(null)
      else resolveFocus()
      if (tick === 1 || tick % 20 === 0) updatePlaying()

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [repeats, reduced, pointer, maxPlaying, isMobile])

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

        {/* The hover treatment.

            The last version put `filter: blur()` on this whole container, which
            does two things wrong. It blurs the focused frame too — a filter
            applies to the entire subtree, and no amount of z-index lifts a
            child out of its own parent's filter — and it collapses eighty
            independently composited layers into one surface that has to be
            re-rasterised every frame while they move, which is a fair share of
            the glitching.

            A `backdrop-filter` on a single sheet does what was actually wanted:
            it softens what is already painted beneath it and leaves the tiles
            as their own layers. The focused frame is given a z-index above the
            sheet, so it stays sharp and lit while its surroundings step back a
            little — which is all Sneha asked for. */}
        {veil && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              zIndex: VEIL_Z,
              opacity: veilOn ? 1 : 0,
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
              backgroundColor: 'rgba(4,7,15,0.26)',
              transition: `opacity ${VEIL_MS}ms var(--ease-out-expo)`,
              willChange: 'opacity',
            }}
          />
        )}
      </div>

      {/* Keeps the hero copy sitting on darkness no matter what flies past.

          Lightened hard. These two used to stack 0.92 black over the middle of
          the screen and 0.9 over the corners, which between them passed about
          a third of the wall's light and is most of why the frames read as
          barely there. The copy over the top carries `on-scrim`, a heavy
          text-shadow, and does not need the page blacked out behind it to be
          legible. */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'radial-gradient(ellipse 44% 36% at 50% 50%, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.34) 48%, transparent 76%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_46%,rgba(0,0,0,0.66)_100%)]" />

      {/* Edge scrims: the wall runs behind the wordmark and the bottom links,
          and a bright tile drifting past must never eat them.

          The bottom one was the heavier of the two — 224px of near-solid black
          — and it is a third of the frame. Measured band luminance across the
          page ran 18 / 59 / 27 / 17 / 4 / 5 from top to bottom: the room had no
          floor, and most of that was this. Lightened to the weight the top one
          carries, which the links' own text-shadow is more than able to sit
          on. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-void via-void/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-48 bg-gradient-to-t from-void/95 via-void/55 to-transparent" />
    </div>
  )
}
