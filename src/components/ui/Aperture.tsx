import { useRef, type ReactNode } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { mediaUrl } from '@/lib/media'

interface Props {
  src: string
  alt: string
  /** Pinned over the frame; stays put while the frame opens behind it. */
  children?: ReactNode
  /** Viewport heights of scroll the opening is spread across. */
  length?: number
}

/**
 * A still that opens.
 *
 * The frame starts as a narrow vertical slot — a doorway, a lit gap in a
 * curtain — and widens to full bleed as the page is scrolled, while the copy
 * over it holds still. It is one gesture doing the whole job of an intro: it
 * makes the reader the one who opens the room.
 *
 * Everything is scrubbed off scroll position rather than played on entry, so
 * the speed belongs to the reader. Reduced-motion visitors get the frame
 * already open, which is the end state and loses nothing.
 */
export function Aperture({ src, alt, children, length = 2.4 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  // The opening finishes well before the section does, so there is a beat of
  // held full-bleed image at the end rather than a hard cut into the next one.
  const open = useTransform(scrollYProgress, [0, 0.72], [0, 1], { clamp: true })

  const width = useTransform(open, [0, 1], ['21vw', '100vw'])
  const height = useTransform(open, [0, 1], ['52vh', '100vh'])
  // Counter-zoom: without it the subject appears to rush outward as the frame
  // grows, because object-cover keeps re-fitting it. Easing the image down as
  // the frame opens holds the face roughly still.
  const scale = useTransform(open, [0, 1], [1.32, 1])
  // The copy sits bright on the narrow slot and settles back as the picture
  // takes over the frame.
  const copyOpacity = useTransform(open, [0, 0.55, 1], [1, 0.9, 0.75])
  // Scaled with the frame, or the name is three times the width of the slot it
  // is supposed to be standing in and spills across the black on either side.
  // Scaling rather than re-sizing keeps the letter-spacing proportional, which
  // a font-size ramp would not.
  const copyScale = useTransform(open, [0, 1], [0.42, 1])

  if (reduced) {
    return (
      <section className="relative h-screen w-full overflow-hidden bg-ink">
        <img
          src={mediaUrl(src)}
          alt={alt}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      </section>
    )
  }

  return (
    <section ref={ref} style={{ height: `${length * 100}vh` }} className="relative">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <motion.div
          style={{ width, height }}
          className="relative overflow-hidden bg-ink"
        >
          <motion.img
            src={mediaUrl(src)}
            alt={alt}
            style={{ scale }}
            className="h-full w-full object-cover"
          />
          {/* Holds the copy legible at every width the frame passes through. */}
          <div className="absolute inset-0 bg-gradient-to-t from-void/85 via-void/35 to-void/60" />
        </motion.div>

        <motion.div
          style={{ opacity: copyOpacity, scale: copyScale }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-6"
        >
          <div className="pointer-events-auto">{children}</div>
        </motion.div>
      </div>
    </section>
  )
}
