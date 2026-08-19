import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import { PROFILE } from '@/data/site'
import { Reveal } from '@/components/ui/Reveal'
import { Marquee } from '@/components/ui/Marquee'
import { mediaUrl } from '@/lib/media'

/** Italic serif word inside the poster-weight headline. */
const Em = ({ children }: { children: React.ReactNode }) => (
  <em className="font-[family-name:var(--font-display)] font-light text-bloom italic">
    {children}
  </em>
)

export default function About() {
  const stripRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: stripRef,
    offset: ['start end', 'end start'],
  })
  // Portrait strip slides against the page as it passes — cheap depth.
  const x = useTransform(scrollYProgress, [0, 1], ['4%', '-12%'])

  return (
    <div className="bg-void">
      {/* ---------------- editorial statement band ---------------- */}
      <section className="relative overflow-hidden bg-gradient-to-b from-abyss via-ink to-void pt-40 pb-0">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(63,125,251,0.22), transparent 70%)',
          }}
        />

        <div className="relative mx-auto max-w-[1400px] px-6 text-center md:px-12">
          <Reveal>
            <p className="label text-bloom">About {PROFILE.name}</p>
          </Reveal>

          <Reveal delay={0.08}>
            <h1
              className="mx-auto mt-10 max-w-5xl font-[family-name:var(--font-poster)] leading-[0.94] tracking-tight text-chalk uppercase"
              style={{ fontSize: 'clamp(1.9rem, 5.4vw, 4.6rem)' }}
            >
              She builds <Em>nights</Em> that refuse to let go — voice first,
              scenery last, and an <Em>impression</Em> that <Em>lingers</Em> long
              after the lights go out
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <Link
              to="/contact"
              className="mt-12 inline-block border border-edge px-9 py-3.5 text-[0.62rem] tracking-[0.34em] text-chalk uppercase transition-all duration-500 hover:border-bloom hover:bg-bloom hover:text-void"
            >
              Book a date
            </Link>
          </Reveal>
        </div>

        {/* ---------------- portrait strip over drifting name ---------------- */}
        <div ref={stripRef} className="relative mt-24 pb-24">
          <Marquee
            text={`${PROFILE.name} `}
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-edge/60 select-none"
          />
          <motion.div
            style={{ x }}
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
      </section>

      {/* ---------------- stats ---------------- */}
      <section className="border-y border-edge/50">
        <div className="mx-auto grid max-w-[1600px] grid-cols-2 md:grid-cols-4">
          {PROFILE.stats.map((s, i) => (
            <Reveal
              key={s.label}
              delay={i * 0.07}
              className="border-edge/50 px-6 py-12 not-last:border-r md:px-12"
            >
              <p className="tracked text-3xl text-chalk md:text-5xl">{s.value}</p>
              <p className="label mt-4 text-dust">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- bio ---------------- */}
      <section className="mx-auto max-w-[1600px] px-6 py-28 md:px-12">
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
            <Reveal>
              <p className="max-w-3xl text-xl leading-[1.6] font-light text-chalk md:text-2xl">
                {PROFILE.bioShort}
              </p>
            </Reveal>
            <div className="mt-12 max-w-2xl space-y-7">
              {PROFILE.bio.map((para, i) => (
                <Reveal key={i} delay={0.05 * i}>
                  <p className="text-sm leading-[1.95] font-light text-mist">
                    {para}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- press ---------------- */}
      <section className="border-t border-edge/50 bg-ink/40">
        <div className="mx-auto max-w-[1600px] px-6 py-28 md:px-12">
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
    </div>
  )
}
