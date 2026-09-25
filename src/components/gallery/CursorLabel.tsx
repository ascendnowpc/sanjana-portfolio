import { useEffect, useLayoutEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'

interface Props {
  text: string
  /** A frame is being read. The label only exists while this is true. */
  visible: boolean
}

/** Where the label sits against the cursor, in px: below and to the right, so
 *  the pointer never covers the first letter. */
const OFFSET_X = 20
const OFFSET_Y = 22
/** Per-frame share of the distance to the cursor. Quick enough to feel held,
 *  slow enough that the words trail the hand a little rather than being
 *  bolted to it. */
const FOLLOW = 0.24

/**
 * The invitation on the index, carried by the cursor.
 *
 * It used to be printed across the bottom of the lit frame, which put type on
 * top of the footage it was inviting you to watch. Here it belongs to the
 * pointer instead: it arrives when a frame is taken, trails the hand while
 * the hand stays on it, and is gone as soon as the frame is let go.
 *
 * The letters are never quite still. Each one rises in on its own beat when
 * the label arrives and then keeps a slow swell running through the word —
 * see `letter-flow` in index.css — so it reads as something alive rather
 * than as a tooltip.
 *
 * Position is written straight to the transform from a rAF loop that only
 * runs while the label is on screen: the index is already turning eighty
 * frames on the main thread, and a re-render per mouse move would be a
 * strange thing to add to that.
 */
export function CursorLabel({ text, visible }: Props) {
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  /** Where the pointer is; kept even while hidden, so the label appears at
   *  the cursor rather than flying in from wherever it was last seen. */
  const target = useRef({ x: -200, y: -200 })
  const pos = useRef({ x: -200, y: -200 })

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current.x = e.clientX
      target.current.y = e.clientY
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // A layout effect, so the label is already on the cursor in the frame it
  // first paints in, rather than flashing at the corner of the screen.
  useLayoutEffect(() => {
    if (!visible) return
    const place = () => {
      const el = ref.current
      if (el) {
        el.style.transform = `translate3d(${(pos.current.x + OFFSET_X).toFixed(1)}px, ${(pos.current.y + OFFSET_Y).toFixed(1)}px, 0)`
      }
    }
    // Start on the cursor, not behind it.
    pos.current.x = target.current.x
    pos.current.y = target.current.y
    place()
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      const f = last ? Math.min(4, (now - last) / 16.667) : 1
      last = now
      const k = reduced ? 1 : 1 - Math.pow(1 - FOLLOW, f)
      pos.current.x += (target.current.x - pos.current.x) * k
      pos.current.y += (target.current.y - pos.current.y) * k
      place()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible, reduced])

  const letters = Array.from(text)

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-20"
    >
      <AnimatePresence>
        {visible && (
          <motion.span
            key="label"
            // On a dark pill of its own: the cursor is over footage by
            // definition, and pale lettering straight on a bright stage shot
            // disappears into it.
            className="tracked block rounded-full border border-white/10 bg-void/75 py-2 pr-[0.95em] pl-[1.35em] whitespace-nowrap text-chalk shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
            style={{ fontSize: 'clamp(0.6rem, 0.8vw, 0.78rem)' }}
            initial={reduced ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.22 } }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {letters.map((ch, i) => (
              <motion.span
                key={i}
                className="inline-block"
                initial={
                  reduced ? false : { opacity: 0, y: '0.7em', filter: 'blur(3px)' }
                }
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{
                  duration: 0.5,
                  delay: reduced ? 0 : i * 0.035,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <span
                  className={reduced ? 'inline-block' : 'letter-flow inline-block'}
                  style={{ animationDelay: `${i * 0.09}s` }}
                >
                  {ch === ' ' ? ' ' : ch}
                </span>
              </motion.span>
            ))}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
