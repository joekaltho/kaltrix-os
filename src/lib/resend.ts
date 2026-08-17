import { Resend } from 'resend'

// Lazily instantiated: the Resend constructor throws immediately if no API
// key is passed. Creating it at module scope means simply *importing* this
// file (which happens during `next build`'s page-data collection, before any
// email is ever sent) crashes the entire build whenever RESEND_API_KEY is
// missing or empty. Deferring construction to first use means the build
// always succeeds, and a missing key only breaks an actual send attempt.
let resendClient: Resend | null = null

function getResendClient() {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set — cannot send email.')
    }
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

export interface WaitlistEmailParams {
  email: string
  name?: string
}

function waitlistEmailHtml(name?: string) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7f7f2; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: #ffffff; font-size: 28px; font-weight: 900; margin: 0; letter-spacing: -0.5px;">
              Kaltrix<span style="color: #ffffff; opacity: 0.8;">OS</span>
            </h1>
            <p style="color: rgba(255,255,255,0.8); font-size: 16px; margin: 8px 0 0;">Africa's Business Operating System</p>
          </div>

          <!-- Body -->
          <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.07);">

            <!-- Early Access Badge -->
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="display: inline-block; background: #f0fdf4; border: 1px solid #22c55e; color: #16a34a; font-size: 12px; font-weight: 700; padding: 4px 16px; border-radius: 50px; letter-spacing: 0.5px; text-transform: uppercase;">
                ⭐ Early Access Member
              </span>
            </div>

            <h2 style="color: #0a0a0a; font-size: 24px; font-weight: 900; margin: 0 0 12px; letter-spacing: -0.5px;">
              You're In! 🎉
            </h2>

            <p style="color: #3a3a3a; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
              Hey${name ? ` ${name}` : ''},<br><br>
              <strong>You're one of the first people to get access to KaltrixOS.</strong> 🚀
            </p>

            <p style="color: #3a3a3a; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
              We built this platform for African businesses like yours — and we're just getting started.
              As an early user, you get to help shape what KaltrixOS becomes.
            </p>

            <!-- What You Get -->
            <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #0a0a0a; font-size: 14px; font-weight: 700; margin: 0 0 4px;">✨ What's waiting for you:</p>
              <ul style="color: #3a3a3a; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Verified business profile</li>
                <li>TrustScore to build credibility</li>
                <li>Bookings, CRM, and Invoices</li>
                <li>Priority listing in discovery</li>
                <li>Analytics to grow your business</li>
              </ul>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="https://kaltrixos.com/signup"
                 style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; font-size: 18px; font-weight: 900; padding: 16px 48px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 20px rgba(34,197,94,0.22);">
                Claim Your Free Account →
              </a>
            </div>

            <p style="color: #8a8a8a; font-size: 14px; text-align: center; margin: 0 0 24px;">
              No credit card required. Free forever plan.
            </p>

            <!-- Feedback Section -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
              <p style="color: #0a0a0a; font-size: 15px; font-weight: 700; margin: 0 0 8px;">
                💬 We Want Your Feedback
              </p>
              <p style="color: #3a3a3a; font-size: 14px; line-height: 1.6; margin: 0 0 12px;">
                You're one of our first users, and your opinion matters.
                <strong>If you find a bug, have a suggestion, or just want to say hi</strong> — we'd love to hear from you.
              </p>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <a href="mailto:support@kaltrixos.com?subject=KaltrixOS%20Feedback"
                   style="display: inline-block; background: #0a0a0a; color: #ffffff; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
                  📧 Email Feedback
                </a>
                <a href="https://wa.me/2348000000000?text=Hi!%20I%27m%20using%20KaltrixOS%20and..."
                   style="display: inline-block; background: #25D366; color: #ffffff; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
                  💬 WhatsApp
                </a>
              </div>
            </div>

            <hr style="border: none; border-top: 1px solid #e2e2db; margin: 24px 0 20px;">

            <div style="text-align: center;">
              <p style="color: #8a8a8a; font-size: 13px; margin: 0; line-height: 1.6;">
                We're building KaltrixOS in the open.
                <span style="color: #0a0a0a; font-weight: 600;">Help us build something great.</span>
              </p>
              <p style="color: #8a8a8a; font-size: 12px; margin: 12px 0 0; line-height: 1.6;">
                KaltrixOS · Built in Nigeria · Built for Africa<br>
                <a href="https://kaltrixos.com" style="color: #22c55e; text-decoration: none;">kaltrixos.com</a>
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `
}

export async function sendWaitlistNotification({ email, name }: WaitlistEmailParams) {
  try {
    const { data, error } = await getResendClient().emails.send({
      from: `KaltrixOS <${process.env.RESEND_FROM_EMAIL || 'updates@kaltrixos.com'}>`,
      to: [email],
      subject: '🎉 KaltrixOS Registration is Now Open!',
      html: waitlistEmailHtml(name),
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false, error }
  }
}

// Bulk send to all waitlist users, with basic rate limiting between sends.
export async function sendBulkWaitlistEmails(users: { email: string; name?: string }[]) {
  const results = []

  for (const user of users) {
    const result = await sendWaitlistNotification(user)
    results.push({ email: user.email, ...result })

    // Add a small delay to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return results
}