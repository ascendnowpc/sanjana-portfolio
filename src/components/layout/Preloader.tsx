import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PROFILE } from '@/data/site'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'

/**
 * A short curtain over the first paint — it hides the moment where the tunnel
 * has laid out but the posters have not yet decoded. Lifts on `window.load`,
 * with a hard ceiling so a slow asset can never trap the visitor.
 */
export function Preloader() {
  const reduced = usePrefersReducedMotion()
  const [done, setDone] = useState(reduced)

  useEffect(() => {
    if (reduced) return
    const lift = () => setDone(true)
    if (document.readyState === 'complete') {
      const t = window.setTimeout(lift, 650)
      return () => clearTimeout(t)
    }
    window.addEventListener('load', lift)
    const ceiling = window.setTimeout(lift, 2600)
    return () => {
      window.removeEventListener('load', lift)
      clearTimeout(ceiling)
    }
  }, [reduced])

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-void"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="text-center">
            <motion.p
              className="tracked text-lg text-chalk md:text-2xl"
              initial={{ opacity: 0, letterSpacing: '1.2em' }}
              animate={{ opacity: 1, letterSpacing: '0.42em' }}
              transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {PROFILE.name}
            </motion.p>
            <motion.span
              className="mt-6 block h-px bg-gradient-to-r from-bloom to-gold"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '100%', opacity: 1 }}
              transition={{ duration: 1.5, delay: 0.25 }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
