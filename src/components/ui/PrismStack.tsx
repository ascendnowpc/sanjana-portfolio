import { useId } from 'react'
import { motion } from 'framer-motion'
import { lerp } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'

/**
 * The violet-to-blue cascade down the left of the listening shelf.
 *
 * A copy of one thing: the stack of bars on history.mu.se. Three properties
 * of that stack are the whole drawing, and all three have to move together.
 *
 * **The bars are skewed, not rotated.** Every end is a vertical cut, which is
 * what makes the stepped silhouette read as clean notches rather than a fan of
 * blades — and it is why the reference's top bars look thinner than its bottom
 * ones despite every bar being the same slab: a skew leaves the vertical
 * height alone, so the *perpendicular* thickness thins as the slant steepens.
 * Rotating rectangles instead gets the colours and the stagger right and the
 * shape wrong.
 *
 * **The slant flattens as the stack descends** — 33° at the top, out to almost
 * level at the bottom. Hold it constant and the bars stop cascading and become
 * a striped ramp.
 *
 * **The stack walks left as fast as it walks down.** Ten steps of it move the
 * bars the better part of their own length, so the composition ends up half
 * again as wide as a single bar. This is the one that is easy to under-do, and
 * under-doing it is what turns the cascade into a pile.
 *
 * The reference hangs a headline number across the middle of it. That is
 * theirs; this panel carries no type at all.
 */

/** Every bar is the same slab — only the slant and the offset change. */
const BAR = { width: 620, height: 115 }

const BARS = 12

/** Slant of the top and bottom bars, in degrees off level. */
const SLANT = { top: 31, bottom: 5 }

/** How far a bar sits from the one above it. */
const STEP = { x: -55, y: 100 }

/**
 * The colours the stack runs through, top to bottom: deep indigo, into
 * violet, into indigo-blue, out to a bright cornflower.
 *
 * The reference's colour is a single diagonal gradient laid across the whole
 * cascade — dark at the top right, bright at the bottom left — and that is
 * what the sampling below reproduces: a bar takes its colour from its depth in
 * the stack, and its *left* end samples a little further along the ramp than
 * its right, which is the same gradient read across one bar. Solid fills would
 * give the stack its values but not its light.
 */
const RAMP = ['#3a189f', '#5622e6', '#4e33f6', '#3f6bfd']

/** Distance along the ramp between a bar's right end and its left end. */
const RAKE = 0.09

function sampleRamp(u: number) {
  const x = Math.min(Math.max(u, 0), 1) * (RAMP.length - 1)
  const i = Math.min(Math.floor(x), RAMP.length - 2)
  const t = x - i
  const channel = (offset: number) =>
    Math.round(
      lerp(
        parseInt(RAMP[i].slice(offset, offset + 2), 16),
        parseInt(RAMP[i + 1].slice(offset, offset + 2), 16),
        t,
      ),
    )
  return `rgb(${channel(1)}, ${channel(3)}, ${channel(5)})`
}

/**
 * The stack, as four corners a bar.
 *
 * Written out as points rather than a `<rect>` under a skew transform because
 * the bounding box is wanted anyway — the viewBox below is measured off the
 * geometry rather than guessed, so changing the constants above cannot leave
 * the drawing cropped or adrift in its own frame.
 */
const BARS_GEOMETRY = Array.from({ length: BARS }, (_, i) => {
  const t = i / (BARS - 1)
  /* Rise across half a bar: the left end drops by this much and the right end
     lifts by it, which is a skew about the bar's own centre. */
  const rise =
    (BAR.width / 2) * Math.tan((lerp(SLANT.top, SLANT.bottom, t) * Math.PI) / 180)
  const cx = STEP.x * i
  const cy = STEP.y * i
  const [xl, xr] = [cx - BAR.width / 2, cx + BAR.width / 2]
  const [yl, yr] = [cy + rise, cy - rise]
  const h = BAR.height / 2

  return {
    points: `${xl},${yl - h} ${xr},${yr - h} ${xr},${yr + h} ${xl},${yl + h}`,
    box: { x0: xl, x1: xr, y0: yr - h, y1: yl + h },
    left: sampleRamp(Math.min(t + RAKE, 1)),
    right: sampleRamp(t),
  }
})

/** The drawing's own frame, taken from the bars rather than assumed. */
const VIEW_BOX = (() => {
  const x0 = Math.min(...BARS_GEOMETRY.map((b) => b.box.x0))
  const x1 = Math.max(...BARS_GEOMETRY.map((b) => b.box.x1))
  const y0 = Math.min(...BARS_GEOMETRY.map((b) => b.box.y0))
  const y1 = Math.max(...BARS_GEOMETRY.map((b) => b.box.y1))
  return `${x0} ${y0} ${x1 - x0} ${y1 - y0}`
})()

/** Bars arrive one after another, down the stack, on the page's own expo. */
const CASCADE = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
}

const BLADE = {
  hidden: { opacity: 0, x: 58, y: -38 },
  shown: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration: 1.1, ease: [0.16, 1, 0.3, 1] as const },
  },
}

export function PrismStack({ className }: { className?: string }) {
  const still = usePrefersReducedMotion()
  /* One gradient a bar, and the ids have to be unique to the document — a
     second stack anywhere on the page would otherwise repaint the first.
     React's id comes wrapped in colons, which a `url(#…)` is better off
     without. */
  const uid = useId().replace(/:/g, '')

  return (
    <div aria-hidden className={className}>
      <motion.svg
        viewBox={VIEW_BOX}
        /* Filled and cropped, not fitted. The reference runs its cascade off
           the left edge of the page and lets the bottom bars leave the frame,
           and that cut is half of why it reads as scenery rather than as an
           illustration parked in a box. `xMaxYMid slice` keeps the deep end —
           the top right, where the stack is densest — against the card it
           shares the row with, and spends the overflow on the left, which is
           the edge the reference spends it on too. */
        preserveAspectRatio="xMaxYMin slice"
        className="h-full w-full"
        variants={CASCADE}
        initial={still ? false : 'hidden'}
        whileInView="shown"
        viewport={{ once: true, margin: '-80px' }}
      >
        <defs>
          {BARS_GEOMETRY.map((b, i) => (
            <linearGradient key={i} id={`${uid}-bar-${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={b.left} />
              <stop offset="1" stopColor={b.right} />
            </linearGradient>
          ))}
        </defs>

        {/* Painted top down, so each bar lies over the one above it — the way
            a fanned deck stacks, and the only reason the overlaps read as
            edges rather than as one continuous field. */}
        {BARS_GEOMETRY.map((b, i) => (
          <motion.g key={i} variants={BLADE}>
            <polygon points={b.points} fill={`url(#${uid}-bar-${i})`} />
          </motion.g>
        ))}
      </motion.svg>
    </div>
  )
}
