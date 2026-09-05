import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PROFILE } from '@/data/site'
import { TROUGH, chip } from '@/components/works/Segmented'
import { cn } from '@/lib/utils'

/**
 * The top bar.
 *
 * Two of the same control the archive uses, parked at the two ends of the
 * screen: the wordmark and the two section keys in one trough on the left, the
 * one thing you are being asked to do in another on the right. That is the
 * reference's bar exactly — its own is `FORMS · WORKS · ABOUT` against a lone
 * `INSTAGRAM` — and it is built here out of `TROUGH` and `chip` rather than
 * out of a second set of styles that look like them.
 *
 * The bar carries no colour and no rules of its own. It used to: the live
 * section was cyan with a cyan underline growing under it, on a page whose
 * only other light was the stage lighting inside the frames. A white key in a
 * grey trough says the same thing in the same language as everything below it.
 */

const SECTIONS = [
  { to: '/work', label: 'Work' },
  { to: '/about', label: 'About' },
]

/** The one thing the bar asks for, always lit — the reference's right-hand
 *  button is white whichever page you are on, because it is the errand rather
 *  than a place you might already be. */
const CTA = { to: '/contact', label: 'Contact' }

const ALL = [...SECTIONS, CTA]

export function Nav() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => setOpen(false), [pathname])

  const at = (to: string) => pathname === to || pathname.startsWith(`${to}/`)

  return (
    <>
      {/* No scrolled state and no backdrop of its own. The troughs are already
          opaque wells with their own blur, so they hold against anything that
          scrolls under them, and a bar that grew a background at 24px was one
          more edge drawn across the top of a page built out of edges. */}
      <header className="fixed inset-x-0 top-0 z-50">
        <nav className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-5 md:px-12">
          <div className={TROUGH}>
            <Link
              to="/"
              // The wordmark keeps the serif and its wide tracking — it is the
              // one piece of lettering in the bar that is a name rather than a
              // key, and it sits directly on the well, not in a chip.
              className="tracked px-2.5 text-sm text-white transition-opacity duration-300 hover:opacity-70 md:px-3"
            >
              {PROFILE.name}
            </Link>
            {SECTIONS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={cn(chip(at(l.to)), 'hidden md:block')}
              >
                {l.label}
              </NavLink>
            ))}
          </div>

          <div className={cn(TROUGH, 'hidden md:flex')}>
            <NavLink to={CTA.to} className={chip(true)}>
              {CTA.label}
            </NavLink>
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="flex h-8 w-8 flex-col items-end justify-center gap-1.5 md:hidden"
          >
            <span
              className={cn(
                'h-px bg-chalk transition-all duration-400',
                open ? 'w-6 translate-y-[3.5px] rotate-45' : 'w-6',
              )}
            />
            <span
              className={cn(
                'h-px bg-chalk transition-all duration-400',
                open ? 'w-6 -translate-y-[3.5px] -rotate-45' : 'w-4',
              )}
            />
          </button>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-void/95 backdrop-blur-2xl md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            {ALL.map((l, i) => (
              <motion.div
                key={l.to}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.07, duration: 0.5 }}
              >
                {/* The same keys, stacked and scaled up rather than restyled
                    into a list of links — the sheet is the bar, opened. */}
                <NavLink
                  to={l.to}
                  className={cn(
                    chip(l === CTA || at(l.to)),
                    'block px-8 py-4 text-sm',
                  )}
                >
                  {l.label}
                </NavLink>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
