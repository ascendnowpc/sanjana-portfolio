import nodemailer from 'nodemailer'
import { env, json, readJson } from './_lib.js'

/**
 * The contact form's delivery: one message, sent through a mailbox the site
 * owns, to the address that reads them.
 *
 * Plain SMTP with a Gmail app password rather than a sending service, because
 * every sending service wants a domain of the site's own to verify, and this
 * deployment lives on vercel.app and has none.
 *
 * What it needs in the environment:
 *
 *   SMTP_USER     the address that sends — a Gmail address
 *   SMTP_PASS     that account's app password (Google Account ▸ Security ▸
 *                 App passwords; it needs 2-Step Verification turned on)
 *   CONTACT_TO    who receives the messages; defaults to SMTP_USER
 *   SMTP_HOST     defaults to smtp.gmail.com
 *   SMTP_PORT     defaults to 465
 *
 * The visitor's address goes in Reply-To, not From. Gmail only sends as the
 * account that signed in, and pressing Reply should reach the visitor rather
 * than the form.
 *
 * GET reports whether delivery is set up, the same way the other endpoints do.
 */

const LIMITS = { name: 200, email: 320, date: 200, message: 5000 }

/** Deliberately loose: one @, something either side, a dot in the domain. */
const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/

interface Smtp {
  host: string
  port: number
  user: string
  pass: string
  to: string
}

function config(): Smtp | null {
  const user = env('SMTP_USER')
  const pass = env('SMTP_PASS')
  if (!user || !pass) return null
  return {
    host: env('SMTP_HOST') ?? 'smtp.gmail.com',
    port: Number(env('SMTP_PORT') ?? 465),
    user,
    // Google shows app passwords in four groups of four; the spaces are
    // display only.
    pass: pass.replace(/\s+/g, ''),
    to: env('CONTACT_TO') ?? user,
  }
}

/** A single line, trimmed and capped. Line breaks go, so it is header-safe. */
function line(value: unknown, max: number): string {
  return typeof value === 'string'
    ? value.replace(/[\r\n]+/g, ' ').trim().slice(0, max)
    : ''
}

function block(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function GET(): Response {
  const missing = ['SMTP_USER', 'SMTP_PASS'].filter((name) => !env(name))
  return json({ configured: missing.length === 0, missing })
}

export async function POST(request: Request): Promise<Response> {
  const smtp = config()
  if (!smtp) {
    return json(
      {
        ok: false,
        error: 'The contact form is not set up on this deployment: SMTP_USER and SMTP_PASS are needed.',
      },
      501,
    )
  }

  const read = await readJson(request)
  if (!read.ok) return read.response
  const { body } = read

  // A field no person can see (see Contact.tsx). Whatever filled it in is not
  // a person, and is told it worked so that it has no reason to try again.
  if (line(body.website, 200)) return json({ ok: true })

  const name = line(body.name, LIMITS.name)
  const email = line(body.email, LIMITS.email)
  const date = line(body.date, LIMITS.date)
  const message = block(body.message, LIMITS.message)
  if (!name || !EMAIL.test(email) || !message) {
    return json(
      { ok: false, error: 'A name, a valid email address and a message are all needed.' },
      400,
    )
  }

  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
    // Nothing here is ever a file or a URL to fetch; say so, so that no input
    // can be read as one.
    disableFileAccess: true,
    disableUrlAccess: true,
  })

  const lines = [`Name: ${name}`, `Email: ${email}`]
  if (date) lines.push(`Date or window: ${date}`)
  lines.push('', message)

  try {
    await transport.sendMail({
      from: { name: 'Website contact form', address: smtp.user },
      to: smtp.to,
      replyTo: { name, address: email },
      subject: `Website message from ${name}`,
      text: lines.join('\n'),
    })
  } catch (err) {
    // The reason belongs in the function log, not in front of a visitor: it
    // is usually the credentials, which is nothing they can act on.
    console.error('[contact] send failed:', err)
    return json({ ok: false, error: 'The message could not be sent.' }, 502)
  }
  return json({ ok: true })
}
