import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { useUi } from '@/content/ContentProvider'

interface Props {
  /**
   * The visitor's answer. `true` is *with sound*, and it is called from inside
   * the click itself so whoever is listening can start playback in that same
   * gesture — which is the only moment a browser will allow it.
   */
  onChoose: (withSound: boolean) => void
}

/*
 * The invitation, word by word, lives in the editable copy now — `ui.soundGate
 * .words`, each with its own `size` and `drop`.
 *
 * It is not a stack of left-aligned lines: each word starts where the last one
 * ended and sits a little lower, so the sentence falls across the middle of
 * the screen on a diagonal. `drop` is that fall, in ems of the word's own
 * line, and `size` is the small variation between words that keeps the run
 * from reading as one mechanically rotated line. Both are on the panel, which
 * means a rewritten sentence can be re-laid rather than re-typeset in code.
 */

/**
 * The question the index opens on: sound, or no sound.
 *
 * It exists because of a rule rather than a taste. Audible playback needs a
 * press, a tap or a key — cursor movement and scrolling do not count — and the
 * page behind this asks only for a cursor, so without something to press its
 * recording could sit there unheard for the whole visit. A gate turns that
 * constraint into the one thing it can honestly be: a question, asked once,
 * before anything has started.
 *
 * The whole panel is the *yes*, which is what makes the instruction literally
 * true — anywhere means anywhere — and the *no* is a single line at the foot
 * of it. Both are real buttons rather than a div with a handler, so the
 * keyboard gets the same two choices in the same order, and both answers are
 * remembered for the visit: this is asked once, not at every return to the
 * index.
 *
 * The words fall diagonally rather than sitting in a block. A centred line of
 * tracked capitals reads as a system message — *cookies, accept* — and this is
 * closer to a title card: it wants to be read at the pace it is laid out.
 *
 * Rendered into `document.body` rather than where it is written. The index is
 * a fixed, full-screen element, which is its own stacking context, so a panel
 * nested inside it can be given any z-index at all and still come out
 * underneath the navigation — which sits in the root context at z-50. The
 * portal puts this in the same context as the bar it has to cover.
 */
export function SoundGate({ onChoose }: Props) {
  const reduced = usePrefersReducedMotion()
  const ui = useUi()
  const line = ui.soundGate.words

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[80] bg-void"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // Leaves faster than it arrives, and faster than the room's opening
      // hold: the establishing shot behind this is held until the answer, so
      // the panel wants to be gone before the pull starts rather than fading
      // across the first half of it.
      exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.5 } }}
      transition={{ duration: reduced ? 0 : 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* The yes. It is the surface, not a target on it. */}
      <button
        type="button"
        onClick={() => onChoose(true)}
        className="group absolute inset-0 flex cursor-pointer flex-col items-center justify-center px-6"
        aria-label={ui.soundGate.enterLabel}
      >
        {/* One line, held on one line: the diagonal is the whole figure, and
            a wrap would break it into two unrelated ones. The size is in vw
            below the cap for that reason — it is what keeps the run inside a
            narrow screen. */}
        <span
          className="tracked-tight block whitespace-nowrap text-mist transition-colors duration-700 group-hover:text-chalk"
          // The fall is drawn with transforms, which take up no room, so the
          // box would be one line tall and the figure would hang below the
          // middle of the screen. The padding gives the fall its height back
          // and lets the flex centre the whole diagonal.
          style={{
            fontSize: 'clamp(0.58rem, 1.45vw, 1.05rem)',
            paddingBottom: '6.4em',
          }}
        >
          {line.map(({ word, size, drop }, i) => (
            <motion.span
              key={`${word}-${i}`}
              className="inline-block"
              style={{ fontSize: `${size}em` }}
              initial={
                reduced
                  ? false
                  : { opacity: 0, y: `${drop + 0.6}em`, filter: 'blur(4px)' }
              }
              animate={{ opacity: 1, y: `${drop}em`, filter: 'blur(0px)' }}
              transition={{
                duration: 1,
                delay: reduced ? 0 : 0.35 + i * 0.13,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {word}
              {/* The space belongs to the word before it, so it carries that
                  word's size and drop rather than the next one's. */}
              {i < line.length - 1 ? '\u00a0' : ''}
            </motion.span>
          ))}
        </span>
      </button>

      {/* The no. Inside the panel but above it, so the press that declines is
          not also the press that accepts. */}
      <motion.div
        className="absolute inset-x-0 bottom-14 flex justify-center px-6 md:bottom-20"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: reduced ? 0 : 1.1 }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onChoose(false)
          }}
          className="label border-b border-dust/40 pb-2 text-dust transition-colors duration-500 hover:border-chalk hover:text-chalk"
        >
          {ui.soundGate.decline}
        </button>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
