import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import { PROFILE } from '@/data/site'
import { usePerformances } from '@/hooks/useContent'
import { Reveal } from '@/components/ui/Reveal'
import { Overture } from '@/components/ui/Overture'
import { Marquee } from '@/components/ui/Marquee'
import { MusicShelf } from '@/components/audio/MusicShelf'
import { PortraitStage } from '@/components/about/PortraitStage'
import { mediaUrl } from '@/lib/media'

/**
 * The looping film the About page opens on.
 *
 * The size is in the key on purpose. R2 objects carry an immutable one-year
 * cache header, so a re-cut has to land under a new name or browsers and the
 * edge keep serving the old file — the same rule the preview clips follow.
 */
const ABOUT_FILM = '/media/video/about-intro-1080.mp4'
const ABOUT_FILM_POSTER = '/media/posters/about-intro.jpg'

/**
 * The page about Sanjana.
 *
 * Built as a sequence of beats rather than a stack of cards: one idea to a
 * screenful, each arriving off scroll position rather than firing a canned
 * fade the moment it crosses the fold. That is the difference between a page
 * that animates and a page that is *paced* — the reader sets the speed, and
 * nothing happens until they ask for it.
 *
 * The middle of the page is deliberately missing. The statement, the counted
 * archive, the discipline breakdown and the bio prose all came out together:
 * they were written around the placeholder copy in `data/site.ts`, whose
 * credits are invented, and a page is better with a gap in it than with four
 * screens of confident fiction. The opening film runs straight into the
 * recordings until something real goes back in.
 */
export default function About() {
  const { items } = usePerformances()

  const stripRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: stripRef,
    offset: ['start end', 'end start'],
  })
  const stripX = useTransform(scrollYProgress, [0, 1], ['4%', '-12%'])

  return (
    <div className="bg-void">
      {/* ---------------- 1. the room opens ---------------- */}
      <Overture src={ABOUT_FILM} poster={ABOUT_FILM_POSTER}>
        {/* Two deliberate lines, not a wrap: at this weight the break is part
            of the composition, and letting the viewport choose it strands a
            single word on line two on half the screens it renders at.

            Leading is above 1, not the sub-1 a display line usually wants.
            Anton's cap height is 0.86em — unusually tall in its em box — so a
            line-height under that closes the channel entirely and the T of
            BUILT lands on top of THE. 1.06 leaves a 0.2em gap, which is the
            proportion the reference holds. Tracking is left a hair open for a
            related reason: the face is already condensed, and pulling it
            tighter fuses the verticals into a picket fence.

            The two lines are also chosen so the second sits *inside* the
            first, the way the reference does it — 6.10em of advance against
            7.03em, so line two lands at about 87% of line one and the block
            tapers instead of squaring off. Both lines being the same length is
            what made the earlier wording read as a slab.

            The size is set off line one's real advance in Anton (7.03em, plus
            tracking), so it lands at roughly three quarters of the viewport
            rather than being tuned by eye per screen. */}
        <h1
          className="font-[family-name:var(--font-poster)] leading-[1.06] tracking-[0.012em] text-white uppercase"
          style={{ fontSize: 'clamp(2.3rem, 10.6vw, 16rem)' }}
        >
          A voice for every
          <br />
          room it enters
        </h1>
      </Overture>

      {/* ---------------- 2. the portrait ---------------- */}
      <PortraitStage />

      {/* ---------------- 3. the recordings ---------------- */}
      <MusicShelf items={items} />

      {/* ---------------- 4. portraits over the drifting name ---------------- */}
      <div ref={stripRef} className="relative overflow-hidden py-16">
        <Marquee
          text={`${PROFILE.name} `}
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-edge/60 select-none"
        />
        <motion.div
          style={{ x: stripX }}
          className="relative flex gap-3 px-3 md:gap-4 md:px-4"
        >
          {PROFILE.portraits.map((src, i) => (
            <motion.div
              key={src}
              className="relative min-w-0 flex-1 overflow-hidden bg-ink"
              style={{ aspectRatio: '4 / 5' }}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{
                duration: 0.9,
                delay: i * 0.07,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <img
                src={mediaUrl(src)}
                alt={`${PROFILE.name} — portrait ${i + 1}`}
                loading="lazy"
                className="h-full w-full object-cover grayscale-[35%] transition-all duration-1000 hover:scale-105 hover:grayscale-0"
              />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ---------------- 5. press ---------------- */}
      <section className="border-t border-edge/50 bg-ink/40">
        <div className="mx-auto max-w-[1600px] px-6 py-32 md:px-12">
          <p className="label mb-16 text-dust">Press</p>
          <div className="grid gap-14 md:grid-cols-3">
            {PROFILE.press.map((q, i) => (
              <Reveal key={q.source} delay={i * 0.09}>
                <blockquote>
                  <p className="font-[family-name:var(--font-display)] text-xl leading-[1.45] font-light text-chalk italic">
                    “{q.quote}”
                  </p>
                  <footer className="label mt-6 text-bloom">— {q.source}</footer>
                </blockquote>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- 6. the ask ---------------- */}
      <section className="px-6 py-40 text-center md:px-12">
        <Reveal>
          <p className="label text-dust">Next</p>
          <Link
            to="/contact"
            className="tracked mt-8 inline-block text-chalk transition-colors duration-500 hover:text-bloom"
            style={{ fontSize: 'clamp(1.8rem, 5vw, 4rem)' }}
          >
            Book a date
          </Link>
        </Reveal>
      </section>
    </div>
  )
}
