import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // Get the request body for admin key verification
    const body = await request.json()
    const { adminKey } = body
    
    // Verify admin key (simple but effective)
    const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || 'your-secret-key-here'
    
    if (adminKey !== ADMIN_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid admin key' },
        { status: 401 }
      )
    }

    // Create Supabase client - AWAIT it!
    const supabase = await createClient()

    // Fetch all waitlist users
    const { data: waitlist, error } = await supabase
      .from('waitlist')
      .select('email, name')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    if (!waitlist || waitlist.length === 0) {
      return NextResponse.json(
        { error: 'No users on waitlist' },
        { status: 404 }
      )
    }

    // Import Resend dynamically to avoid server issues
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    const results = []
    let successCount = 0
    let failCount = 0

    // Send emails with rate limiting
    for (const user of waitlist) {
      try {
        const { data, error: sendError } = await resend.emails.send({
          from: `KaltrixOS <${process.env.RESEND_FROM_EMAIL || 'updates@kaltrixos.com'}>`,
          to: [user.email],
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
                      Hey${user.name ? ` ${user.name}` : ''},<br><br>
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

        if (sendError) {
          console.error(`Failed to send to ${user.email}:`, sendError)
          failCount++
          results.push({ email: user.email, success: false, error: sendError.message })
        } else {
          successCount++
          results.push({ email: user.email, success: true, data })
        }
      } catch (error) {
        console.error(`Error sending to ${user.email}:`, error)
        failCount++
        results.push({ email: user.email, success: false, error: String(error) })
      }

      // Rate limiting - 500ms delay between emails
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Log the results (optional - create table if it doesn't exist)
    try {
      await supabase.from('email_logs').insert({
        type: 'waitlist_launch',
        recipients: waitlist.length,
        sent_at: new Date().toISOString(),
        results: results,
        success_count: successCount,
        fail_count: failCount,
      })
    } catch (logError) {
      console.error('Error logging to email_logs:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      message: `Emails sent: ${successCount} successful, ${failCount} failed`,
      total: waitlist.length,
      success: successCount,
      failed: failCount,
      results: results.slice(0, 10), // Only return first 10 results to avoid large response
    })
  } catch (error) {
    console.error('Error sending waitlist emails:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}