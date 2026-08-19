import { Link } from 'react-router-dom'
import { PROFILE } from '@/data/site'

const SOCIALS = [
  { label: 'Instagram', href: PROFILE.contact.instagram },
  { label: 'YouTube', href: PROFILE.contact.youtube },
  { label: 'Spotify', href: PROFILE.contact.spotify },
]

export function Footer() {
  return (
    <footer className="relative border-t border-edge/50 bg-void">
      <div className="mx-auto max-w-[1600px] px-6 py-20 md:px-12">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="tracked text-xl text-chalk">{PROFILE.name}</p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed font-light text-mist">
              {PROFILE.tagline}
            </p>
            <p className="label mt-8 text-dust">{PROFILE.basedIn}</p>
          </div>

          <nav className="flex flex-col gap-3">
            <p className="label mb-2 text-dust">Site</p>
            {[
              { to: '/work', label: 'The Work' },
              { to: '/about', label: 'About' },
              { to: '/contact', label: 'Contact' },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="w-fit text-sm font-light text-mist transition-colors hover:text-bloom"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-3">
            <p className="label mb-2 text-dust">Elsewhere</p>
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer noopener"
                className="w-fit text-sm font-light text-mist transition-colors hover:text-bloom"
              >
                {s.label}
              </a>
            ))}
            <a
              href={`mailto:${PROFILE.contact.booking}`}
              className="mt-4 w-fit text-sm font-light text-bloom"
            >
              {PROFILE.contact.booking}
            </a>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-edge/40 pt-8 text-[0.68rem] tracking-widest text-dust uppercase md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {PROFILE.name}
          </p>
          <p>All performances and recordings by arrangement.</p>
        </div>
      </div>
    </footer>
  )
}
