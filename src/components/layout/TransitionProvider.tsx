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
  /** Uniform scale that covers the viewport from the tile's box, and the
   *  offset that puts the tile's centre on the viewport's. Solved once at
   *  click time so the animation itself is pure transform. */
  fill: number
  dx: number
  dy: number
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

      const rect = el.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      setZoom({
        rect,
        poster,
        title,
        // Cover, not contain: the clone has to leave no edge showing, and the
        // poster inside it is already `object-cover`, so the crop only ever
        // opens outward.
        fill: Math.max(vw / rect.width, vh / rect.height),
        dx: vw / 2 - (rect.left + rect.width / 2),
        dy: vh / 2 - (rect.top + rect.height / 2),
      })

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
            {/* The clone travels on `transform` alone.

                It used to animate `top`, `left`, `width` and `height` from the
                tile's box to the viewport's, which asks the engine for a
                layout and a full-size repaint of the image on every one of
                forty frames — while the gallery behind it is still running its
                own loop. Transform and opacity are the two things a compositor
                can carry on its own, and a scale about the frame's own centre
                describes exactly the same movement. */}
            <motion.div
              className="absolute overflow-hidden"
              style={{
                top: zoom.rect.top,
                left: zoom.rect.left,
                width: zoom.rect.width,
                height: zoom.rect.height,
                transformOrigin: '50% 50%',
                willChange: 'transform',
              }}
              initial={{ scale: 1, x: 0, y: 0 }}
              animate={{ scale: zoom.fill, x: zoom.dx, y: zoom.dy }}
              transition={{ duration: 0.68, ease: [0.16, 1, 0.3, 1] }}
            >
              <img
                src={mediaUrl(zoom.poster)}
                alt=""
                className="h-full w-full object-cover"
              />
            </motion.div>

            {/* Siblings, not children: anything inside the clone would be
                carried by its scale, and type dragged up by a factor of six
                arrives as a smear. */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-t from-void via-void/40 to-void/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.p
              className="tracked absolute inset-x-0 bottom-[18%] text-center text-2xl text-chalk md:text-4xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.5 }}
            >
              {zoom.title}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  )
}
