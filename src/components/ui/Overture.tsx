import { useEffect, useRef, type ReactNode } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { mediaUrl } from '@/lib/media'

interface Props {
  /** Looping film, stored as a media key ("/media/video/x.mp4"). */
  src: string
  /** First frame, so the panel is never an empty black box. */
  poster?: string
  /** The poster-weight headline that lifts away as the film takes over. */
  children: ReactNode
  /** Viewport heights of scroll the whole gesture is spread across. */
  length?: number
}

/**
 * The headline, then the film.
 *
 * The page opens on a single statement at poster weight with a small silent
 * loop held below it, roughly the size of a card. Scrolling does two things at
 * once: the words lift up out of the frame, and the film grows from that card
 * to full bleed. By the time the sentence has gone the picture is the whole
 * screen, and the reader did all of it — nothing here plays on entry.
 *
 * Width and height are animated rather than a scale transform on purpose. A
 * scale would drag the film's own aspect ratio along with it and stretch the
 * subject; growing the frame and counter-zooming the video inside it keeps her
 * roughly the same size on screen the entire way, so the frame opens *around*
 * the performance instead of inflating it.
 *
 * Reduced-motion visitors get the end state — headline above, film wide and
 * still playing — which is the same information without the travel.
 */
export function Overture({ src, poster, children, length = 3.2 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const reduced = usePrefersReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  // Full bleed is reached before the section ends, so there is a beat of held
  // picture rather than a hard cut into the statement that follows.
  const open = useTransform(scrollYProgress, [0, 0.78], [0, 1], { clamp: true })

  // The card starts a little over a centimetre wider and taller than a
  // straight 30vw/26vh: measured against a 1440x800 screen, where 1cm is
  // ~2.6vw across and ~4.7vh down.
  const width = useTransform(open, [0, 1], ['32.6vw', '100vw'])
  const height = useTransform(open, [0, 1], ['30.7vh', '100vh'])
  // The card sits low, under the headline; it rises into the middle of the
  // screen as it grows, which is what makes the two movements read as one.
  const filmY = useTransform(open, [0, 1], ['30vh', '0vh'])
  const filmScale = useTransform(open, [0, 1], [1.28, 1])
  const filmRadius = useTransform(open, [0, 0.85], ['2px', '0px'], { clamp: true })

  // The words are gone by the time the frame is two thirds open, so they never
  // sit on top of the picture competing with it.
  const copyY = useTransform(open, [0, 1], ['-12vh', '-86vh'])
  const copyOpacity = useTransform(open, [0, 0.42, 0.62], [1, 1, 0])

  // Autoplay is declarative, but Safari will refuse the promise if the tab was
  // opened in the background; a play() on first paint recovers that case.
  useEffect(() => {
    videoRef.current?.play().catch(() => {})
  }, [])

  const film = (
    <video
      ref={videoRef}
      src={mediaUrl(src)}
      poster={mediaUrl(poster)}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      className="h-full w-full object-cover"
    />
  )

  if (reduced) {
    return (
      <section className="relative bg-void px-6 pt-32 pb-16 md:px-12">
        <div className="mx-auto max-w-[1500px] text-center">{children}</div>
        <div className="relative mt-16 h-[70vh] w-full overflow-hidden bg-ink">
          {film}
        </div>
      </section>
    )
  }

  return (
    <section
      ref={ref}
      style={{ height: `${length * 100}vh` }}
      className="relative bg-void"
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* The film. Flex-centred so only y and the frame's size animate — no
            transform is spent on the centring itself. */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            style={{ width, height, y: filmY, borderRadius: filmRadius }}
            className="relative overflow-hidden bg-ink"
          >
            {/* Counter-zoom lives on the video, never on the frame: scaling the
                frame would undo the width and height being animated above. */}
            <motion.div style={{ scale: filmScale }} className="h-full w-full">
              {film}
            </motion.div>
          </motion.div>
        </div>

        {/* The headline, riding up over it. */}
        <motion.div
          style={{ y: copyY, opacity: copyOpacity }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 md:px-12"
        >
          <div className="pointer-events-auto mx-auto max-w-[1600px] text-center">
            {children}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
