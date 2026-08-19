import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePerformances } from '@/hooks/useContent'
import { CATEGORY_MAP } from '@/data/categories'
import { VideoStage } from '@/components/media/VideoStage'
import { WaveformPlayer } from '@/components/audio/WaveformPlayer'
import { Reveal } from '@/components/ui/Reveal'
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

  const meta = [
    { label: 'Year', value: String(current.year) },
    { label: 'Venue', value: current.venue },
    { label: 'City', value: current.city },
    current.role ? { label: 'Role', value: current.role } : null,
    current.runtime ? { label: 'Runtime', value: current.runtime } : null,
    {
      label: 'Recording',
      value: totalRuntime(current.tracks.map((t) => t.duration)),
    },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <article className="min-h-screen bg-void">
      <VideoStage
        poster={current.poster}
        videoSrc={current.videoSrc}
        title={current.title}
        accent={accent}
        fallbackHref="#recording"
      />

      {/* ---------------- title block ---------------- */}
      <div className="relative mx-auto -mt-24 max-w-[1600px] px-6 md:-mt-32 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link
            to={`/work?category=${current.category}`}
            className="label transition-opacity hover:opacity-70"
            style={{ color: accent }}
          >
            {category.label}
          </Link>
          <h1 className="tracked mt-5 text-[clamp(1.8rem,5.5vw,4.5rem)] leading-[1.08] text-chalk">
            {current.title}
          </h1>
          <p className="mt-4 text-sm font-light tracking-wide text-mist">
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
            <Reveal>
              <p className="max-w-2xl text-lg leading-[1.75] font-light text-mist md:text-xl">
                {current.blurb}
              </p>
              <p className="mt-8 max-w-2xl text-sm leading-[1.9] font-light text-mist/80">
                {current.description}
              </p>
            </Reveal>

            {/* ---------------- audio ---------------- */}
            <Reveal delay={0.1}>
              <div
                id="recording"
                className="mt-24 scroll-mt-32 border-t border-edge/50 pt-14"
              >
                <WaveformPlayer
                  tracks={current.tracks}
                  accent={accent}
                  label={`Listen — ${current.venue}`}
                />
              </div>
            </Reveal>

            {/* ---------------- credits ---------------- */}
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
