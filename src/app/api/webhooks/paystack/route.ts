import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isValidPlanAmount } from '@/lib/plans'

// Paystack sends: charge.success and others. We only act on charge.success.
interface PaystackChargeEvent {
  event: string
  data: {
    reference: string
    amount: number // kobo
    status: string
    metadata?: {
      business_id?: string
      plan?: string
      billing?: '6month' | 'annual'
      custom_fields?: { variable_name: string; value: string }[]
    }
  }
}

function getMetadataField(
  event: PaystackChargeEvent,
  key: 'business_id' | 'plan' | 'billing'
): string | undefined {
  const direct = event.data.metadata?.[key]
  if (direct) return direct
  // Fall back to custom_fields shape (what upgrade/page.tsx currently sends)
  const field = event.data.metadata?.custom_fields?.find((f) => f.variable_name === key)
  return field?.value
}

export async function POST(request: NextRequest) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    console.error('PAYSTACK_SECRET_KEY is not set — webhook cannot verify requests, failing closed.')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  // Must read the raw body for signature verification — do NOT call
  // request.json() first, it would consume the stream and change nothing
  // being hashed to something already-parsed.
  const rawBody = await request.text()

  const signature = request.headers.get('x-paystack-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  const expectedSignature = createHmac('sha512', secretKey).update(rawBody).digest('hex')

  const signatureBuffer = Buffer.from(signature, 'utf8')
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8')
  const signatureValid =
    signatureBuffer.length === expectedBuffer.length &&
    timingSafeEqual(signatureBuffer, expectedBuffer)

  if (!signatureValid) {
    console.error('Paystack webhook signature mismatch — rejecting.')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody) as PaystackChargeEvent

  // Only charge.success moves a subscription to active. Ignore everything else.
  if (event.event !== 'charge.success') {
    return NextResponse.json({ received: true })
  }

  const { reference, amount, status } = event.data
  const businessId = getMetadataField(event, 'business_id')
  const plan = getMetadataField(event, 'plan')
  const billing = (getMetadataField(event, 'billing') as '6month' | 'annual' | undefined) ?? '6month'

  if (status !== 'success' || !businessId || !plan || !reference) {
    console.error('Paystack webhook: incomplete event payload', { reference, businessId, plan, status })
    return NextResponse.json({ error: 'Incomplete event payload' }, { status: 400 })
  }

  // Never trust the webhook payload alone (Paystack recommends this too) —
  // re-verify the transaction directly against Paystack's API using the
  // secret key before touching the database.
  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })

  if (!verifyRes.ok) {
    console.error('Paystack verify call failed', reference, verifyRes.status)
    return NextResponse.json({ error: 'Verification call failed' }, { status: 502 })
  }

  const verifyJson = await verifyRes.json()
  const verifiedData = verifyJson?.data

  if (!verifiedData || verifiedData.status !== 'success') {
    console.error('Paystack verify: transaction not successful', reference, verifiedData?.status)
    return NextResponse.json({ error: 'Transaction not verified as successful' }, { status: 400 })
  }

  if (verifiedData.amount !== amount) {
    console.error('Paystack verify: amount mismatch between webhook and verify API', reference)
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
  }

  if (!isValidPlanAmount(plan, billing, amount)) {
    console.error('Paystack verify: amount does not match expected plan price', {
      reference,
      plan,
      billing,
      amount,
    })
    return NextResponse.json({ error: 'Amount does not match plan' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Idempotency: if this exact reference has already been applied, don't
  // re-apply it (Paystack retries webhooks on anything but a 2xx response).
  // Requires a `paystack_reference` column on subscriptions — see TODO below.
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id, paystack_reference')
    .eq('business_id', businessId)
    .maybeSingle()

  if (existing?.paystack_reference === reference) {
    return NextResponse.json({ received: true, alreadyProcessed: true })
  }

  const { error } = await supabase.from('subscriptions').upsert(
    {
      business_id: businessId,
      plan,
      status: 'active',
      paystack_reference: reference,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'business_id' }
  )

  if (error) {
    console.error('Failed to write subscription after verified payment', reference, error)
    // Return 500 so Paystack retries the webhook — this is recoverable, the
    // payment is real, we just failed to record it.
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
const handlePaymentSuccess = useCallback(async (planKey: string, _billingCycle: BillingCycle, reference: string) => {
    // The Paystack webhook (server-to-server) does the actual verification
    // and subscription write. This just waits for it to land, since the
    // client-side callback firing does NOT mean the subscription is active yet.
    const maxAttempts = 10
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const { data } = await supabase
        .from('subscriptions')
        .select('plan, paystack_reference')
        .eq('business_id', businessId)
        .maybeSingle()

      if (data?.paystack_reference === reference && data.plan === planKey) {
        setCurrentPlan(planKey)
        router.push('/dashboard?upgraded=true')
        setProcessingPlan('')
        return
      }
    }

    // Webhook hasn't landed after ~20s — payment likely succeeded but confirmation is delayed.
    alert(
      'Payment received — confirming with Paystack. This can take a minute. ' +
      'If your plan doesn\'t update shortly, contact kaltrix.ng@gmail.com with reference: ' + reference
    )
    setProcessingPlan('')
  }, [businessId, router, supabase])
