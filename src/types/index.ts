export type UserRole = 'admin' | 'business'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  created_at: string
}

export interface Business {
  id: string
  user_id: string
  business_name: string
  industry: string
  city: string
  phone: string
  website_url?: string
  description?: string
  logo_url?: string
  trust_score: number
  // Populated by the DB (calculate_trust_score_from_fields) — see
  // src/lib/trust-score.ts for the TrustSignal shape.
  trust_signals?: import('@/lib/trust-score').TrustSignal[]
  is_verified: boolean
  slug: string
  created_at: string
}

export interface Customer {
  id: string
  business_id: string
  name: string
  phone?: string
  email?: string
  notes?: string
  created_at: string
}

export interface Booking {
  id: string
  business_id: string
  user_id?: string
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  service_description?: string
  booking_date_time?: string
  status?: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  notes?: string
  created_at: string
}

export interface Message {
  id: string
  business_id: string
  sender_name: string
  sender_phone?: string
  content: string
  is_read: boolean
  created_at: string
}

export interface InvoiceItem {
  name: string
  quantity: number
  price: number
}

export interface Invoice {
  id: string
  business_id: string
  customer_name: string
  customer_phone?: string
  items: InvoiceItem[]
  total: number
  status: 'unpaid' | 'paid' | 'overdue'
  due_date?: string
  created_at: string
}

export interface Listing {
  id: string
  business_id: string
  name: string
  description?: string
  price?: number
  image_url?: string
  is_active: boolean
  created_at: string
}

export interface Expense {
  id: string
  business_id: string
  amount: number
  category: string
  description?: string
  expense_date: string
  created_at: string
}

export interface Lead {
  id: string
  business_id: string
  issue_type: 'no_website' | 'low_trust' | 'unverified' | 'no_reviews'
  status: 'new' | 'contacted' | 'proposal' | 'converted' | 'lost'
  notes?: string
  created_at: string
}

export interface Review {
  id: string
  business_id: string
  reviewer_name: string
  rating: number
  comment: string
  created_at: string
  // Added by the review-integrity foundation (Sep 2026). All optional so
  // existing call sites that only select a subset of columns still typecheck.
  moderation_status?: 'published' | 'flagged' | 'removed'
  flagged_reason?: string | null
  flagged_at?: string | null
  moderated_by?: string | null
  moderated_at?: string | null
  reviewer_ip_hash?: string | null
  reviewer_phone?: string | null
  reviewer_email?: string | null
}

export interface ReviewReport {
  id: string
  review_id: string
  business_id: string
  reason: 'fake' | 'spam' | 'self_review' | 'offensive' | 'irrelevant' | 'other'
  details: string | null
  reporter_contact: string | null
  status: 'open' | 'dismissed' | 'upheld'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface Subscription {
  id: string
  business_id: string
  plan: 'free' | 'growth' | 'pro'
  // No CHECK constraint in the DB — 'trialing' and 'active' are the only
  // values anything currently writes (the provision_trial_subscription()
  // and expire_trial_subscriptions() Postgres functions, and the Paystack
  // webhook), but this is kept as `string` rather than a narrower union so
  // it can't silently drift out of sync with the database again.
  status: string
  trial_started_at: string | null
  expires_at: string | null
  paystack_reference: string | null
  created_at: string
  updated_at: string
}