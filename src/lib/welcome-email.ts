// Welcome email content. Pure (no I/O) so it can be unit-tested.
//
// Everything user-supplied (the business name, the slug) is HTML-escaped before
// it reaches the markup: a business can be named `<script>` or `" onmouseover=`
// and the email must stay inert. Claims here are limited to what the product
// actually does today (30-day Pro trial from provision_trial_subscription(),
// profile TrustScore, Shop listings + Inventory, the setup checklist steps).

const SITE = 'https://kaltrixos.com'

export interface WelcomeEmailInput {
  businessName: string
  slug?: string | null
}

export interface WelcomeEmail {
  subject: string
  html: string
  text: string
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Collapse whitespace/control characters and cap length. Used for anything that
// ends up in a header-like position (subject) or a single-line greeting.
export function cleanLine(value: string, max: number): string {
  const stripped = value.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim()
  return stripped.length > max ? `${stripped.slice(0, max - 1).trimEnd()}…` : stripped
}

const SAFE_SLUG = /^[A-Za-z0-9_-]{1,120}$/

export function buildWelcomeEmail({ businessName, slug }: WelcomeEmailInput): WelcomeEmail {
  const name = cleanLine(businessName, 80) || 'your business'
  const safeName = escapeHtml(name)
  const dashboardUrl = `${SITE}/dashboard`
  const profileUrl = slug && SAFE_SLUG.test(slug) ? `${SITE}/business/${slug}` : null

  const subject = 'Welcome to KaltrixOS — your business profile is live'

  const steps = [
    'Add a logo, description and business email, so customers and your TrustScore see a complete profile.',
    'Add your products under Listings and track stock in Inventory.',
    'Add payment details, then send your first invoice.',
  ]

  const text = [
    `Welcome to KaltrixOS!`,
    ``,
    `${name} is now live on KaltrixOS.`,
    ``,
    `Three good first steps:`,
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    ``,
    `Your 30-day Pro trial is running, so Bookings, CRM, Invoices and Business Pulse are all available while you get set up.`,
    ``,
    `Open your dashboard: ${dashboardUrl}`,
    ...(profileUrl ? [`Your public profile: ${profileUrl}`] : []),
    ``,
    `Questions or ideas? Use "Send feedback" in your dashboard — we read every message.`,
    ``,
    `You received this because you created a business on KaltrixOS.`,
    `KaltrixOS · Built in Nigeria`,
  ].join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f7f7f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0a0a0a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safeName} is live on KaltrixOS. Here are three good first steps.</div>
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <div style="background:#ffffff;border:1px solid #e2e2db;border-radius:16px;padding:32px 28px;">
        <p style="margin:0 0 20px;font-size:18px;font-weight:800;letter-spacing:-0.3px;">Kaltrix<span style="color:#16a34a;">OS</span></p>
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:800;letter-spacing:-0.3px;">Welcome to KaltrixOS</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3a3a3a;"><strong>${safeName}</strong> is now live on KaltrixOS. Here are three good first steps:</p>
        <ol style="margin:0 0 20px;padding-left:20px;font-size:15px;line-height:1.7;color:#3a3a3a;">
          ${steps.map((s) => `<li style="margin-bottom:6px;">${escapeHtml(s)}</li>`).join('\n          ')}
        </ol>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3a3a3a;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 14px;">Your 30-day Pro trial is running, so Bookings, CRM, Invoices and Business Pulse are all available while you get set up.</p>
        <p style="margin:0 0 ${profileUrl ? '14' : '28'}px;"><a href="${dashboardUrl}" style="display:inline-block;background:#15803d;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;">Open your dashboard</a></p>
        ${profileUrl ? `<p style="margin:0 0 28px;font-size:14px;"><a href="${profileUrl}" style="color:#15803d;">View your public profile</a></p>` : ''}
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3a3a3a;">Questions or ideas? Use <strong>Send feedback</strong> in your dashboard &mdash; we read every message.</p>
        <hr style="border:none;border-top:1px solid #e2e2db;margin:20px 0 16px;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#8a8a8a;">You received this because you created a business on KaltrixOS.<br>KaltrixOS &middot; Built in Nigeria</p>
      </div>
    </div>
  </body>
</html>`

  return { subject, html, text }
}
