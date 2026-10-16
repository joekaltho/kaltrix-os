// Minimal Resend transport. Plain fetch against Resend's REST API, so the app
// needs no extra dependency (the `resend` package was removed with the waitlist
// code on Oct 9 2026 and isn't worth re-adding for one call).
//
// Server-only by construction: it reads RESEND_API_KEY (never NEXT_PUBLIC_*),
// and its only importer, welcome-delivery.ts, imports `server-only`.
//
// Never throws: every outcome is a SendResult, so callers can't accidentally
// fail a user-facing request because of an email problem.

export const EMAIL_FROM = 'KaltrixOS <updates@kaltrixos.com>'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const DEFAULT_TIMEOUT_MS = 8000

export interface EmailPayload {
  to: string
  subject: string
  html: string
  text: string
  // Resend dedupes requests carrying the same key for 24h, so a retry after a
  // lost response can never produce a second email.
  idempotencyKey: string
}

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; notConfigured: true }
  | { ok: false; notConfigured?: false; error: string }

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export interface SendDeps {
  apiKey?: string | undefined
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

// Short, non-sensitive description of a failure: never the recipient, the key,
// or the provider's free-text message.
function describeFailure(status: number, body: unknown): string {
  const name =
    body && typeof body === 'object' && 'name' in body && typeof (body as { name: unknown }).name === 'string'
      ? (body as { name: string }).name.replace(/[^a-z0-9_]/gi, '').slice(0, 60)
      : ''
  return name ? `resend_${status}_${name}` : `resend_${status}`
}

export async function sendEmail(payload: EmailPayload, deps: SendDeps = {}): Promise<SendResult> {
  const apiKey = 'apiKey' in deps ? deps.apiKey : process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, notConfigured: true }

  const fetchImpl = deps.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const res = await fetchImpl(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': payload.idempotencyKey,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
      signal: controller.signal,
    })

    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = null
    }

    if (!res.ok) return { ok: false, error: describeFailure(res.status, body) }

    const id =
      body && typeof body === 'object' && 'id' in body && typeof (body as { id: unknown }).id === 'string'
        ? (body as { id: string }).id.slice(0, 100)
        : null
    return { ok: true, id }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return { ok: false, error: aborted ? 'resend_timeout' : 'resend_network_error' }
  } finally {
    clearTimeout(timer)
  }
}
