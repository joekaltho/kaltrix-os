import { createServiceClient } from '@/lib/supabase/service'
import { sendBulkWaitlistEmails } from '@/lib/resend'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // Get the request body for admin key verification
    const body = await request.json()
    const { adminKey } = body

    // Verify admin key. Fail closed: if the env var isn't configured, refuse
    // every request instead of falling back to a guessable default secret.
    const ADMIN_KEY = process.env.ADMIN_SECRET_KEY
    if (!ADMIN_KEY) {
      console.error('ADMIN_SECRET_KEY is not configured — refusing request')
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 }
      )
    }

    if (!adminKey || adminKey !== ADMIN_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid admin key' },
        { status: 401 }
      )
    }

    // Service-role client: this endpoint's auth is the ADMIN_SECRET_KEY check
    // above, not RLS, and it must work with no Supabase session attached
    // (e.g. triggered by curl or a script).
    const supabase = createServiceClient()

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

    const results = await sendBulkWaitlistEmails(waitlist)
    const successCount = results.filter((r) => r.success).length
    const failCount = results.length - successCount

    // Log the results (optional - create table if it doesn't exist)
    try {
      await supabase.from('email_logs').insert({
        type: 'waitlist_launch',
        recipients: waitlist.length,
        sent_at: new Date().toISOString(),
        results,
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
