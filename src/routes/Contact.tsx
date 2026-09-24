import { useState } from 'react'
import { motion } from 'framer-motion'
import { useProfile, useUi } from '@/content/ContentProvider'
import { useEdit } from '@/edit/EditProvider'
import { EditableText } from '@/components/edit/Editable'
import { ItemControls, RegionEdit } from '@/components/edit/ListEdit'
import { Reveal } from '@/components/ui/Reveal'
import { SplitText } from '@/components/ui/SplitText'

type Status = 'idle' | 'sending' | 'sent'

export default function Contact() {
  const profile = useProfile()
  const ui = useUi()
  const { editing } = useEdit()
  const enquiryTypes = ui.contact.enquiryTypes
  /**
   * `null` means "whatever the first type is", rather than a copy of it.
   *
   * The list is editable, so the selected value has to survive its own label
   * being rewritten from the panel: holding the string would leave the chip
   * row with nothing lit the moment somebody fixes a typo in the first entry.
   */
  const [type, setType] = useState<string | null>(null)
  const selected = type ?? enquiryTypes[0]
  const [status, setStatus] = useState<Status>('idle')

  /**
   * No backend is wired up yet — see DATABASE.md for the two-line Supabase
   * insert (or a Formspree endpoint) that turns this into a live form.
   */
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus('sending')
    window.setTimeout(() => setStatus('sent'), 900)
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
              <fieldset className="mb-12">
                <legend className="label mb-5 text-dust">
                  <EditableText
                    path={['ui', 'contact', 'enquiryLegend']}
                    value={ui.contact.enquiryLegend}
                  />
                </legend>
                <div className="flex flex-wrap items-center gap-3">
                  {enquiryTypes.map((t, i) => {
                    const on = selected === t
                    return (
                      <span key={`${t}-${i}`} className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setType(t)}
                          aria-pressed={on}
                          className="border px-5 py-2.5 text-[0.62rem] tracking-[0.28em] uppercase transition-all duration-400"
                          style={{
                            borderColor: on ? '#ffffff' : '#2e2e2e',
                            color: on ? 'var(--color-void)' : '#9a9a9a',
                            background: on ? '#ffffff' : 'transparent',
                          }}
                        >
                          <EditableText
                            path={['ui', 'contact', 'enquiryTypes', i]}
                            value={t}
                            placeholder="Kind of enquiry"
                          />
                        </button>
                        <ItemControls
                          path={['ui', 'contact', 'enquiryTypes']}
                          index={i}
                          blank={() => 'Something else'}
                        />
                      </span>
                    )
                  })}
                </div>
              </fieldset>

              <div className="space-y-10">
                <Field label={ui.contact.fields.name} name="name" required />
                <Field
                  label={ui.contact.fields.email}
                  name="email"
                  type="email"
                  required
                />
                <Field label={ui.contact.fields.date} name="date" />
                <Field
                  label={ui.contact.fields.message}
                  name="message"
                  textarea
                />
              </div>

              <motion.button
                type="submit"
                disabled={status !== 'idle'}
                whileTap={{ scale: 0.98 }}
                className="mt-14 w-full border border-edge px-10 py-4 text-[0.62rem] tracking-[0.34em] text-chalk uppercase transition-all duration-500 hover:border-bloom hover:bg-bloom hover:text-void disabled:opacity-60 sm:w-auto"
              >
                {status === 'idle' && ui.contact.submit}
                {status === 'sending' && ui.contact.sending}
                {status === 'sent' && ui.contact.sent}
              </motion.button>

              {status === 'sent' && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 text-xs font-light text-mist"
                >
                  {ui.contact.demoNote}
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
                    path={['ui', 'contact', 'bookingLabel']}
                    value={ui.contact.bookingLabel}
                  />
                </p>
                <a
                  href={`mailto:${profile.contact.booking}`}
                  className="text-sm font-light text-chalk transition-colors hover:text-bloom"
                >
                  <EditableText
                    path={['profile', 'contact', 'booking']}
                    value={profile.contact.booking}
                  />
                </a>
              </div>
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
              <div>
                <p className="label mb-4 text-dust">
                  <EditableText
                    path={['ui', 'contact', 'elsewhereLabel']}
                    value={ui.contact.elsewhereLabel}
                  />
                </p>
                <div className="flex flex-col gap-2.5">
                  {[
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
                  ].map((s) => (
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
  required?: boolean
  textarea?: boolean
}

/** Underline-only input — the line lights up as it gains focus. */
function Field({ label, name, type = 'text', required, textarea }: FieldProps) {
  const shared =
    'peer w-full border-0 border-b border-edge bg-transparent pt-2 pb-3 text-sm font-light text-chalk placeholder-transparent transition-colors focus:border-bloom focus:outline-none'

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
