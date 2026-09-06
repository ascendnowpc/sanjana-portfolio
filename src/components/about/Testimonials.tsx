import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'framer-motion'
import type { Testimonial } from '@/types/content'
import { TESTIMONIALS } from '@/data/site'
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery'
import { mediaUrl } from '@/lib/media'

/**
 * The word the run is read against.
 *
 * Set once here rather than twice in the two branches below, because the whole
 * point of the section is that this word does not move: it is the thing the
 * cards are crossing, and a reader who scrolls back up has to find it exactly
 * where they left it.
 */
const HEADING = 'Testimonials'

/**
 * How far off square each card is laid.
 *
 * Fixed per card rather than random per mount, so the composition is a thing
 * somebody chose and is the same on every reload. The values alternate sign
 * and stay under two degrees: enough that five cards read as laid on a table
 * rather than printed on a grid, small enough that no line of type inside them
 * looks like a mistake. The heading above each card is never tilted — only the
 * panel is, which is what keeps the row of names level across the screen.
 */
const TILTS = [-1.2, 0.9, -0.6, 1.1, -0.9]

/**
 * One testimonial, as a card.
 *
 * The parts are stacked the way a sleeve note is: who is speaking, then what
 * they were speaking about, then what they said. The name sits above the panel
 * rather than under the quote — a reader scanning sideways through five of
 * these is choosing which one to stop on, and they cannot choose on the
 * strength of an attribution they have to read the whole quote to reach.
 *
 * The record is the picture. A portrait cropped into a square would be a
 * headshot of the wrong person — none of these five is Sanjana — so what sits
 * at the top of the card is the *work* being talked about, in the one form
 * that is unambiguous on a singer's page: a still in the label of a disc. It
 * overlaps the top edge because a picture that breaks its own frame reads as
 * an object resting on the card rather than a thumbnail placed inside it.
 */
function Card({
  item,
  index,
  className,
}: {
  item: Testimonial
  index: number
  className?: string
}) {
  return (
    <article className={className}>
      {/* ---------------- who ---------------- */}
      <header className="mb-12">
        <h3
          className="font-[family-name:var(--font-display)] leading-[1.15] font-light text-chalk"
          style={{ fontSize: 'clamp(1.35rem, 2.1vw, 1.9rem)' }}
        >
          {/* The number is set in the mono face, not in Cormorant with the rest
              of the line. Cormorant's figures are old-style: its 1 has no
              shoulder and sits at x-height, so "1." in front of a name reads as
              a small-cap I and the run appears to be numbered in roman. The
              mono face also puts every number on the same advance, which is
              what keeps five headings starting at the same place. */}
          <span className="mono-label mr-1 align-[0.14em] text-[0.44em] text-dust">
            {String(index + 1).padStart(2, '0')}
          </span>
          {item.source}
        </h3>
        <p className="mt-3 max-w-[32ch] text-sm leading-[1.6] font-light text-mist">
          {item.role}
        </p>
      </header>

      {/* ---------------- what they said ----------------
          Two nested boxes, not one with a border. The outer is a 3px gradient
          sheet showing along the top and left edges only — the reference's
          coloured rim, which on a page with no second colour is carried by
          value instead: light where the light would fall, gone by the time it
          reaches the bottom right. A uniform 3px outline would draw a
          rectangle; this draws an edge catching light, which is the thing the
          rim was doing in the first place. */}
      <div
        className="testimonial-card relative rounded-[21px] p-[3px]"
        style={{
          '--tilt': `${TILTS[index % TILTS.length]}deg`,
          background:
            'linear-gradient(142deg, #ffffff 0%, #9a9a9a 26%, #4a4a4a 46%, rgba(74,74,74,0) 64%)',
          boxShadow: '0 46px 90px -54px rgba(0,0,0,0.95)',
        } as CSSProperties}
      >
        <div className="rounded-[18px] bg-chalk px-7 pt-0 pb-9">
          {/* The disc. In flow with a negative top margin rather than absolutely
              positioned, so the type below it never has to be told how tall it
              is — percentage margins resolve against the card's width, so the
              overlap holds at every size the column takes. */}
          <div
            className="relative -mt-[6%] ml-[24%] w-[52%] rounded-full"
            style={{
              aspectRatio: '1',
              background:
                'repeating-radial-gradient(circle at 50% 50%, #0a0a0a 0 1.5px, #171717 1.5px 3px)',
              boxShadow:
                '0 22px 42px -22px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(255,255,255,0.09)',
            }}
          >
            <img
              src={mediaUrl(item.portrait)}
              alt=""
              loading="lazy"
              className="absolute inset-[20%] h-[60%] w-[60%] rounded-full object-cover grayscale-[35%]"
            />
            {/* The sheen. A record is read as a record by the light crossing
                it, not by the grooves — without this the disc is a black
                circle with a photo in the middle. */}
            <div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background:
                  'linear-gradient(128deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 38%, rgba(255,255,255,0) 64%, rgba(255,255,255,0.09) 100%)',
              }}
            />
          </div>

          <p className="mono-label mt-[8%] text-[0.5625rem] text-dust">
            {item.context}
          </p>
          <blockquote className="mt-4">
            <p
              className="font-[family-name:var(--font-display)] leading-[1.42] font-light text-ink italic"
              style={{ fontSize: 'clamp(1.05rem, 1.35vw, 1.3rem)' }}
            >
              “{item.quote}”
            </p>
          </blockquote>
        </div>
      </div>
    </article>
  )
}

/**
 * Testimonials, read sideways.
 *
 * The section pins itself for as long as it takes to cross five cards, and
 * spends that scroll moving them right to left across a word that stays put.
 * Nothing plays: the cards are exactly as far in as the reader has scrolled,
 * they come back if the reader scrolls up, and the page does not move on until
 * the last one has arrived — which is the whole argument for doing it this way
 * rather than as a grid. Five quotes in three columns are read as a block of
 * grey and skipped; five quotes that each have to be scrolled to are read.
 *
 * The distance is measured rather than guessed. `travel` is the track's own
 * width, the section is a screen plus that, and the card row moves its full
 * width over exactly that much scroll — so a pixel of wheel is a pixel of
 * card, at every viewport, with no ratio to tune per breakpoint. Getting this
 * wrong in either direction is the failure mode of every pinned section on the
 * web: too little and the cards outrun the scroll, too much and the reader is
 * pushing against a screen that has stopped responding.
 *
 * The track is offset by `left-full` and driven in percentages of its own
 * width, so the two ends of the move are exactly the two states worth having —
 * at 0 the row sits just past the right edge with only the word showing, at
 * -100% its right edge is back at the container's, with the last card home and
 * the pin about to release. Neither end needs a measured pixel value, which is
 * why neither drifts when the window resizes mid-section.
 *
 * A reader who has asked for no motion gets the same five cards as a grid.
 * That is not a lesser version of the section: the cards are the content, and
 * the horizontal run was only ever the way they are paced.
 */
export function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  /** The track's width in px — the exact distance the row has to travel. */
  const [travel, setTravel] = useState(0)

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    // offsetWidth, not the bounding rect: the track is under a live transform
    // for the whole of the section, and a rect would be measuring where it
    // currently is rather than how wide it is.
    const measure = () => setTravel(track.offsetWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => observer.disconnect()
  }, [reduced])

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  })

  // The same spring the opening film uses, for the same reason: a wheel
  // delivers scroll in coarse steps, and mapping those straight onto a moving
  // row makes it step rather than glide. Damped hard enough that the row never
  // overshoots and shows the void past the last card.
  const smooth = useSpring(scrollYProgress, {
    stiffness: 260,
    damping: 40,
    mass: 0.35,
    restDelta: 0.0005,
  })
  const x = useTransform(smooth, [0, 1], ['0%', '-100%'], { clamp: true })

  const heading = (
    <h2
      className="font-[family-name:var(--font-poster)] leading-[0.86] tracking-[0.012em] text-dust/75 uppercase"
      style={{ fontSize: 'clamp(2.6rem, 14.5vw, 20rem)' }}
    >
      {HEADING}
    </h2>
  )

  if (reduced) {
    return (
      <section className="px-6 py-32 md:px-12">
        <div className="mx-auto max-w-[1600px]">
          {heading}
          <div className="mt-20 grid gap-x-10 gap-y-24 sm:grid-cols-2 xl:grid-cols-3">
            {TESTIMONIALS.map((item, i) => (
              <Card key={item.source} item={item} index={i} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      ref={sectionRef}
      style={{ height: `calc(100vh + ${travel}px)` }}
      className="relative"
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* The word, held still under everything. It is the section's real
            heading, so it stays in the document where a screen reader will
            meet it before the quotes — it is only visually that the cards are
            allowed to cover it. */}
        <div className="pointer-events-none absolute inset-0 flex items-center px-6 md:px-12">
          {heading}
        </div>

        {/* The row. Parked one container-width to the right and pulled back by
            its own width, so nothing here is in viewport units — a scrollbar
            appearing or a window resizing changes both ends together. */}
        <motion.div
          ref={trackRef}
          style={{ x, y: '-50%' }}
          className="absolute top-1/2 left-full flex w-max items-start gap-[9vw] pr-[9vw] will-change-transform md:gap-[5.5vw] md:pr-[7vw]"
        >
          {TESTIMONIALS.map((item, i) => (
            <Card
              key={item.source}
              item={item}
              index={i}
              className="w-[80vw] max-w-[25rem] shrink-0 sm:w-[52vw] md:w-[36vw] lg:w-[27vw]"
            />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
