import { Link } from 'react-router-dom'
import { useProfile, useUi } from '@/content/ContentProvider'
import { useEdit } from '@/edit/EditProvider'
import { fill } from '@/lib/copy'
import { EditableText } from '@/components/edit/Editable'
import { ItemControls, RegionEdit } from '@/components/edit/ListEdit'

export function Footer() {
  const profile = useProfile()
  const ui = useUi()
  const { editing } = useEdit()

  const socials = [
    {
      label: ui.socials.instagram,
      href: profile.contact.instagram,
      path: ['ui', 'socials', 'instagram'] as const,
    },
    {
      label: ui.socials.youtube,
      href: profile.contact.youtube,
      path: ['ui', 'socials', 'youtube'] as const,
    },
    {
      label: ui.socials.spotify,
      href: profile.contact.spotify,
      path: ['ui', 'socials', 'spotify'] as const,
    },
  ]

  return (
    <footer className="relative border-t border-edge/50 bg-void">
      <div className="mx-auto max-w-[1600px] px-6 py-20 md:px-12">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="tracked text-xl text-chalk">
              <EditableText path={['profile', 'name']} value={profile.name} />
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed font-light text-mist">
              <EditableText
                path={['profile', 'tagline']}
                value={profile.tagline}
                multiline
              />
            </p>
            <p className="label mt-8 text-dust">
              <EditableText path={['profile', 'basedIn']} value={profile.basedIn} />
            </p>
          </div>

          <nav className="flex flex-col gap-3">
            <p className="label mb-2 text-dust">
              <EditableText
                path={['ui', 'footer', 'siteHeading']}
                value={ui.footer.siteHeading}
              />
            </p>
            {ui.footer.links.map((l, i) => (
              <span key={`${l.to}-${i}`} className="flex w-fit items-center gap-2">
                <Link
                  to={l.to}
                  className="w-fit text-sm font-light text-mist transition-colors hover:text-bloom"
                >
                  <EditableText
                    path={['ui', 'footer', 'links', i, 'label']}
                    value={l.label}
                  />
                </Link>
                {/* The destination is not a word on the page, so it is edited in
                    the drawer rather than guessed at from the label. */}
                <ItemControls
                  path={['ui', 'footer', 'links']}
                  index={i}
                  blank={() => ({ to: '/', label: 'New link' })}
                />
              </span>
            ))}
          </nav>

          <div className="flex flex-col gap-3">
            <p className="label mb-2 text-dust">
              <EditableText
                path={['ui', 'footer', 'elsewhereHeading']}
                value={ui.footer.elsewhereHeading}
              />
            </p>
            {socials.map((s) => (
              <a
                key={s.path.join('.')}
                href={s.href}
                target="_blank"
                rel="noreferrer noopener"
                className="w-fit text-sm font-light text-mist transition-colors hover:text-bloom"
              >
                <EditableText path={s.path} value={s.label} />
              </a>
            ))}
            <a
              href={`mailto:${profile.contact.booking}`}
              className="mt-4 w-fit text-sm font-light text-bloom"
            >
              <EditableText
                path={['profile', 'contact', 'booking']}
                value={profile.contact.booking}
              />
            </a>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-edge/40 pt-8 text-[0.68rem] tracking-widest text-dust uppercase md:flex-row md:items-center md:justify-between">
          <p>
            {/* The template, not the filled string: the year and the name are
                substituted at render, so editing the sentence means editing the
                slots too. `{year}` and `{name}` have to survive the edit — see
                `fill` in lib/copy.ts. */}
            {editing ? (
              <EditableText
                path={['ui', 'footer', 'copyright']}
                value={ui.footer.copyright}
                title="Footer ▸ copyright (keep {year} and {name})"
              />
            ) : (
              fill(ui.footer.copyright, {
                year: new Date().getFullYear(),
                name: profile.name,
              })
            )}
          </p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-8">
            <p>
              <EditableText path={['ui', 'footer', 'rights']} value={ui.footer.rights} />
            </p>
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
              <EditableText
                path={['ui', 'footer', 'adminLabel']}
                value={ui.footer.adminLabel}
              />
            </Link>
            {editing && <RegionEdit drawer="copy" label="Footer & link targets" />}
          </div>
        </div>
      </div>
    </footer>
  )
}
