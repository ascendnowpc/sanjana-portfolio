import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { smoothstep } from '@/lib/utils'

/**
 * The scattered points the About page sits on, and the cursor that pushes
 * them out of its way.
 *
 * Fixed to the viewport rather than to the document, which is the whole
 * character of the thing. A field that scrolls with the page reads as
 * wallpaper a few inches behind the text; one that holds still while three
 * thousand pixels of page slide across it reads as depth — the points are
 * far enough away to have no parallax, the way real ones do not. It is also
 * how the reference does it: the same points sit at the same screen
 * coordinates a screenful apart.
 *
 * Two tiles, not one, and both larger than the window they land in. A single
 * tile small enough to see repeat two or three times across a wide screen
 * gets found in about a second, and once it is found the field is a texture
 * rather than a sky. At 1400 and 900 neither quite repeats on a laptop, and
 * where they do on a bigger screen they disagree, because they share no
 * factor. Each tile's own points are spaced by rejection sampling measured
 * around the wrap, so neither has a seam or a clump of its own.
 *
 * Density is about twenty points a megapixel, which is roughly thirty in a
 * 1440×900 window and is a lot sparser than the first pass. Scattered points
 * stop reading as distance somewhere around double that and start reading as
 * noise over the page, and the correction is always downward: the field is
 * meant to be noticed second.
 *
 * The field is drawn to a canvas rather than tiled as a background image,
 * which is the one thing that changed when the cursor got hold of it: a
 * background image has no points in it to move, only a picture of some. The
 * tiles below are the same two the CSS carried, coordinate for coordinate,
 * so the sky at rest is the sky that was there before — the wrap, the
 * spacing and the offset between the layers are all preserved. What canvas
 * buys is a handle on each point.
 *
 * Still no ambient animation. Points that twinkle or drift on their own turn
 * a background into something the reader has to decide to ignore, and the
 * page already has one moving thing in it. This field only moves while the
 * reader is moving it, and the loop is not even running the rest of the
 * time — see the tail of the frame below, which parks itself the moment
 * everything is home again.
 */

/** `[cx, cy, r, opacity]`, in the tile's own coordinates. */
type Point = readonly [number, number, number, number]

interface Layer {
  /** Tile edge in px. The two share no factor, so they disagree where they repeat. */
  size: number
  /** Where the tile's origin sits against the top-left of the viewport. */
  origin: readonly [number, number]
  /**
   * How far a point of this layer travels when the cursor is right on it.
   *
   * The near layer moves nearly twice as far as the far one for the same
   * cursor, which is the only place in the field where the two names earn
   * themselves: parallax is impossible on a fixed field, so depth has to
   * come from how hard each layer answers.
   */
  reach: number
  points: readonly Point[]
}

const FAR: Layer = {
  size: 1400,
  origin: [0, 0],
  reach: 28,
  points: [
    [1244, 632, 1.1, 0.42],
    [866, 108, 1.2, 0.51],
    [1110, 1359, 1.6, 0.55],
    [764, 456, 1.3, 0.53],
    [17, 208, 1, 0.53],
    [466, 333, 1.9, 0.28],
    [953, 840, 2.1, 0.26],
    [965, 1205, 1.8, 0.34],
    [1371, 1301, 1.5, 0.63],
    [561, 1272, 1.6, 0.68],
    [755, 1275, 1.6, 0.58],
    [610, 928, 1.5, 0.5],
    [254, 1183, 2, 0.48],
    [397, 589, 1.6, 0.55],
    [1311, 819, 1.5, 0.57],
    [234, 185, 2.1, 0.55],
    [145, 536, 1.4, 0.31],
    [998, 247, 1.5, 0.4],
    [444, 1037, 2.1, 0.51],
    [242, 855, 1.3, 0.66],
    [715, 239, 1.3, 0.37],
    [839, 656, 1.1, 0.3],
    [491, 111, 1.9, 0.35],
    [628, 594, 1.5, 0.6],
  ],
}

const NEAR: Layer = {
  size: 900,
  // Pushed off the far tile's origin so the two do not both start their
  // pattern in the top-left corner, which is the one place a viewer would
  // otherwise see them agree.
  origin: [313, 487],
  reach: 46,
  points: [
    [281, 861, 1.7, 0.64],
    [531, 890, 1.6, 0.54],
    [298, 317, 1.9, 0.62],
    [51, 737, 1.6, 0.36],
    [61, 368, 1.2, 0.33],
    [742, 579, 2.1, 0.64],
    [640, 325, 1.6, 0.33],
  ],
}

const LAYERS = [FAR, NEAR]

/**
 * How close the cursor has to get before a point starts backing away, in px.
 *
 * Wider than it first wants to be. The field is sparse by design — around
 * thirty points in a laptop window, better than two hundred apart on
 * average — so a radius tuned to look right against a dense field would
 * spend most of its time touching nothing, and an effect that only fires
 * when you happen to sweep the exact spot is one nobody finds. At this
 * radius a couple of points answer wherever the cursor is, which is what
 * makes it read as the field reacting rather than as one dot twitching.
 */
const REACH = 190

/** Spring pulling a point toward where the cursor wants it, per 1/60s. */
const SPRING = 0.13
/** Velocity retained per step. Leaves it underdamped: one soft overshoot. */
const DAMPING = 0.72
/** Below this much residual travel and speed, a point counts as home. */
const REST = 0.01
/** The simulation's fixed step, so the spring feels the same at 60 and 144Hz. */
const STEP = 1000 / 60
/**
 * How far outside the viewport points are still kept. Only has to cover a
 * point being pushed off the edge — anything already outside is pushed
 * further out, never in — so the longest reach plus the largest radius does.
 */
const MARGIN = 60

const TAU = Math.PI * 2

interface Star {
  /** Home: where the point sits when nothing is disturbing it. */
  hx: number
  hy: number
  r: number
  a: number
  reach: number
  /** Current offset from home, and the velocity carrying it. */
  dx: number
  dy: number
  vx: number
  vy: number
}

/** Every tile position of both layers that lands in (or just outside) the window. */
function field(w: number, h: number): Star[] {
  const stars: Star[] = []
  for (const layer of LAYERS) {
    const [ox, oy] = layer.origin
    const i0 = Math.floor((-MARGIN - ox) / layer.size)
    const i1 = Math.floor((w + MARGIN - ox) / layer.size)
    const j0 = Math.floor((-MARGIN - oy) / layer.size)
    const j1 = Math.floor((h + MARGIN - oy) / layer.size)
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        for (const [cx, cy, r, a] of layer.points) {
          const hx = ox + i * layer.size + cx
          const hy = oy + j * layer.size + cy
          if (hx < -MARGIN || hx > w + MARGIN) continue
          if (hy < -MARGIN || hy > h + MARGIN) continue
          stars.push({ hx, hy, r, a, reach: layer.reach, dx: 0, dy: 0, vx: 0, vy: 0 })
        }
      }
    }
  }
  return stars
}

export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null)
  const still = usePrefersReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let stars: Star[] = []
    let w = 0
    let h = 0
    let raf = 0
    let last = 0
    let carry = 0
    /**
     * The cursor in viewport px. `on` is false before the pointer has ever
     * moved and again once it leaves the window, which is the difference
     * between "at the top-left corner" and "not here" — a field that treats
     * those the same shoves its own corner open on every page load.
     */
    const cursor = { x: 0, y: 0, on: false }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#ffffff'
      for (const s of stars) {
        ctx.globalAlpha = s.a
        ctx.beginPath()
        ctx.arc(s.hx + s.dx, s.hy + s.dy, s.r, 0, TAU)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    /**
     * Size the backing store to the box CSS gave us.
     *
     * Measured off the canvas rather than off `window.innerWidth`, which is
     * a hair wider wherever a scrollbar takes up room; a fixed layer laid
     * out to the wrong one sits a few px off the viewport it is pinned to.
     * Points snap home on a resize — the field is rebuilt for the new box,
     * and a resize is not a moment anyone is watching a dot.
     */
    const measure = () => {
      const nw = canvas.clientWidth
      const nh = canvas.clientHeight
      if (!nw || !nh) return
      w = nw
      h = nh
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      stars = field(w, h)
      draw()
    }

    const ro = new ResizeObserver(measure)
    ro.observe(canvas)
    measure()

    // Reduced motion gets the field exactly as it was drawn: still, and with
    // no loop and no listeners behind it.
    if (still) return () => ro.disconnect()

    /**
     * One 1/60s step of the whole field. True while anything is still moving.
     *
     * The push is measured from where each point *is*, not from its home, so
     * a point that has already given ground feels less of it and the field
     * settles into a clearing around the cursor instead of a fixed splay.
     * It also means the cursor never crosses a point's own centre and flips
     * its direction end for end in a single frame: the point slides around
     * the cursor and out, the way something being repelled does.
     */
    const settle = () => {
      let moving = false
      for (const s of stars) {
        let tx = 0
        let ty = 0
        if (cursor.on) {
          const px = s.hx + s.dx - cursor.x
          const py = s.hy + s.dy - cursor.y
          const d = Math.hypot(px, py)
          if (d < REACH) {
            // Smoothstep rather than a linear falloff so a point crossing
            // into reach eases in instead of being kicked.
            const f = (s.reach * smoothstep(REACH, 0, d)) / Math.max(d, 0.001)
            tx = px * f
            ty = py * f
          }
        }
        s.vx = (s.vx + (tx - s.dx) * SPRING) * DAMPING
        s.vy = (s.vy + (ty - s.dy) * SPRING) * DAMPING
        s.dx += s.vx
        s.dy += s.vy
        if (
          !moving &&
          (Math.abs(s.vx) > REST ||
            Math.abs(s.vy) > REST ||
            Math.abs(tx - s.dx) > REST ||
            Math.abs(ty - s.dy) > REST)
        ) {
          moving = true
        }
      }
      return moving
    }

    const frame = (now: number) => {
      // Clamped, because a tab that was in the background hands back a gap
      // of minutes and the field would fast-forward through all of it.
      carry += Math.min(now - last, 100)
      last = now

      let moving = false
      let steps = 0
      while (carry >= STEP && steps < 6) {
        if (settle()) moving = true
        carry -= STEP
        steps++
      }
      if (carry >= STEP) carry = 0
      if (steps) draw()

      // `steps` matters as much as `moving` here. A frame can arrive a
      // millisecond after the one that woke the loop, with less than a step's
      // worth of time banked and so nothing simulated yet — and a loop that
      // reads that as "at rest" parks itself before the field has moved at
      // all, then gets woken and parked again by every single pointer event.
      if (moving || steps === 0) {
        raf = requestAnimationFrame(frame)
        return
      }

      // Nothing is moving: stop the loop rather than redraw the same frame
      // sixty times a second for as long as the page is open. A pointer that
      // has left is also a field that should be exactly where it was
      // designed to be, down to the last fraction of a pixel.
      raf = 0
      if (!cursor.on) {
        for (const s of stars) {
          s.dx = 0
          s.dy = 0
          s.vx = 0
          s.vy = 0
        }
        draw()
      }
    }

    const wake = () => {
      if (raf) return
      last = performance.now()
      carry = 0
      raf = requestAnimationFrame(frame)
    }

    const onMove = (e: PointerEvent) => {
      // Touch only ever arrives mid-scroll, where a field scattering under
      // the thumb is a thing in the way rather than a thing to play with.
      if (e.pointerType === 'touch') return
      cursor.x = e.clientX
      cursor.y = e.clientY
      cursor.on = true
      wake()
    }

    const release = () => {
      if (!cursor.on) return
      cursor.on = false
      wake()
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', release)
    window.addEventListener('blur', release)

    return () => {
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', release)
      window.removeEventListener('blur', release)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [still])

  return (
    <canvas
      ref={ref}
      aria-hidden
      // The explicit 100% is not redundant with `inset-0`. A canvas is a
      // replaced element, so `width: auto` resolves to its intrinsic size —
      // the 300×150 every canvas is born with — and the `right`/`bottom` of
      // an inset are then dropped as over-constrained rather than stretching
      // it. Without these the field is measured, built and drawn inside a
      // 300×150 box in the corner of the page.
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-75"
    />
  )
}
