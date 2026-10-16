// Welcome-email delivery against the public.email_deliveries outbox
// (migration 20261015120100). All collaborators are injected, so the exact same
// function is unit-tested with fakes and exercised end-to-end against a real
// Postgres in tests/.
//
// Guarantees:
//   * At most one send per business, even with concurrent requests: the claim
//     is a single atomic UPDATE in the database (claim_email_delivery).
//   * Resend also dedupes on the Idempotency-Key, so a crash between "email
//     accepted" and "row marked sent" can't produce a second email either.
//   * Never throws. A provider outage only marks the row `failed`; it is retried
//     (3 attempts max, 2 min apart) the next time the owner opens the dashboard.
import type { ServiceClient } from '@/lib/api-guard'
import type { EmailPayload, SendResult } from '@/lib/resend'
import type { WelcomeEmail } from '@/lib/welcome-email'

export type WelcomeOutcome = 'sent' | 'skipped' | 'not_configured' | 'failed'

export interface DeliverWelcomeInput {
  service: ServiceClient
  businessId: string
  recipient: string
  email: WelcomeEmail
  send: (payload: EmailPayload) => Promise<SendResult>
}

const KIND = 'welcome'

export async function deliverWelcomeEmail({
  service,
  businessId,
  recipient,
  email,
  send,
}: DeliverWelcomeInput): Promise<WelcomeOutcome> {
  // 1. Atomic claim. No row back = nothing to do (already sent, being sent by
  //    another request, waiting out the retry delay, out of attempts, or a
  //    business that pre-dates the feature).
  const { data: claimed, error: claimError } = await service.rpc('claim_email_delivery', {
    p_business_id: businessId,
    p_kind: KIND,
  })
  if (claimError) {
    console.error('Welcome email: claim failed:', claimError.code ?? 'unknown')
    return 'failed'
  }
  const claim = Array.isArray(claimed) ? claimed[0] : null
  if (!claim?.id) return 'skipped'

  const mark = async (patch: Record<string, unknown>) => {
    const { error } = await service
      .from('email_deliveries')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', claim.id)
      .eq('status', 'sending')
    if (error) console.error('Welcome email: could not record outcome:', error.code ?? 'unknown')
  }

  // 2. Send. The transport never throws, but belt and braces: an unexpected
  //    exception must still leave the row in a retryable state.
  let result: SendResult
  try {
    result = await send({
      to: recipient,
      subject: email.subject,
      html: email.html,
      text: email.text,
      idempotencyKey: `welcome-${businessId}`,
    })
  } catch {
    result = { ok: false, error: 'send_exception' }
  }

  // 3. Record the outcome.
  if (result.ok) {
    await mark({ status: 'sent', sent_at: new Date().toISOString(), provider_id: result.id, last_error: null })
    return 'sent'
  }

  if (result.notConfigured) {
    // Nothing was attempted: put the row back untouched so the email goes out
    // once the API key is configured.
    await mark({ status: 'pending', attempts: Math.max(0, (claim.attempts ?? 1) - 1), last_error: 'not_configured' })
    return 'not_configured'
  }

  console.error('Welcome email: send failed:', result.error, 'attempt', claim.attempts)
  await mark({ status: 'failed', last_error: result.error.slice(0, 300) })
  return 'failed'
}
