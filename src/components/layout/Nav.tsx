import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PROFILE } from '@/data/site'
import { TROUGH, chip } from '@/components/works/Segmented'
import { cn } from '@/lib/utils'
import { mediaUrl } from '@/lib/media'

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

/**
 * What a hover is worth.
 *
 * Every destination in this bar is a split chunk, so a click currently starts
 * a chain the reader waits through end to end: fetch the chunk, parse it,
 * render it, and only then does the page discover the first image it needs and
 * go and ask for that too. Each link in that chain is a round trip to a
 * different origin, and none of them can start until the one before it
 * finishes.
 *
 * A pointer resting on a link is the strongest signal of intent a page ever
 * gets, and it arrives a few hundred milliseconds before the click. That is
 * enough to have the chunk in memory and, for About, its opening frame in the
 * cache — so the click lands on a page that has already been fetched rather
 * than one that starts fetching.
 *
 * Deliberately only the chunk and the one poster. The About film is eleven
 * megabytes and hovering is not clicking; speculatively pulling that down
 * would spend a reader's connection on a page they may never open, and worse,
 * spend it competing with the page they are actually on.
 */
const WARM: Record<string, () => void> = {
  '/work': () => void import('@/routes/Work'),
  '/contact': () => void import('@/routes/Contact'),
  '/about': () =>
    void import('@/routes/About').then((m) => {
      const url = mediaUrl(m.ABOUT_FILM_POSTER)
      if (url) new Image().src = url
    }),
}

/** Asked for once per destination, and never for a reader who has told their
 *  browser to save data — speculation is exactly what that setting is about. */
const warmed = new Set<string>()
function warm(to: string) {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection
  if (connection?.saveData === true) return
  if (warmed.has(to)) return
  warmed.add(to)
  WARM[to]?.()
}

/** The handlers that mean "this one, probably", on a pointer and on a
 *  keyboard. Touch is left out on purpose: on a phone the first tap is
 *  already the click, so there is no gap to fill and nothing to gain. */
const intent = (to: string) => ({
  onPointerEnter: () => warm(to),
  onFocus: () => warm(to),
})

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
                {...intent(l.to)}
                className={cn(chip(at(l.to)), 'hidden md:block')}
              >
                {l.label}
              </NavLink>
            ))}
          </div>

          <div className={cn(TROUGH, 'hidden md:flex')}>
            <NavLink to={CTA.to} {...intent(CTA.to)} className={chip(true)}>
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
