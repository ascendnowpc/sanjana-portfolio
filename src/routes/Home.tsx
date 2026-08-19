import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { Performance } from '@/types/content'
import { ImmersiveGallery } from '@/components/gallery/ImmersiveGallery'
import { MagneticLink } from '@/components/ui/MagneticLink'
import { usePerformances } from '@/hooks/useContent'
import { CATEGORY_MAP } from '@/data/categories'
import { PROFILE } from '@/data/site'

/** Large tracked word — the nouns that carry the sentence. */
const Big = ({ children }: { children: React.ReactNode }) => (
  <span className="tracked on-scrim text-[clamp(1.05rem,2.6vw,2.15rem)] text-chalk">
    {children}
  </span>
)

/** Small connective word, sitting between the nouns. */
const Small = ({ children }: { children: React.ReactNode }) => (
  <span className="tracked on-scrim text-[clamp(0.5rem,0.9vw,0.72rem)] text-mist">
    {children}
  </span>
)

export default function Home() {
  const { items } = usePerformances()
  const [focused, setFocused] = useState<Performance | null>(null)

  // The index is a fixed, non-scrolling surface — travel is the scroll here.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const accent = focused
    ? (focused.accent ?? CATEGORY_MAP[focused.category].accent)
    : '#4fd8e8'

  return (
    <div className="fixed inset-0 overflow-hidden bg-void">
      <ImmersiveGallery performances={items} onFocusChange={setFocused} />

      {/* ---------------- centre overlay ---------------- */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
        <AnimatePresence mode="wait">
          {focused ? (
            <motion.div
              key={focused.slug}
              className="max-w-3xl text-center"
              initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="label on-scrim mb-5" style={{ color: accent }}>
                {CATEGORY_MAP[focused.category].label} — {focused.year}
              </p>
              <h2 className="tracked on-scrim text-[clamp(1.4rem,4vw,3.1rem)] leading-[1.25] text-chalk">
                {focused.title}
              </h2>
              <p className="on-scrim mx-auto mt-6 max-w-xl text-[0.78rem] leading-relaxed font-light tracking-wider text-mist uppercase">
                {focused.blurb}
              </p>
              <p className="tracked-tight on-scrim mt-8 text-[0.7rem]" style={{ color: accent }}>
                Learn more
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="welcome"
              className="max-w-4xl text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, filter: 'blur(6px)' }}
              transition={{ duration: 0.7 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-3"
              >
                <p>
                  <Small>Welcome</Small>
                </p>
                <p className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
                  <Small>to</Small>
                  <Big>{PROFILE.name}’S</Big>
                  <Small>universe</Small>
                </p>
                <p className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
                  <Small>of</Small>
                  <Big>Solo Concerts</Big>
                  <Big>+</Big>
                  <Big>Musical Theatre</Big>
                </p>
                <p className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
                  <Small>and</Small>
                  <Big>Honor Choir</Big>
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---------------- bottom nav, reference-style ---------------- */}
      <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-3 px-6 md:bottom-14">
        <p className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
          <Small>the</Small>
          <MagneticLink to="/work" className="pointer-events-auto">
            <span className="tracked on-scrim text-[clamp(0.85rem,1.7vw,1.35rem)] text-chalk transition-colors duration-300 hover:text-bloom">
              Work
            </span>
          </MagneticLink>
          <Small>and</Small>
          <MagneticLink to="/about" className="pointer-events-auto">
            <span className="tracked on-scrim text-[clamp(0.85rem,1.7vw,1.35rem)] text-chalk transition-colors duration-300 hover:text-bloom">
              About
            </span>
          </MagneticLink>
          <Small>me</Small>
        </p>
        <p className="flex items-baseline justify-center gap-x-3">
          <Small>or</Small>
          <MagneticLink to="/contact" className="pointer-events-auto">
            <span className="tracked on-scrim text-[clamp(0.85rem,1.7vw,1.35rem)] text-chalk transition-colors duration-300 hover:text-bloom">
              Contact
            </span>
          </MagneticLink>
        </p>
      </div>

      {/* ---------------- drift hint ---------------- */}
      <motion.div
        className="pointer-events-none absolute right-6 bottom-10 hidden items-center gap-3 md:flex md:right-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: focused ? 0 : 1 }}
        transition={{ duration: 0.6, delay: focused ? 0 : 1.6 }}
      >
        <span className="label text-dust">Drag to travel · sideways to pan</span>
        <span className="breathe block h-6 w-px bg-gradient-to-b from-transparent via-bloom to-transparent" />
      </motion.div>

      {/* Tiles are decorative for assistive tech (they duplicate down the
          tunnel); this is the real, linear index of the same work. */}
      <nav className="sr-only">
        <h2>All work</h2>
        <ul>
          {items.map((p) => (
            <li key={p.slug}>
              <Link to={`/work/${p.slug}`}>
                {p.title} — {p.subtitle}, {p.year}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
