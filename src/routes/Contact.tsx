import { useState } from 'react'
import { motion } from 'framer-motion'
import { PROFILE } from '@/data/site'
import { Reveal } from '@/components/ui/Reveal'
import { SplitText } from '@/components/ui/SplitText'

const ENQUIRY_TYPES = [
  'Solo concert',
  'Theatre casting',
  'Session vocals',
  'Collaboration',
] as const

type Status = 'idle' | 'sending' | 'sent'

export default function Contact() {
  const [type, setType] = useState<string>(ENQUIRY_TYPES[0])
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
          <p className="label mb-6 text-bloom">Contact</p>
          <h1 className="tracked text-[clamp(2rem,6vw,4.75rem)] leading-[1.1] text-chalk">
            <SplitText text="Say hello" />
          </h1>
        </header>

        <div className="grid gap-16 lg:grid-cols-[1fr_380px] lg:gap-24">
          {/* ---------------- form ---------------- */}
          <Reveal>
            <form onSubmit={submit} className="max-w-2xl">
              <fieldset className="mb-12">
                <legend className="label mb-5 text-dust">Enquiry type</legend>
                <div className="flex flex-wrap gap-3">
                  {ENQUIRY_TYPES.map((t) => {
                    const on = type === t
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        aria-pressed={on}
                        className="border px-5 py-2.5 text-[0.62rem] tracking-[0.28em] uppercase transition-all duration-400"
                        style={{
                          borderColor: on ? '#4fd8e8' : '#1d2a3f',
                          color: on ? 'var(--color-void)' : '#8ea6c0',
                          background: on ? '#4fd8e8' : 'transparent',
                        }}
                      >
                        {t}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <div className="space-y-10">
                <Field label="Your name" name="name" required />
                <Field label="Email" name="email" type="email" required />
                <Field label="Date or window" name="date" />
                <Field label="Tell me about the room" name="message" textarea />
              </div>

              <motion.button
                type="submit"
                disabled={status !== 'idle'}
                whileTap={{ scale: 0.98 }}
                className="mt-14 w-full border border-edge px-10 py-4 text-[0.62rem] tracking-[0.34em] text-chalk uppercase transition-all duration-500 hover:border-bloom hover:bg-bloom hover:text-void disabled:opacity-60 sm:w-auto"
              >
                {status === 'idle' && 'Send enquiry'}
                {status === 'sending' && 'Sending…'}
                {status === 'sent' && 'Received — thank you'}
              </motion.button>

              {status === 'sent' && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 text-xs font-light text-mist"
                >
                  This form is a front-end demo — nothing was sent. Wire it to
                  Supabase or an email service before going live.
                </motion.p>
              )}
            </form>
          </Reveal>

          {/* ---------------- direct ---------------- */}
          <Reveal delay={0.1}>
            <aside className="space-y-12 border-t border-edge/50 pt-10 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-14">
              <div>
                <p className="label mb-4 text-dust">Booking</p>
                <a
                  href={`mailto:${PROFILE.contact.booking}`}
                  className="text-sm font-light text-chalk transition-colors hover:text-bloom"
                >
                  {PROFILE.contact.booking}
                </a>
              </div>
              <div>
                <p className="label mb-4 text-dust">General</p>
                <a
                  href={`mailto:${PROFILE.contact.email}`}
                  className="text-sm font-light text-chalk transition-colors hover:text-bloom"
                >
                  {PROFILE.contact.email}
                </a>
              </div>
              <div>
                <p className="label mb-4 text-dust">Elsewhere</p>
                <div className="flex flex-col gap-2.5">
                  {[
                    { label: 'Instagram', href: PROFILE.contact.instagram },
                    { label: 'YouTube', href: PROFILE.contact.youtube },
                    { label: 'Spotify', href: PROFILE.contact.spotify },
                  ].map((s) => (
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
                </div>
              </div>
              <div>
                <p className="label mb-4 text-dust">Based in</p>
                <p className="text-sm font-light text-chalk">{PROFILE.basedIn}</p>
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
