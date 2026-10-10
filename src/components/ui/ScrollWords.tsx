import { Fragment, useRef } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

interface Props {
  text: string
  className?: string
}

interface Token {
  word: string
  gilt: boolean
  /** Whether the copy has a space before this word. */
  spaced: boolean
}

/**
 * The copy, split into words, with `*marked phrases*` flagged.
 *
 * Asterisks rather than a list of words kept beside the copy: the emphasis has
 * to survive the copy being edited, and a list kept apart from the prose falls
 * out of step with it the first time a sentence is reworded. A stray asterisk
 * with no partner marks the rest of the paragraph, which is visible at once
 * and fixed by deleting it.
 */
function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  // Carried across the asterisks, so `*sound*.` keeps its full stop on the
  // word instead of setting it a space apart.
  let spaced = false
  text.split('*').forEach((run, i) => {
    for (const part of run.split(/(\s+)/)) {
      if (!part) continue
      if (/^\s/.test(part)) {
        spaced = true
        continue
      }
      tokens.push({ word: part, gilt: i % 2 === 1, spaced })
      spaced = false
    }
  })
  return tokens
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
 * It is position, not an entrance: scroll back up and the words go back down,
 * so the lit edge always sits where the reader is.
 *
 * Phrases marked `*like this*` in the copy are set in brass, the site's one
 * accent, and light the same way — dim brass to full — so the emphasis is
 * there from the start and only its strength follows the reader.
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

  const words = tokenize(text)

  if (reduced)
    return (
      <p className={className}>
        {words.map(({ word, gilt, spaced }, i) => (
          <Fragment key={i}>
            {i > 0 && spaced && ' '}
            <span className={cn(gilt && 'text-gilt')}>{word}</span>
          </Fragment>
        ))}
      </p>
    )

  return (
    // Real spaces between the words rather than a margin on each: spaced by
    // CSS, the paragraph copies out and reads aloud as one run-on word.
    <p ref={ref} className={className}>
      {words.map(({ word, gilt, spaced }, i) => (
        <Fragment key={`${word}-${i}`}>
          {i > 0 && spaced && ' '}
          <Word
            gilt={gilt}
            progress={scrollYProgress}
            // Ramps overlap by design: a hard hand-off word to word reads as a
            // ticker, while overlapping keeps a soft leading edge moving
            // through the sentence.
            start={(i / words.length) * 0.85}
            end={(i / words.length) * 0.85 + 0.18}
          >
            {word}
          </Word>
        </Fragment>
      ))}
    </p>
  )
}

function Word({
  progress,
  start,
  end,
  gilt,
  children,
}: {
  progress: MotionValue<number>
  gilt: boolean
  start: number
  end: number
  children: string
}) {
  const opacity = useTransform(progress, [start, end], [0.14, 1], {
    clamp: true,
  })
  return (
    <motion.span style={{ opacity }} className={cn(gilt && 'text-gilt')}>
      {children}
    </motion.span>
  )
}
