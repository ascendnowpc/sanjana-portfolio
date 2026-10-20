/**
 * The email a contact-form message arrives as.
 *
 * Written for the inbox it lands in rather than for a log: the subject says
 * who wrote, the preview line under it is the start of what they wrote, and
 * the body puts the message itself first and large, with who sent it and how
 * to answer laid out beside it — not a dump of `Field: value` lines with the
 * message trailing after.
 *
 * The HTML is the conservative kind every client renders the same way: one
 * table for layout, every style inline, no web fonts, no images. Optima leads
 * the font stack, as it does on the site, so Apple Mail and iOS show the
 * site's face; everyone else gets a plain sans. A plain-text twin goes with
 * it for the clients that prefer one.
 *
 * Everything the visitor typed is escaped before it goes anywhere near the
 * markup. It is the one part of this email nobody on our side wrote.
 */

/** She is in Antwerp, so the time on the message is hers, not the server's. */
const TIME_ZONE = 'Europe/Brussels'

const FONT = "Optima, 'Zapf Humanist 601', 'Segoe UI', Helvetica, Arial, sans-serif"

export interface ContactMessage {
  name: string
  email: string
  message: string
  /** Where the form lives, e.g. "sanjana-portfolio.vercel.app". */
  site: string
  sentAt: Date
}

export interface RenderedEmail {
  subject: string
  text: string
  html: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** A mailto: link that a `?` or `#` in an address cannot cut short. */
function mailto(address: string, subject: string): string {
  const to = encodeURIComponent(address).replace(/%40/g, '@')
  return `mailto:${to}?subject=${encodeURIComponent(subject)}`
}

export function renderContactEmail(m: ContactMessage): RenderedEmail {
  const when = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
  }).format(m.sentAt)
  const firstName = m.name.split(/\s+/)[0] || m.name
  const subject = `New message from ${m.name}`
  const reply = mailto(m.email, 'Re: your message on my website')

  // What an inbox shows after the subject. Without one, clients fill it with
  // the first words of the body, which here would be the header's lettering.
  const preview = m.message.replace(/\s+/g, ' ').slice(0, 140)

  const text = [
    subject,
    '',
    `From:   ${m.name}`,
    `Email:  ${m.email}`,
    `Sent:   ${when}`,
    '',
    m.message,
    '',
    '—',
    `Reply to this email to answer ${firstName} directly.`,
    `Sent from the contact form on ${m.site}.`,
  ].join('\n')

  const label = (content: string) =>
    `<p style="margin:0 0 6px;font-family:${FONT};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a8a8a;">${content}</p>`

  const detail = (name: string, value: string) => `
              <tr>
                <td style="padding:6px 16px 6px 0;font-family:${FONT};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a8a8a;white-space:nowrap;vertical-align:top;">${name}</td>
                <td style="padding:6px 0;font-family:${FONT};font-size:15px;color:#111111;">${value}</td>
              </tr>`

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f2f2f2;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;">
            <tr>
              <td style="background:#000000;padding:28px 32px;">
                <p style="margin:0;font-family:${FONT};font-size:16px;letter-spacing:7px;text-transform:uppercase;color:#ffffff;">Sanjana</p>
                <p style="margin:8px 0 0;font-family:${FONT};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9a9a9a;">A message from your website</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 8px;">
                ${label('New message')}
                <p style="margin:0;font-family:${FONT};font-size:22px;line-height:1.35;color:#111111;">${escapeHtml(m.name)} reached out.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 8px;">
                <div style="border-left:3px solid #c8a45c;padding:4px 0 4px 18px;font-family:${FONT};font-size:16px;line-height:1.6;color:#111111;white-space:pre-wrap;word-break:break-word;">${escapeHtml(m.message)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e5e5;width:100%;padding-top:12px;">${detail('From', escapeHtml(m.name))}${detail(
                  'Email',
                  `<a href="${escapeHtml(reply)}" style="color:#111111;">${escapeHtml(m.email)}</a>`,
                )}${detail('Sent', escapeHtml(when))}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 36px;">
                <a href="${escapeHtml(reply)}" style="display:inline-block;background:#000000;color:#ffffff;font-family:${FONT};font-size:12px;letter-spacing:3px;text-transform:uppercase;text-decoration:none;padding:14px 26px;">Reply to ${escapeHtml(firstName)}</a>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;max-width:560px;font-family:${FONT};font-size:12px;line-height:1.5;color:#8a8a8a;">Sent from the contact form on ${escapeHtml(m.site)}. Pressing reply answers ${escapeHtml(firstName)} directly.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject, text, html }
}
