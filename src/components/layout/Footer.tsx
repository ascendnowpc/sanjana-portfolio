import { Link } from 'react-router-dom'
import { useProfile, useUi } from '@/content/ContentProvider'
import { fill } from '@/lib/copy'

export function Footer() {
  const profile = useProfile()
  const ui = useUi()

  const socials = [
    { label: ui.socials.instagram, href: profile.contact.instagram },
    { label: ui.socials.youtube, href: profile.contact.youtube },
    { label: ui.socials.spotify, href: profile.contact.spotify },
  ]

  return (
    <footer className="relative border-t border-edge/50 bg-void">
      <div className="mx-auto max-w-[1600px] px-6 py-20 md:px-12">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="tracked text-xl text-chalk">{profile.name}</p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed font-light text-mist">
              {profile.tagline}
            </p>
            <p className="label mt-8 text-dust">{profile.basedIn}</p>
          </div>

          <nav className="flex flex-col gap-3">
            <p className="label mb-2 text-dust">{ui.footer.siteHeading}</p>
            {ui.footer.links.map((l) => (
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
            <p className="label mb-2 text-dust">{ui.footer.elsewhereHeading}</p>
            {socials.map((s) => (
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
              href={`mailto:${profile.contact.booking}`}
              className="mt-4 w-fit text-sm font-light text-bloom"
            >
              {profile.contact.booking}
            </a>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-edge/40 pt-8 text-[0.68rem] tracking-widest text-dust uppercase md:flex-row md:items-center md:justify-between">
          <p>
            {fill(ui.footer.copyright, {
              year: new Date().getFullYear(),
              name: profile.name,
            })}
          </p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-8">
            <p>{ui.footer.rights}</p>
            {/* The way in to the panel.
                Set apart from the site links above rather than filed among
                them: this is not a page of the site, it is the door behind
                it, and a visitor reading the footer should be able to tell
                the difference at a glance. Dimmer than its neighbours for the
                same reason, and it lights on hover like everything else here
                so it is still plainly a link. */}
            <Link
              to="/admin"
              className="w-fit text-dust/55 transition-colors duration-300 hover:text-bloom"
            >
              {ui.footer.adminLabel}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
