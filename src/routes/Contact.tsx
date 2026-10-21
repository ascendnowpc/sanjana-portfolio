import { useState } from 'react'
import { motion } from 'framer-motion'
import { useProfile, useUi } from '@/content/ContentProvider'
import { useEdit } from '@/edit/EditProvider'
import { fill } from '@/lib/copy'
import { EditableText } from '@/components/edit/Editable'
import { RegionEdit } from '@/components/edit/ListEdit'
import { Reveal } from '@/components/ui/Reveal'
import { SplitText } from '@/components/ui/SplitText'

type Status = 'idle' | 'sending' | 'sent' | 'failed'

export default function Contact() {
  const profile = useProfile()
  const ui = useUi()
  const { editing } = useEdit()
  const [status, setStatus] = useState<Status>('idle')

  const socials = [
    {
      label: ui.socials.instagram,
      href: profile.contact.instagram,
      path: ['ui', 'socials', 'instagram'] as (string | number)[],
    },
    {
      label: ui.socials.youtube,
      href: profile.contact.youtube,
      path: ['ui', 'socials', 'youtube'] as (string | number)[],
    },
    {
      label: ui.socials.spotify,
      href: profile.contact.spotify,
      path: ['ui', 'socials', 'spotify'] as (string | number)[],
    },
  ].filter((s) => s.href.trim())

  /** Delivered by api/contact.ts, which emails it on. */
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    setStatus('sending')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean } | null
      if (!res.ok || !body?.ok) throw new Error(`HTTP ${res.status}`)
      form.reset()
      setStatus('sent')
    } catch {
      // Back to a pressable button: what failed may well work a second time,
      // and the note under it gives the address for when it does not.
      setStatus('failed')
    }
  }

  return (
    <div className="min-h-screen bg-void pt-36 pb-32">
      <div className="mx-auto max-w-[1600px] px-6 md:px-12">
        <header className="mb-20">
          <p className="label mb-6 text-bloom">
            <EditableText
              path={['ui', 'contact', 'eyebrow']}
              value={ui.contact.eyebrow}
            />
          </p>
          <h1 className="tracked text-[clamp(2rem,6vw,4.75rem)] leading-[1.1] text-chalk">
            {/* `SplitText` animates one span a character, which a caret cannot
                live inside. */}
            {editing ? (
              <EditableText
                path={['ui', 'contact', 'heading']}
                value={ui.contact.heading}
              />
            ) : (
              <SplitText text={ui.contact.heading} />
            )}
          </h1>
          {editing && (
            <div className="mt-8 flex flex-wrap gap-3">
              <RegionEdit drawer="copy" label="Contact page copy" />
              <RegionEdit drawer="profile" label="Addresses & links" />
            </div>
          )}
        </header>

        <div className="grid gap-16 lg:grid-cols-[1fr_380px] lg:gap-24">
          {/* ---------------- form ---------------- */}
          <Reveal>
            <form onSubmit={submit} className="max-w-2xl">
              {/* Who, how to answer, and what they want to say — a note, not
                  a booking request, so nothing is asked for that a person
                  writing one would not already know to put in it. */}
              <div className="space-y-10">
                <Field
                  label={ui.contact.fields.name}
                  name="name"
                  autoComplete="name"
                  required
                />
                <Field
                  label={ui.contact.fields.email}
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
                <Field
                  label={ui.contact.fields.message}
                  name="message"
                  required
                  textarea
                />
              </div>

              {/* A trap for form-filling bots: off screen, out of the tab
                  order and hidden from assistive tech, so only a script ever
                  fills it in. api/contact.ts drops anything that does. Outside
                  the fields above, whose spacing would otherwise count it. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
                className="absolute -left-[9999px] h-px w-px opacity-0"
              />

              <motion.button
                type="submit"
                disabled={status === 'sending' || status === 'sent'}
                whileTap={{ scale: 0.98 }}
                className="mt-14 w-full border border-edge px-10 py-4 text-[0.62rem] tracking-[0.34em] text-chalk uppercase transition-all duration-500 hover:border-bloom hover:bg-bloom hover:text-void disabled:opacity-60 sm:w-auto"
              >
                {(status === 'idle' || status === 'failed') && ui.contact.submit}
                {status === 'sending' && ui.contact.sending}
                {status === 'sent' && ui.contact.sent}
              </motion.button>

              {(status === 'sent' || status === 'failed') && (
                <motion.p
                  key={status}
                  role="status"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 text-xs font-light text-mist"
                >
                  {status === 'sent'
                    ? ui.contact.sentNote
                    : fill(ui.contact.failedNote, { email: profile.contact.email })}
                </motion.p>
              )}
            </form>
          </Reveal>

          {/* ---------------- direct ---------------- */}
          <Reveal delay={0.1}>
            <aside className="space-y-12 border-t border-edge/50 pt-10 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-14">
              <div>
                <p className="label mb-4 text-dust">
                  <EditableText
                    path={['ui', 'contact', 'generalLabel']}
                    value={ui.contact.generalLabel}
                  />
                </p>
                <a
                  href={`mailto:${profile.contact.email}`}
                  className="text-sm font-light text-chalk transition-colors hover:text-bloom"
                >
                  <EditableText
                    path={['profile', 'contact', 'email']}
                    value={profile.contact.email}
                  />
                </a>
              </div>
              {/* Only once there is a profile to point at — see the footer. */}
              {socials.length > 0 && (
                <div>
                  <p className="label mb-4 text-dust">
                    <EditableText
                      path={['ui', 'contact', 'elsewhereLabel']}
                      value={ui.contact.elsewhereLabel}
                    />
                  </p>
                  <div className="flex flex-col gap-2.5">
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
                  </div>
                </div>
              )}
              <div>
                <p className="label mb-4 text-dust">
                  <EditableText
                    path={['ui', 'contact', 'basedLabel']}
                    value={ui.contact.basedLabel}
                  />
                </p>
                <p className="text-sm font-light text-chalk">
                  <EditableText path={['profile', 'basedIn']} value={profile.basedIn} />
                </p>
              </div>
            </aside>
          </Reveal>
        </div>
      </div>
    </div>
  )
}

interface FieldProps {
  label: string
  name: string
  type?: string
  autoComplete?: string
  required?: boolean
  textarea?: boolean
}

/** Underline-only input — the line lights up as it gains focus. */
function Field({
  label,
  name,
  type = 'text',
  autoComplete,
  required,
  textarea,
}: FieldProps) {
  // 16px on a phone, not the 14px it is set at from `md` up: iOS zooms the
  // whole page in on any field set smaller than that the moment it is tapped,
  // and does not zoom back out when the field is left.
  const shared =
    'peer w-full border-0 border-b border-edge bg-transparent pt-2 pb-3 text-base font-light text-chalk placeholder-transparent transition-colors focus:border-bloom focus:outline-none md:text-sm'

  return (
    <div className="relative">
      {textarea ? (
        <textarea
          id={name}
          name={name}
          rows={4}
          placeholder={label}
          required={required}
          className={`${shared} resize-none`}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          autoComplete={autoComplete}
          placeholder={label}
          required={required}
          className={shared}
        />
      )}
      <label
        htmlFor={name}
        className="label pointer-events-none absolute -top-3 left-0 text-dust transition-all duration-300 peer-placeholder-shown:top-2 peer-placeholder-shown:text-[0.75rem] peer-placeholder-shown:tracking-normal peer-placeholder-shown:normal-case peer-focus:-top-3 peer-focus:text-[0.625rem] peer-focus:tracking-[0.32em] peer-focus:text-bloom peer-focus:uppercase"
      >
        {label}
      </label>
    </div>
  )
}
