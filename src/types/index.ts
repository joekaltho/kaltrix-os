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
  customer_id?: string
  customer_name: string
  customer_phone?: string
  service: string
  date: string
  time: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
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