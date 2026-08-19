import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import type { CategoryId } from '@/types/content'
import { CATEGORIES, CATEGORY_MAP } from '@/data/categories'
import { usePerformances } from '@/hooks/useContent'
import { useTransition } from '@/components/layout/TransitionProvider'
import { Reveal } from '@/components/ui/Reveal'
import { SplitText } from '@/components/ui/SplitText'
import { cn } from '@/lib/utils'
import { mediaUrl } from '@/lib/media'

type Filter = CategoryId | 'all'

export default function Work() {
  const { items } = usePerformances()
  const [params, setParams] = useSearchParams()
  const active = (params.get('category') as Filter) ?? 'all'
  const { zoomTo } = useTransition()

  const filtered = useMemo(
    () =>
      (active === 'all' ? items : items.filter((p) => p.category === active))
        .slice()
        .sort((a, b) => b.year - a.year),
    [items, active],
  )

  const setFilter = (f: Filter) => {
    if (f === 'all') setParams({}, { replace: true })
    else setParams({ category: f }, { replace: true })
  }

  return (
    <div className="min-h-screen bg-void pt-36 pb-32">
      <div className="mx-auto max-w-[1600px] px-6 md:px-12">
        <header className="mb-16">
          <p className="label mb-6 text-bloom">The Work</p>
          <h1 className="tracked text-[clamp(2rem,6vw,4.75rem)] leading-[1.1] text-chalk">
            <SplitText text="Every Room" />
          </h1>
          <p className="mt-8 max-w-xl text-sm leading-relaxed font-light text-mist">
            Concert halls, black boxes, chapels and garages — sorted newest
            first. Open anything to watch it in full and hear the recording.
          </p>
        </header>

        {/* Filters */}
        <div className="mb-14 flex flex-wrap items-center gap-x-8 gap-y-4 border-y border-edge/50 py-5">
          {(
            [{ id: 'all', label: 'All Work', accent: '#4fd8e8' }, ...CATEGORIES] as const
          ).map((c) => {
            const on = active === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilter(c.id as Filter)}
                className="group relative py-1"
              >
                <span
                  className={cn(
                    'label transition-colors duration-300',
                    on ? 'text-chalk' : 'text-dust hover:text-mist',
                  )}
                >
                  {c.label}
                </span>
                <span
                  className="absolute -bottom-0.5 left-0 h-px transition-all duration-500"
                  style={{
                    width: on ? '100%' : 0,
                    background: c.accent,
                    boxShadow: on ? `0 0 12px ${c.accent}` : 'none',
                  }}
                />
              </button>
            )
          })}

          <span className="label ml-auto text-dust tabular-nums">
            {String(filtered.length).padStart(2, '0')} pieces
          </span>
        </div>

        {active !== 'all' && (
          <p className="mb-10 max-w-lg text-sm font-light text-mist">
            {CATEGORY_MAP[active].blurb}
          </p>
        )}

        {/* Grid */}
        <motion.ul layout className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((p, i) => (
              <WorkCard
                key={p.slug}
                index={i}
                slug={p.slug}
                title={p.title}
                subtitle={p.subtitle}
                year={p.year}
                city={p.city}
                poster={p.poster}
                accent={p.accent ?? CATEGORY_MAP[p.category].accent}
                trackCount={p.tracks.length}
                onOpen={(el) => zoomTo(el, p.poster, p.title, `/work/${p.slug}`)}
              />
            ))}
          </AnimatePresence>
        </motion.ul>

        {!filtered.length && (
          <Reveal>
            <p className="py-24 text-center text-sm text-dust">
              Nothing filed under this category yet.
            </p>
          </Reveal>
        )}
      </div>
    </div>
  )
}

interface CardProps {
  index: number
  slug: string
  title: string
  subtitle: string
  year: number
  city: string
  poster: string
  accent: string
  trackCount: number
  onOpen: (el: HTMLElement) => void
}

function WorkCard({
  index,
  title,
  subtitle,
  year,
  city,
  poster,
  accent,
  trackCount,
  onOpen,
}: CardProps) {
  const [hover, setHover] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 34 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{
        duration: 0.7,
        delay: Math.min(index * 0.05, 0.4),
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <button
        type="button"
        onClick={() => frameRef.current && onOpen(frameRef.current)}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        className="group block w-full text-left"
      >
        <div
          ref={frameRef}
          className="relative overflow-hidden bg-ink"
          style={{
            aspectRatio: '16 / 10',
            transition: 'box-shadow 600ms',
            boxShadow: hover
              ? `0 0 0 1px ${accent}55, 0 40px 80px -40px ${accent}99`
              : '0 0 0 1px rgba(29,42,63,0.6)',
          }}
        >
          <img
            src={mediaUrl(poster)}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            style={{
              transition: 'transform 1.4s var(--ease-out-expo), filter 700ms',
              transform: hover ? 'scale(1.07)' : 'scale(1)',
              filter: hover
                ? 'brightness(1) saturate(1.1)'
                : 'brightness(0.62) saturate(0.8)',
            }}
          />

          {/* Light sweep on hover */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-y-0 w-1/3 opacity-0 group-hover:opacity-100"
              style={{
                background: `linear-gradient(100deg, transparent, ${accent}26, transparent)`,
                animation: hover ? 'sweep 1.1s var(--ease-out-expo)' : 'none',
              }}
            />
          </div>

          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
            style={{ background: 'linear-gradient(to top, #04070f, transparent)' }}
          />

          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
            <span className="label text-mist">{city}</span>
            <span
              className="label flex items-center gap-1.5"
              style={{ color: accent }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5l12 7-12 7z" />
              </svg>
              {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              className="tracked-tight truncate text-base transition-colors duration-300"
              style={{ color: hover ? accent : '#e8f1f8' }}
            >
              {title}
            </h2>
            <p className="mt-1.5 truncate text-xs font-light text-mist">{subtitle}</p>
          </div>
          <span className="label shrink-0 pt-1 text-dust tabular-nums">{year}</span>
        </div>
      </button>
    </motion.li>
  )
}
