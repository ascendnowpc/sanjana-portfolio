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

/*
 * The facts that are lit in brass without being marked: a school year
 * (`eighth grade`, `tenth and eleventh grade`) and a count with the thing it
 * counts (`eleven songs`, `ninety uninterrupted minutes`, `three of them
 * solos`). A number is the one kind of word that is always worth the reader's
 * eye in a bio, and finding them here rather than marking them in the copy
 * means they cannot be lost to an edit, or to a browser holding an older copy
 * of the text.
 *
 * A bare `one` is left alone — it is a pronoun as often as a number ("the one
 * I'd trained in") — and only counts when it is counting something.
 */
const ORDINAL =
  '(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|\\d+(?:st|nd|rd|th))'
const CARDINAL =
  '(?:\\d+(?:[.,]\\d+)*|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|dozen)(?:-\\w+)?'
const UNIT =
  '(?:minutes?|hours?|years?|songs?|solos?|shows?|roles?|productions?|performances?|concerts?|nights?|seasons?|languages?|awards?)'
const FACT = new RegExp(
  [
    `\\b${ORDINAL}(?:\\s+(?:and|&)\\s+${ORDINAL})?\\s+grade\\b`,
    `\\b(?:one|${CARDINAL})(?:\\s+[\\w']+){0,2}?\\s+${UNIT}\\b`,
    `\\b${CARDINAL}\\b`,
  ].join('|'),
  'gi',
)

/** A run of the copy, and whether it is set in brass. */
interface Run {
  text: string
  gilt: boolean
}

/**
 * The copy as runs: `*marked phrases*` first, then the facts above found in
 * whatever is left unmarked.
 *
 * Asterisks rather than a list of words kept beside the copy: the emphasis has
 * to survive the copy being edited, and a list kept apart from the prose falls
 * out of step with it the first time a sentence is reworded. A stray asterisk
 * with no partner marks the rest of the paragraph, which is visible at once
 * and fixed by deleting it.
 */
function runs(text: string): Run[] {
  const out: Run[] = []
  text.split('*').forEach((run, i) => {
    if (i % 2 === 1) {
      out.push({ text: run, gilt: true })
      return
    }
    let last = 0
    for (const match of run.matchAll(FACT)) {
      out.push({ text: run.slice(last, match.index), gilt: false })
      out.push({ text: match[0], gilt: true })
      last = match.index + match[0].length
    }
    out.push({ text: run.slice(last), gilt: false })
  })
  return out
}

/** The runs, split into words. */
function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  // Carried across runs, so `*sound*.` keeps its full stop on the word
  // instead of setting it a space apart.
  let spaced = false
  for (const run of runs(text)) {
    for (const part of run.text.split(/(\s+)/)) {
      if (!part) continue
      if (/^\s/.test(part)) {
        spaced = true
        continue
      }
      tokens.push({ word: part, gilt: run.gilt, spaced })
      spaced = false
    }
  }
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
 * Phrases marked `*like this*` in the copy, and the facts found in it (see
 * FACT), are set in brass, the site's one accent, and light the same way — dim brass to full — so the emphasis is
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
