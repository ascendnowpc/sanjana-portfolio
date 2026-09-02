import { useEffect, useRef, type ReactNode } from 'react'
import {
  motion,
  useMotionTemplate,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { mediaUrl } from '@/lib/media'

/**
 * The black behind the opening, a shade under the site's own.
 *
 * A shade off true black rather than #000. At #000 the section reads as a hole
 * cut in the page; the few points of lift are what keep it a surface, and they
 * also give the film's own black somewhere to sit against.
 *
 * Scoped to this section rather than promoted to a token: the page returns to
 * --color-void the moment the film has finished opening, and the step between
 * them is small enough to read as depth rather than as a seam.
 */
const OPENING_BLACK = '#070707'

interface Props {
  /** Looping film, stored as a media key ("/media/video/x.mp4"). */
  src: string
  /** First frame, so the panel is never an empty black box. */
  poster?: string
  /** The poster-weight headline that lifts away as the film takes over. */
  children: ReactNode
  /** Viewport heights of scroll the whole gesture is spread across. */
  length?: number
  /** The film's own aspect ratio, so the frame never crops it. */
  aspect?: number
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
 * Width and height are animated rather than a scale transform on purpose, and
 * both are pinned to the film's own aspect ratio, so at every size between the
 * card and the final frame the whole picture is on screen. Nothing is cropped
 * to fit and nothing is stretched: the frame opens *around* the performance
 * rather than inflating it or trimming it.
 *
 * Reduced-motion visitors get the end state — headline above, film wide and
 * still playing — which is the same information without the travel.
 */
export function Overture({
  src,
  poster,
  children,
  length = 2,
  aspect = 16 / 9,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const reduced = usePrefersReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  // Scroll position drives the gesture, but not directly: a wheel or a
  // trackpad delivers position in coarse jumps, and mapping those straight
  // onto a growing frame makes the growth step rather than glide. The spring
  // is what turns the jumps into travel — critically damped enough that it
  // never wobbles past its target, loose enough to keep up with a fast flick.
  const smooth = useSpring(scrollYProgress, {
    stiffness: 260,
    damping: 40,
    mass: 0.35,
    restDelta: 0.0005,
  })

  // Mapped across the whole section, not part of it. Finishing early leaves
  // the rest of the sticky section as scroll that changes nothing: the film
  // has stopped growing but the page has not started moving again, which is
  // felt as the frame catching on something. Ending exactly where the section
  // releases means the last frame of the gesture and the first frame of the
  // page moving on are the same frame.
  //
  // Linear, for the same reason. An ease-out spends its last third creeping
  // the final few percent, which reads as the same stall in miniature — the
  // spring above is what makes the motion smooth, so the curve does not have
  // to be. Clamped only because a spring can overshoot its target.
  const open = useTransform(smooth, [0, 1], [0, 1], { clamp: true })

  // The card starts a little over a centimetre wider and taller than a
  // straight 30vw/26vh: measured against a 1440x800 screen, where 1cm is
  // ~2.6vw across and ~4.7vh down. It stops short of full bleed — a frame that
  // runs to the exact edge of the window reads as a background the page
  // happens to sit on, and leaving a couple of centimetres of void around it
  // keeps it a *picture*, which is what the whole gesture has been opening.
  //
  // Both bounds are ceilings, not the size. The frame takes whichever of the
  // two the film's own aspect ratio can fit inside, so it is never a shape the
  // video has to be cropped to fill: on a wide window the height binds, on a
  // tall one the width does, and object-cover has nothing left to cut either
  // way. Sizing to a fixed vw/vh pair instead threw away about an eighth of
  // the frame's height on an ordinary laptop.
  const w = useTransform(open, [0, 1], [32.6, 94])
  const h = useTransform(open, [0, 1], [30.7, 84])
  const width = useMotionTemplate`min(${w}vw, calc(${h}vh * ${aspect}))`
  const height = useMotionTemplate`min(${h}vh, calc(${w}vw / ${aspect}))`
  // The card sits low, under the headline; it rises into the middle of the
  // screen as it grows, which is what makes the two movements read as one.
  const filmY = useTransform(open, [0, 1], ['30vh', '0vh'])

  // The words are gone by the time the frame is two thirds open, so they never
  // sit on top of the picture competing with it.
  const copyY = useTransform(open, [0, 1], ['-14vh', '-88vh'])
  const copyOpacity = useTransform(open, [0, 0.42, 0.62], [1, 1, 0])

  // Autoplay is declarative, but Safari will refuse the promise if the tab was
  // opened in the background; a play() on first paint recovers that case.
  useEffect(() => {
    videoRef.current?.play().catch(() => {})
  }, [])

  /**
   * The edge, cast down onto the page below.
   *
   * The opening sits ten levels darker than the rest of the site, and butted
   * straight against it that step reads as a seam — two flat fields meeting at
   * a ruled line. Spilling a shadow past the boundary turns the same step into
   * depth: the black becomes a surface with an edge, and the page below sits
   * under it rather than next to it.
   *
   * Black at low alpha rather than a ramp between the two greys, so it
   * composites onto whatever section happens to follow and needs no knowledge
   * of it.
   */
  const edgeShadow = (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-full z-10 h-40"
      style={{
        background:
          'linear-gradient(to bottom, rgba(0,0,0,0.72), rgba(0,0,0,0.34) 38%, rgba(0,0,0,0) 100%)',
      }}
    />
  )

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
      <section
        style={{ backgroundColor: OPENING_BLACK }}
        className="relative px-6 pt-32 pb-16 md:px-12"
      >
        <div className="w-full text-center">{children}</div>
        <div
          style={{ backgroundColor: OPENING_BLACK }}
          className="relative mt-16 h-[70vh] w-full overflow-hidden"
        >
          {film}
        </div>
        {edgeShadow}
      </section>
    )
  }

  return (
    <section
      ref={ref}
      style={{ height: `${length * 100}vh`, backgroundColor: OPENING_BLACK }}
      className="relative"
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* The film. Flex-centred so only y and the frame's size animate — no
            transform is spent on the centring itself. */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            style={{ width, height, y: filmY, backgroundColor: OPENING_BLACK }}
            className="relative overflow-hidden rounded-[2px]"
          >
            {film}
          </motion.div>
        </div>

        {/* The headline, riding up over it. */}
        <motion.div
          style={{ y: copyY, opacity: copyOpacity }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 md:px-12"
        >
          <div className="pointer-events-auto w-full text-center">
            {children}
          </div>
        </motion.div>
      </div>

      {edgeShadow}
    </section>
  )
}
