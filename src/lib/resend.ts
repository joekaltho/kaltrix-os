import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface WaitlistEmailParams {
  email: string
  name?: string
}

export async function sendWaitlistNotification({ email, name }: WaitlistEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: `KaltrixOS <${process.env.RESEND_FROM_EMAIL || 'updates@kaltrixos.com'}>`,
      to: [email],
      subject: '🎉 KaltrixOS Registration is Now Open!',
      html: `
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
                <h2 style="color: #0a0a0a; font-size: 24px; font-weight: 900; margin: 0 0 12px; letter-spacing: -0.5px;">
                  🎉 Registration is Now Open!
                </h2>
                <p style="color: #3a3a3a; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                  Hey${name ? ` ${name}` : ''},<br><br>
                  You asked us to let you know when KaltrixOS was ready. Today is that day! 🚀
                </p>

                <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                  <p style="color: #0a0a0a; font-size: 14px; font-weight: 700; margin: 0 0 4px;">✨ What you get:</p>
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
                  <a href="https://kaltrix-os.vercel.app/signup" 
                     style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; font-size: 18px; font-weight: 900; padding: 16px 48px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 20px rgba(34,197,94,0.22);">
                    Get Started Free →
                  </a>
                </div>

                <p style="color: #8a8a8a; font-size: 14px; line-height: 1.6; text-align: center; margin: 0 0 4px;">
                  No credit card required. Free forever plan.
                </p>

                <hr style="border: none; border-top: 1px solid #e2e2db; margin: 32px 0 20px;">

                <div style="text-align: center;">
                  <p style="color: #8a8a8a; font-size: 12px; margin: 0; line-height: 1.6;">
                    KaltrixOS · Built in Nigeria · Built for Africa<br>
                    <a href="https://kaltrix-os.vercel.app" style="color: #22c55e; text-decoration: none;">kaltrix-os.vercel.app</a>
                  </p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
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

// Bulk send to all waitlist users
export async function sendBulkWaitlistEmails(users: { email: string; name?: string }[]) {
  const results = []
  
  for (const user of users) {
    const result = await sendWaitlistNotification(user)
    results.push({ email: user.email, ...result })
    
    // Add a small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  return results
}