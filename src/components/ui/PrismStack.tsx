import { useId } from 'react'
import { motion } from 'framer-motion'
import { lerp } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'

/**
 * The fanned stack of violet-to-blue blades that fills the shelf's short
 * column.
 *
 * It is a copy of one thing and one thing only: the cascade down the left of
 * history.mu.se. Nine long bars, each rotated a little flatter than the one
 * above it and dropped down and to the left, so the stack reads as a deck
 * fanned open rather than a list of stripes. The reference hangs a headline
 * number across the middle of it; that is theirs, and it is deliberately not
 * here — this panel carries no type at all. It is the empty half of a row,
 * given something to do.
 *
 * Everything below is one composition in one viewBox rather than nine
 * positioned elements, because the shape only works if the three things that
 * change down the stack — angle, drop, length — stay locked to each other.
 * Tune the endpoints, not the individual bars.
 */

/** The composition's own coordinate space. Roughly 5:7, as the reference is. */
const VIEW = { w: 640, h: 900 }

const BARS = 9

/**
 * The four colours the stack runs through, top to bottom: deep indigo, into
 * violet, into indigo-blue, out to a bright cornflower.
 *
 * The reference's colour is a single diagonal gradient laid across the whole
 * fan — dark at the top right, bright at the bottom left — and that is what
 * the sampling below reproduces: a bar takes its colour from its depth in the
 * stack, and its *left* end samples a little further along the ramp than its
 * right, which is the same gradient read across one blade. Solid fills, one
 * per bar, would give the stack its values but not its light.
 */
const RAMP = ['#38179a', '#5622e6', '#4e33f6', '#3f63fb']

/** Distance along the ramp between a bar's right end and its left end. */
const RAKE = 0.1

function sampleRamp(u: number) {
  const x = Math.min(Math.max(u, 0), 1) * (RAMP.length - 1)
  const i = Math.min(Math.floor(x), RAMP.length - 2)
  const t = x - i
  const a = RAMP[i]
  const b = RAMP[i + 1]
  const channel = (offset: number) =>
    Math.round(
      lerp(
        parseInt(a.slice(offset, offset + 2), 16),
        parseInt(b.slice(offset, offset + 2), 16),
        t,
      ),
    )
  return `rgb(${channel(1)}, ${channel(3)}, ${channel(5)})`
}

/**
 * One blade a step down the fan.
 *
 * The endpoints are chosen so the whole stack lands inside the viewBox with a
 * hair of margin — the reference runs its bottom bars off the left edge of the
 * page, which it can because it has a page to run off; a panel inside a column
 * has to hold itself. `angle` flattening as the stack descends is the single
 * most important number here: hold it constant and the bars stop fanning and
 * become a striped ramp.
 */
const BLADES = Array.from({ length: BARS }, (_, i) => {
  const t = i / (BARS - 1)
  return {
    angle: lerp(-31, -9, t),
    cx: lerp(385, 230, t),
    cy: lerp(180, 800, t),
    length: lerp(540, 430, t),
    thickness: 86,
    left: sampleRamp(Math.min(t + RAKE, 1)),
    right: sampleRamp(t),
  }
})

/** Bars arrive one after another, down the fan, on the same expo the page uses. */
const FAN = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
}

const BLADE = {
  hidden: { opacity: 0, x: 52, y: -34 },
  shown: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: { duration: 1.1, ease: [0.16, 1, 0.3, 1] as const },
  },
}

export function PrismStack({ className }: { className?: string }) {
  const still = usePrefersReducedMotion()
  /* One gradient a blade, and the ids have to be unique to the document —
     a second stack anywhere on the page would otherwise repaint the first.
     React's id comes wrapped in colons, which a `url(#…)` reference is
     better off without. */
  const uid = useId().replace(/:/g, '')

  return (
    <div aria-hidden className={className}>
      <motion.svg
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        /* Left-aligned, not centred. The card it shares the row with sits hard
           against the right of the shelf, so the fan holds the opposite edge
           and the black between them is the composition. */
        preserveAspectRatio="xMinYMid meet"
        className="h-full w-full overflow-visible"
        variants={FAN}
        initial={still ? false : 'hidden'}
        whileInView="shown"
        viewport={{ once: true, margin: '-80px' }}
      >
        <defs>
          {BLADES.map((b, i) => (
            <linearGradient key={i} id={`${uid}-blade-${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={b.left} />
              <stop offset="1" stopColor={b.right} />
            </linearGradient>
          ))}
        </defs>

        {/* Painted top down, so each blade lies over the one above it — the
            way a fanned deck stacks, and the only reason the overlaps read as
            edges rather than as one continuous field. */}
        {BLADES.map((b, i) => (
          <motion.g key={i} variants={BLADE}>
            <rect
              x={b.cx - b.length / 2}
              y={b.cy - b.thickness / 2}
              width={b.length}
              height={b.thickness}
              fill={`url(#${uid}-blade-${i})`}
              transform={`rotate(${b.angle} ${b.cx} ${b.cy})`}
            />
          </motion.g>
        ))}
      </motion.svg>
    </div>
  )
}
