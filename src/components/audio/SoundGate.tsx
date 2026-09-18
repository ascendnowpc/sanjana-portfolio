import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'

interface Props {
  /**
   * The visitor's answer. `true` is *with sound*, and it is called from inside
   * the click itself so whoever is listening can start playback in that same
   * gesture — which is the only moment a browser will allow it.
   */
  onChoose: (withSound: boolean) => void
}

/** The words, in the order they descend. */
const LINE = ['Click', 'anywhere', 'to', 'turn on', 'your sound']

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

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[80] bg-void"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* The yes. It is the surface, not a target on it. */}
      <button
        type="button"
        onClick={() => onChoose(true)}
        className="group absolute inset-0 flex cursor-pointer flex-col items-center justify-center px-6"
        aria-label="Enter with sound"
      >
        <span className="flex flex-col items-start">
          {LINE.map((word, i) => (
            <motion.span
              key={word}
              className="tracked text-[clamp(0.85rem,2vw,1.6rem)] leading-[2] text-mist transition-colors duration-700 group-hover:text-chalk"
              // Each word starts where the last one ended, give or take — the
              // indent is what makes the line fall rather than stack.
              style={{ marginLeft: `${i * 2.4}ch` }}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.9,
                delay: reduced ? 0 : 0.3 + i * 0.12,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {word}
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
          Enter without sound
        </button>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
