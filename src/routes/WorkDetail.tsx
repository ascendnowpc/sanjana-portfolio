import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePerformances } from '@/hooks/useContent'
import { CATEGORY_MAP } from '@/data/categories'
import { VideoStage } from '@/components/media/VideoStage'
import { WaveformPlayer } from '@/components/audio/WaveformPlayer'
import { Reveal } from '@/components/ui/Reveal'
import { SplitText } from '@/components/ui/SplitText'
import { totalRuntime } from '@/lib/utils'
import { mediaUrl } from '@/lib/media'

export default function WorkDetail() {
  const { slug = '' } = useParams()
  const { items, loading } = usePerformances()

  const { current, prev, next } = useMemo(() => {
    const ordered = items.slice().sort((a, b) => b.year - a.year)
    const i = ordered.findIndex((p) => p.slug === slug)
    return {
      current: i >= 0 ? ordered[i] : undefined,
      prev: i > 0 ? ordered[i - 1] : ordered[ordered.length - 1],
      next: i >= 0 && i < ordered.length - 1 ? ordered[i + 1] : ordered[0],
    }
  }, [items, slug])

  if (!current) {
    // While Supabase is still resolving, hold rather than bounce to 404.
    if (loading) return <div className="min-h-screen bg-void" />
    return <Navigate to="/404" replace />
  }

  const category = CATEGORY_MAP[current.category]
  const accent = current.accent ?? category.accent

  // Archive entries carry a year, a runtime and little else until the venue
  // and personnel are filled in, so every optional row drops out rather than
  // rendering an empty definition.
  const meta = [
    { label: 'Year', value: String(current.year) },
    { label: 'Venue', value: current.venue },
    { label: 'City', value: current.city },
    current.role ? { label: 'Role', value: current.role } : null,
    current.runtime ? { label: 'Runtime', value: current.runtime } : null,
    current.tracks.length
      ? {
          label: 'Recording',
          value: totalRuntime(current.tracks.map((t) => t.duration)),
        }
      : null,
  ].filter((m): m is { label: string; value: string } => Boolean(m?.value))

  return (
    <article className="min-h-screen bg-void">
      {/* ---------------- title, then the film ----------------
          The piece announces itself in type before it plays. The full-bleed
          player used to open the page and the title was dragged up over its
          bottom edge, which put the name of the work on top of the work and
          left the controls fighting the <h1> for clicks. Reading order now
          matches the reference: who, what, then watch. */}
      <header className="mx-auto max-w-[1100px] px-6 pt-32 text-center md:px-12 md:pt-40">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <Link
            to={`/work?category=${current.category}`}
            className="label text-dust transition-colors duration-300 hover:text-chalk"
          >
            {category.label} — {current.year}
          </Link>

          <h1 className="tracked mt-8 text-[clamp(1.9rem,6vw,5rem)] leading-[1.06] text-chalk">
            <SplitText text={current.title} delay={0.15} stagger={0.045} />
          </h1>

          <motion.p
            className="mx-auto mt-8 max-w-2xl text-[0.72rem] leading-[2] tracking-[0.18em] text-mist uppercase"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {current.blurb}
          </motion.p>

          <motion.a
            href="#recording"
            className="mt-10 inline-flex flex-col items-center gap-2 text-dust transition-colors duration-300 hover:text-chalk"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.75 }}
          >
            <span className="text-lg leading-none">+</span>
            <span className="label">More info</span>
          </motion.a>
        </motion.div>
      </header>

      <motion.div
        className="mt-16 md:mt-20"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <VideoStage
          poster={current.poster}
          videoSrc={current.videoSrc}
          title={current.title}
          fallbackHref="#recording"
        />
      </motion.div>

      {/* ---------------- meta + body ---------------- */}
      <div className="relative mx-auto max-w-[1600px] px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="mt-24 text-sm font-light tracking-wide text-mist">
            {current.subtitle}
          </p>
        </motion.div>

        {/* ---------------- meta + body ---------------- */}
        <div className="mt-20 grid gap-14 border-t border-edge/50 pt-14 lg:grid-cols-[300px_1fr] lg:gap-24">
          <Reveal>
            <dl className="space-y-6">
              {meta.map((m) => (
                <div key={m.label}>
                  <dt className="label text-dust">{m.label}</dt>
                  <dd className="mt-2 text-sm font-light text-chalk">{m.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <div>
            {current.description && (
              <Reveal>
                <p className="max-w-2xl text-sm leading-[1.9] font-light text-mist/80">
                  {current.description}
                </p>
              </Reveal>
            )}

            {/* ---------------- audio ---------------- */}
            {current.tracks.length > 0 && (
              <Reveal delay={0.1}>
                <div
                  id="recording"
                  className="mt-24 scroll-mt-32 border-t border-edge/50 pt-14"
                >
                  <WaveformPlayer
                    tracks={current.tracks}
                    accent={accent}
                    label={current.venue ? `Listen — ${current.venue}` : 'Listen'}
                  />
                </div>
              </Reveal>
            )}

            {/* ---------------- credits ---------------- */}
            {current.credits.length > 0 && (
              <Reveal delay={0.1}>
                <div className="mt-24 border-t border-edge/50 pt-14">
                  <p className="label mb-8 text-dust">Credits</p>
                  <ul className="grid gap-x-12 gap-y-5 sm:grid-cols-2">
                    {current.credits.map((c) => (
                      <li
                        key={`${c.role}-${c.name}`}
                        className="flex items-baseline justify-between gap-6 border-b border-edge/40 pb-3"
                      >
                        <span className="text-xs tracking-wider text-dust uppercase">
                          {c.role}
                        </span>
                        <span className="text-sm font-light text-chalk">{c.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            )}
          </div>
        </div>

        {/* ---------------- stills ---------------- */}
        {current.gallery.length > 1 && (
          <Reveal>
            <div className="mt-28 border-t border-edge/50 pt-14">
              <p className="label mb-8 text-dust">Stills</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {current.gallery.map((src, i) => (
                  <motion.div
                    key={`${src}-${i}`}
                    className="relative overflow-hidden bg-ink"
                    style={{ aspectRatio: '16 / 10' }}
                    initial={{ opacity: 0, scale: 1.04 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 1, delay: i * 0.08 }}
                  >
                    <img
                      src={mediaUrl(src)}
                      alt={`${current.title} — still ${i + 1}`}
                      loading="lazy"
                      className="h-full w-full object-cover brightness-75 transition-all duration-1000 hover:scale-105 hover:brightness-100"
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </Reveal>
        )}
      </div>

      {/* ---------------- prev / next ---------------- */}
      <nav className="mt-32 grid border-t border-edge/50 sm:grid-cols-2">
        {[
          { p: prev, dir: 'Previous', align: 'text-left' },
          { p: next, dir: 'Next', align: 'sm:text-right' },
        ].map(({ p, dir, align }) => (
          <Link
            key={dir}
            to={`/work/${p.slug}`}
            className="group relative overflow-hidden border-edge/50 px-6 py-16 transition-colors sm:not-last:border-r md:px-12"
          >
            <img
              src={mediaUrl(p.poster)}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-1000 group-hover:scale-105 group-hover:opacity-25"
            />
            <span className="relative block">
              <span className="label text-dust">{dir}</span>
              <span
                className={`tracked-tight mt-4 block text-xl text-chalk transition-colors duration-300 group-hover:text-bloom ${align}`}
              >
                {p.title}
              </span>
            </span>
          </Link>
        ))}
      </nav>
    </article>
  )
}
