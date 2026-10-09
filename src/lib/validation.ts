// Server-side input validation for the public write endpoints
// (/api/reviews, /api/messages, /api/review-reports).
//
// Pure functions only (no I/O, no secrets) so the rules are easy to audit and
// test. The browser forms are NOT trusted: every field is re-validated here
// and the route builds the database row itself from the validated values,
// so a client can never set columns it shouldn't (created_at, is_read,
// moderation fields, ip hash, ...).
//
// Rules reject over-long input instead of silently truncating it, so the
// visitor sees a clear message rather than losing part of what they wrote.

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string }

export const LIMITS = {
  name: 80,
  comment: 2000,
  message: 2000,
  phone: 25,
  email: 254,
  reportDetails: 500,
  feedback: 2000,
} as const

export const REPORT_REASONS = ['fake', 'spam', 'self_review', 'offensive', 'irrelevant', 'other'] as const
export const FEEDBACK_KINDS = ['bug', 'idea', 'other'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]
export type ReportReason = (typeof REPORT_REASONS)[number]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_CHARS_RE = /^[0-9+()\-.\s]+$/
// Control characters (incl. NUL) are never legitimate in these fields.
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

type Cleaned = { ok: true; value: string } | { ok: false; error: string }

// Single-line text: strip control chars, collapse all whitespace runs
// (including newlines) to one space, trim.
function cleanLine(raw: unknown, label: string, max: number, required: boolean): Cleaned {
  if (raw === undefined || raw === null) {
    return required ? { ok: false, error: `${label} is required` } : { ok: true, value: '' }
  }
  if (typeof raw !== 'string') return { ok: false, error: `${label} is invalid` }
  const value = raw.replace(CONTROL_RE, '').replace(/\s+/g, ' ').trim()
  if (value.length === 0) {
    return required ? { ok: false, error: `${label} is required` } : { ok: true, value: '' }
  }
  if (value.length > max) return { ok: false, error: `${label} must be ${max} characters or fewer` }
  return { ok: true, value }
}

// Multi-line text: strip control chars (keeping \n and \t), normalise line
// endings, trim.
function cleanBlock(raw: unknown, label: string, max: number, required: boolean): Cleaned {
  if (raw === undefined || raw === null) {
    return required ? { ok: false, error: `${label} is required` } : { ok: true, value: '' }
  }
  if (typeof raw !== 'string') return { ok: false, error: `${label} is invalid` }
  const value = raw.replace(/\r\n?/g, '\n').replace(CONTROL_RE, '').trim()
  if (value.length === 0) {
    return required ? { ok: false, error: `${label} is required` } : { ok: true, value: '' }
  }
  if (value.length > max) return { ok: false, error: `${label} must be ${max} characters or fewer` }
  return { ok: true, value }
}

// Optional phone: loose on purpose (Nigerian numbers are typed many ways:
// 0803 123 4567, +234 803 123 4567, (0803) 123-4567) but it must look like a
// phone number and not be free text.
function cleanPhone(raw: unknown): Validated<string | null> {
  const line = cleanLine(raw, 'Phone number', LIMITS.phone, false)
  if (!line.ok) return line
  if (line.value === '') return { ok: true, value: null }
  const digits = line.value.replace(/\D/g, '')
  if (!PHONE_CHARS_RE.test(line.value) || digits.length < 7 || digits.length > 15) {
    return { ok: false, error: 'Phone number looks invalid' }
  }
  return { ok: true, value: line.value }
}

function cleanEmail(raw: unknown): Validated<string | null> {
  const line = cleanLine(raw, 'Email', LIMITS.email, false)
  if (!line.ok) return line
  if (line.value === '') return { ok: true, value: null }
  if (!EMAIL_RE.test(line.value)) return { ok: false, error: 'Email looks invalid' }
  return { ok: true, value: line.value }
}

export interface ReviewInput {
  business_id: string
  reviewer_name: string
  rating: number
  comment: string
  reviewer_phone: string | null
  reviewer_email: string | null
}

export function validateReviewInput(body: Record<string, unknown>): Validated<ReviewInput> {
  if (!isUuid(body.business_id)) return { ok: false, error: 'Missing required fields' }

  const name = cleanLine(body.reviewer_name, 'Name', LIMITS.name, true)
  if (!name.ok) return name

  // Same coercion the route always had (the form posts a number, but a
  // numeric string is accepted too); anything else is rejected.
  const ratingRaw = body.rating
  const rating =
    typeof ratingRaw === 'number' || (typeof ratingRaw === 'string' && ratingRaw.trim() !== '')
      ? Number(ratingRaw)
      : NaN
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: 'Rating must be an integer from 1 to 5' }
  }

  const comment = cleanBlock(body.comment, 'Review', LIMITS.comment, true)
  if (!comment.ok) return comment

  const phone = cleanPhone(body.reviewer_phone)
  if (!phone.ok) return phone
  const email = cleanEmail(body.reviewer_email)
  if (!email.ok) return email

  return {
    ok: true,
    value: {
      business_id: body.business_id,
      reviewer_name: name.value,
      rating,
      comment: comment.value,
      reviewer_phone: phone.value,
      reviewer_email: email.value,
    },
  }
}

export interface MessageInput {
  business_id: string
  sender_name: string
  sender_phone: string | null
  content: string
}

export function validateMessageInput(body: Record<string, unknown>): Validated<MessageInput> {
  if (!isUuid(body.business_id)) return { ok: false, error: 'Missing required fields' }

  const name = cleanLine(body.sender_name, 'Name', LIMITS.name, true)
  if (!name.ok) return name
  const phone = cleanPhone(body.sender_phone)
  if (!phone.ok) return phone
  const content = cleanBlock(body.content, 'Message', LIMITS.message, true)
  if (!content.ok) return content

  return {
    ok: true,
    value: {
      business_id: body.business_id,
      sender_name: name.value,
      sender_phone: phone.value,
      content: content.value,
    },
  }
}

export interface ReportInput {
  review_id: string
  reason: ReportReason
  details: string | null
}

export function validateReportInput(body: Record<string, unknown>): Validated<ReportInput> {
  if (!isUuid(body.review_id)) return { ok: false, error: 'Missing required fields' }
  if (typeof body.reason !== 'string' || !(REPORT_REASONS as readonly string[]).includes(body.reason)) {
    return { ok: false, error: 'Please choose a valid reason' }
  }
  const details = cleanBlock(body.details, 'Details', LIMITS.reportDetails, false)
  if (!details.ok) return details

  return {
    ok: true,
    value: {
      review_id: body.review_id,
      reason: body.reason as ReportReason,
      details: details.value === '' ? null : details.value,
    },
  }
}

export interface FeedbackInput {
  kind: FeedbackKind
  message: string
  contact: string | null
}

// Feedback is open to anyone, so `source` and `business_id` are NOT accepted
// from the client: the route derives them from the signed-in session.
export function validateFeedbackInput(body: Record<string, unknown>): Validated<FeedbackInput> {
  if (typeof body.kind !== 'string' || !(FEEDBACK_KINDS as readonly string[]).includes(body.kind)) {
    return { ok: false, error: 'Please choose what kind of feedback this is' }
  }
  const message = cleanBlock(body.message, 'Feedback', LIMITS.feedback, true)
  if (!message.ok) return message
  if (message.value.length < 3) return { ok: false, error: 'Please write a little more' }

  // Optional reply contact: an email or a phone number, nothing else.
  const contact = cleanLine(body.contact, 'Contact', LIMITS.email, false)
  if (!contact.ok) return contact
  let contactValue: string | null = null
  if (contact.value !== '') {
    if (contact.value.includes('@')) {
      if (!EMAIL_RE.test(contact.value)) return { ok: false, error: 'Enter a valid email address' }
    } else {
      const phone = cleanPhone(contact.value)
      if (!phone.ok) return { ok: false, error: 'Contact must be an email address or phone number' }
    }
    contactValue = contact.value
  }

  return { ok: true, value: { kind: body.kind as FeedbackKind, message: message.value, contact: contactValue } }
}
