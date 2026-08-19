import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PROFILE } from '@/data/site'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/work', label: 'Work' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export function Nav() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setOpen(false), [pathname])

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-700',
          !isHome && scrolled
            ? 'border-b border-edge/50 bg-void/80 backdrop-blur-xl'
            : 'border-b border-transparent',
        )}
      >
        <nav className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-6 md:px-12">
          <Link to="/" className="group leading-none">
            <span className="tracked block text-sm text-chalk transition-colors group-hover:text-bloom md:text-base">
              {PROFILE.name}
            </span>
            <span className="label mt-1.5 block text-dust">{PROFILE.role}</span>
          </Link>

          <div className="hidden items-center gap-10 md:flex">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    'label relative py-1 transition-colors duration-300',
                    isActive ? 'text-bloom' : 'text-mist hover:text-chalk',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {l.label}
                    <span
                      className={cn(
                        'absolute -bottom-0.5 left-0 h-px bg-bloom transition-all duration-500',
                        isActive ? 'w-full' : 'w-0',
                      )}
                    />
                  </>
                )}
              </NavLink>
            ))}
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
            className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-void/95 backdrop-blur-2xl md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            {LINKS.map((l, i) => (
              <motion.div
                key={l.to}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.07, duration: 0.5 }}
              >
                <NavLink
                  to={l.to}
                  className="tracked text-2xl text-chalk"
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
