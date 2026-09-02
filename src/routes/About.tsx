import { useMemo, useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { CategoryId } from '@/types/content'
import { PROFILE } from '@/data/site'
import { CATEGORIES } from '@/data/categories'
import { usePerformances } from '@/hooks/useContent'
import { Reveal } from '@/components/ui/Reveal'
import { Overture } from '@/components/ui/Overture'
import { ScrollWords } from '@/components/ui/ScrollWords'
import { CountUp } from '@/components/ui/CountUp'
import { Marquee } from '@/components/ui/Marquee'
import { MusicShelf } from '@/components/audio/MusicShelf'
import { mediaUrl } from '@/lib/media'

/** The looping film the About page opens on. */
const ABOUT_FILM = '/media/video/about-intro.mp4'
const ABOUT_FILM_POSTER = '/media/posters/about-intro.jpg'

/** Italic serif word inside the poster-weight headline. */
const Em = ({ children }: { children: React.ReactNode }) => (
  <em className="font-[family-name:var(--font-display)] font-light text-bloom italic">
    {children}
  </em>
)

/**
 * The page about Sanjana.
 *
 * Built as a sequence of beats rather than a stack of cards: one idea to a
 * screenful, each arriving off scroll position rather than firing a canned
 * fade the moment it crosses the fold. That is the difference between a page
 * that animates and a page that is *paced* — the reader sets the speed, and
 * nothing happens until they ask for it.
 *
 * The figures and the discipline breakdown are counted from the real archive
 * in `performances.ts`, never typed in. They are the most specific thing on
 * the page — thirty-six pieces across six disciplines, the actual years — and
 * they stay true on their own as work is added.
 *
 * NOTE: the prose in `data/site.ts` is still the placeholder bio it shipped
 * with, and its credits are invented. Everything here is built to hold real
 * copy; swapping that file is what makes the page finally hers.
 */
export default function About() {
  const { items } = usePerformances()

  /** Everything the page states about the work, derived rather than asserted. */
  const archive = useMemo(() => {
    if (!items.length) return null
    const years = items.map((p) => p.year)
    const from = Math.min(...years)
    const to = Math.max(...years)

    const counts = new Map<CategoryId, number>()
    for (const p of items) counts.set(p.category, (counts.get(p.category) ?? 0) + 1)

    return {
      pieces: items.length,
      from,
      to,
      years: to - from + 1,
      recordings: items.reduce((n, p) => n + p.tracks.length, 0),
      disciplines: CATEGORIES.map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }))
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count),
    }
  }, [items])

  const stripRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: stripRef,
    offset: ['start end', 'end start'],
  })
  const stripX = useTransform(scrollYProgress, [0, 1], ['4%', '-12%'])

  const busiest = archive?.disciplines[0]

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

            The size is set so the longer line (6.71em of advance in Anton,
            plus tracking) lands at roughly 86% of the viewport, matching how
            far the reference runs into its margins. */}
        <h1
          className="font-[family-name:var(--font-poster)] leading-[1.06] tracking-[0.012em] text-white uppercase"
          style={{ fontSize: 'clamp(2.6rem, 12.4vw, 20rem)' }}
        >
          A voice built for
          <br />
          the room it fills
        </h1>
      </Overture>

      {/* ---------------- 2. the statement ---------------- */}
      <section className="relative flex min-h-screen items-center overflow-hidden bg-void">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(63,125,251,0.18), transparent 70%)',
          }}
        />
        <div className="relative mx-auto max-w-[1400px] px-6 py-32 text-center md:px-12">
          <Reveal>
            <h2
              className="mx-auto max-w-5xl font-[family-name:var(--font-poster)] leading-[0.94] tracking-tight text-chalk uppercase"
              style={{ fontSize: 'clamp(1.9rem, 5.4vw, 4.6rem)' }}
            >
              She builds <Em>nights</Em> that refuse to let go — voice first,
              scenery last, and an <Em>impression</Em> that <Em>lingers</Em> long
              after the lights go out
            </h2>
          </Reveal>
        </div>
      </section>

      {/* ---------------- 3. the archive, counted ---------------- */}
      {archive && (
        <section className="border-y border-edge/50 bg-ink/30">
          <div className="mx-auto grid max-w-[1600px] grid-cols-2 md:grid-cols-4">
            {[
              { value: archive.pieces, suffix: '', label: 'Pieces in the archive' },
              { value: archive.years, suffix: '', label: 'Years of it' },
              { value: archive.disciplines.length, suffix: '', label: 'Disciplines' },
              { value: archive.recordings, suffix: '', label: 'Recordings kept' },
            ].map((s, i) => (
              <Reveal
                key={s.label}
                delay={i * 0.07}
                className="border-edge/50 px-6 py-16 not-last:border-r md:px-12"
              >
                <p className="tracked text-3xl text-chalk md:text-5xl">
                  <CountUp to={s.value} suffix={s.suffix} />
                </p>
                <p className="label mt-4 text-dust">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- 4. what the work actually is ---------------- */}
      {archive && (
        <section className="mx-auto max-w-[1600px] px-6 py-32 md:px-12">
          <Reveal>
            <p className="label mb-4 text-dust">The shape of it</p>
            <p className="max-w-2xl text-sm leading-[1.9] font-light text-mist">
              {archive.pieces} pieces filed between {archive.from} and{' '}
              {archive.to}, weighted toward{' '}
              <span className="text-chalk">{busiest?.label.toLowerCase()}</span> —
              the room she keeps going back to.
            </p>
          </Reveal>

          <div className="mt-16 space-y-px">
            {archive.disciplines.map((d, i) => {
              const share = d.count / archive.pieces
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.7, delay: i * 0.06 }}
                  className="group relative"
                >
                  <Link
                    to={`/work?category=${d.id}`}
                    className="relative flex items-baseline gap-6 border-b border-edge/40 py-7"
                  >
                    {/* The bar is the number — a share of the archive drawn to
                        scale, so the weighting is read rather than asserted. */}
                    {/* Full width and scaled down, never sized directly: a
                        transform animates on the compositor, an animated
                        `width` relayouts the row on every frame. */}
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 w-full origin-left"
                      style={{ background: `${d.accent}1f` }}
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: share }}
                      viewport={{ once: true, margin: '-60px' }}
                      transition={{
                        duration: 1.4,
                        delay: 0.1 + i * 0.06,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    />
                    <span
                      className="label relative w-10 shrink-0 tabular-nums"
                      style={{ color: d.accent }}
                    >
                      {String(d.count).padStart(2, '0')}
                    </span>
                    <span className="tracked-tight relative flex-1 text-lg text-chalk transition-colors duration-300 group-hover:text-bloom md:text-2xl">
                      {d.label}
                    </span>
                    <span className="relative hidden max-w-sm text-xs leading-relaxed font-light text-dust lg:block">
                      {d.blurb}
                    </span>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </section>
      )}

      {/* ---------------- 5. the prose ---------------- */}
      <section className="mx-auto max-w-[1600px] px-6 pb-32 md:px-12">
        <div className="grid gap-16 lg:grid-cols-[320px_1fr] lg:gap-24">
          <div>
            <Reveal>
              <p className="label mb-8 text-dust">Detail</p>
              <dl className="space-y-7">
                <div>
                  <dt className="label text-dust">Based in</dt>
                  <dd className="mt-2 text-sm font-light text-chalk">
                    {PROFILE.basedIn}
                  </dd>
                </div>
                <div>
                  <dt className="label text-dust">Range</dt>
                  <dd className="mt-2 text-sm font-light text-chalk">
                    {PROFILE.vocalRange}
                  </dd>
                </div>
                <div>
                  <dt className="label text-dust">Training</dt>
                  <dd className="mt-2 space-y-1.5">
                    {PROFILE.training.map((t) => (
                      <span key={t} className="block text-sm font-light text-chalk">
                        {t}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
            </Reveal>
          </div>

          <div>
            <ScrollWords
              text={PROFILE.bioShort}
              className="max-w-3xl text-xl leading-[1.6] font-light text-chalk md:text-3xl"
            />
            <div className="mt-16 max-w-2xl space-y-10">
              {PROFILE.bio.map((para, i) => (
                <ScrollWords
                  key={i}
                  text={para}
                  className="text-sm leading-[1.95] font-light text-mist"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 6. the recordings ---------------- */}
      <MusicShelf items={items} />

      {/* ---------------- 7. portraits over the drifting name ---------------- */}
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

      {/* ---------------- 8. press ---------------- */}
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

      {/* ---------------- 9. the ask ---------------- */}
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
