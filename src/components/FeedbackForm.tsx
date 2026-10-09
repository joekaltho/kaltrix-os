'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextAreaField, TextField } from '@/components/ui/Field'
import Notice from '@/components/ui/Notice'

// One feedback form for both audiences. The server decides who is sending
// (signed-in business owner vs everyone else) -- the form only collects what
// the person typed. Customers get an optional "how can we reply" field;
// business owners are already identified, so they don't.
type Kind = 'bug' | 'idea' | 'other'

const KINDS: { value: Kind; label: string }[] = [
  { value: 'bug', label: "Something's broken" },
  { value: 'idea', label: 'An idea' },
  { value: 'other', label: 'Something else' },
]

const MAX = 2000

export default function FeedbackForm({ variant }: { variant: 'business' | 'customer' }) {
  const [kind, setKind] = useState<Kind>('idea')
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return
    setError('')
    setSending(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, message, contact: variant === 'customer' ? contact : '' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not send feedback. Please try again.')
        setSending(false)
        return
      }
      setSent(true)
      setMessage('')
      setContact('')
    } catch {
      setError('Could not send feedback. Check your connection and try again.')
    }
    setSending(false)
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-brandText" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold text-ink">Thank you</h2>
        <p className="mt-1 text-sm text-inkFaint">
          {variant === 'business'
            ? 'Your feedback goes straight to the team building KaltrixOS.'
            : 'We read every message.'}
        </p>
        <Button variant="secondary" className="mt-5" onClick={() => setSent(false)}>
          Send more feedback
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-border bg-surface p-5 sm:p-6">
      {error && <Notice kind="error" onDismiss={() => setError('')}>{error}</Notice>}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">What is this about?</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <label
              key={k.value}
              className={`cursor-pointer rounded-lg border px-3.5 py-2 text-sm font-medium transition focus-within:outline focus-within:outline-2 focus-within:outline-brandDim ${
                kind === k.value
                  ? 'border-brandDim bg-brandBg text-brandText'
                  : 'border-border bg-ivory text-inkMid hover:bg-ivoryDim'
              }`}
            >
              <input
                type="radio"
                name="feedback-kind"
                value={k.value}
                checked={kind === k.value}
                onChange={() => setKind(k.value)}
                className="sr-only"
              />
              {k.label}
            </label>
          ))}
        </div>
      </fieldset>

      <TextAreaField
        label="Your feedback"
        name="message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={6}
        maxLength={MAX}
        required
        placeholder={
          variant === 'business'
            ? 'What is working, what is not, what do you wish KaltrixOS did?'
            : 'Tell us what went wrong, or what would make this better.'
        }
        hint={`${message.length}/${MAX}`}
      />

      {variant === 'customer' && (
        <TextField
          label="Email or phone"
          optional
          name="contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={254}
          autoComplete="email"
          hint="Only if you want a reply."
        />
      )}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="lg" loading={sending} disabled={message.trim().length < 3}>
          Send feedback
        </Button>
      </div>
    </form>
  )
}
