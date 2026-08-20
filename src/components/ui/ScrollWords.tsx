import { useRef } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

interface Props {
  text: string
  className?: string
}

/**
 * A paragraph that lights up as it is read.
 *
 * Each word carries its own opacity ramp, keyed to how far the block has
 * travelled up the viewport, so the sentence resolves out of the dark left to
 * right at exactly the pace the reader is scrolling. It is the difference
 * between copy that *appeared* and copy that is being *told* — and it is the
 * one treatment on the page that makes a long prose block worth scrolling
 * slowly.
 *
 * Deliberately not applied to every paragraph on the site: used everywhere it
 * would become a tic, and unreadable on anything long.
 */
export function ScrollWords({ text, className }: Props) {
  const ref = useRef<HTMLParagraphElement>(null)
  const reduced = usePrefersReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    // Measured start-of-block to end-of-block, not start to start: keyed off
    // the start alone, a long paragraph runs out of scroll before its last
    // words have lit and the tail sits permanently dim.
    offset: ['start 0.92', 'end 0.55'],
  })

  const words = text.split(' ')

  if (reduced) return <p className={className}>{text}</p>

  return (
    <p ref={ref} className={cn('flex flex-wrap', className)}>
      {words.map((word, i) => (
        <Word
          key={`${word}-${i}`}
          progress={scrollYProgress}
          // Ramps overlap by design: a hard hand-off word to word reads as a
          // ticker, while overlapping keeps a soft leading edge moving through
          // the sentence.
          start={(i / words.length) * 0.85}
          end={(i / words.length) * 0.85 + 0.18}
        >
          {word}
        </Word>
      ))}
    </p>
  )
}

function Word({
  progress,
  start,
  end,
  children,
}: {
  progress: MotionValue<number>
  start: number
  end: number
  children: string
}) {
  const opacity = useTransform(progress, [start, end], [0.14, 1], {
    clamp: true,
  })
  return (
    <motion.span style={{ opacity }} className="mr-[0.28em] inline-block">
      {children}
    </motion.span>
  )
}
