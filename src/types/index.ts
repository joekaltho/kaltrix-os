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
  is_verified: boolean
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
}

export interface Subscription {
  id: string
  business_id: string
  plan: 'free' | 'growth' | 'pro'
  status: 'active' | 'cancelled' | 'expired'
  created_at: string
}