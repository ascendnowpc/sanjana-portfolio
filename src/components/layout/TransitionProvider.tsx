import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { mediaUrl } from '@/lib/media'

interface ZoomState {
  rect: DOMRect
  poster: string
  title: string
}

interface TransitionApi {
  /** Fly `el` up to fill the viewport, then route to `to`. `poster` is a
   *  stored media key; it is resolved here so callers stay source-agnostic. */
  zoomTo: (el: HTMLElement, poster: string, title: string, to: string) => void
}

const Ctx = createContext<TransitionApi>({ zoomTo: () => {} })

export const useTransition = () => useContext(Ctx)

/**
 * Shared-element route transition.
 *
 * React Router unmounts the old tree before the new one paints, so a
 * `layoutId` handoff can't survive the change. Instead we clone the clicked
 * tile into a fixed-position layer, animate that to full-bleed, navigate
 * underneath it, and fade the clone out once the new page has painted.
 */
export function TransitionProvider({ children }: { children: ReactNode }) {
  const [zoom, setZoom] = useState<ZoomState | null>(null)
  const navigate = useNavigate()
  const reduced = usePrefersReducedMotion()
  const timers = useRef<number[]>([])

  const zoomTo = useCallback(
    (el: HTMLElement, poster: string, title: string, to: string) => {
      if (reduced) {
        navigate(to)
        return
      }

      setZoom({ rect: el.getBoundingClientRect(), poster, title })

      timers.current.forEach(clearTimeout)
      timers.current = [
        // Navigate while the clone still covers the viewport.
        window.setTimeout(() => navigate(to), 520),
        // Then dissolve it, revealing the page that painted underneath.
        window.setTimeout(() => setZoom(null), 900),
      ]
    },
    [navigate, reduced],
  )

  return (
    <Ctx.Provider value={{ zoomTo }}>
      {children}

      <AnimatePresence>
        {zoom && (
          <motion.div
            key="zoom"
            className="fixed inset-0 z-[80] pointer-events-none"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
          >
            <motion.div
              className="absolute overflow-hidden"
              initial={{
                top: zoom.rect.top,
                left: zoom.rect.left,
                width: zoom.rect.width,
                height: zoom.rect.height,
                borderRadius: 2,
              }}
              animate={{
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                borderRadius: 0,
              }}
              transition={{ duration: 0.68, ease: [0.16, 1, 0.3, 1] }}
            >
              <img
                src={mediaUrl(zoom.poster)}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-void via-void/40 to-void/70" />
              <motion.p
                className="tracked absolute inset-x-0 bottom-[18%] text-center text-2xl text-chalk md:text-4xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.5 }}
              >
                {zoom.title}
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  )
}
