// Loads everything the dashboard needs for the signed-in owner.
//
// Before: profile+business, THEN subscription+messages+payment details, THEN
// bookings+customers+invoices -- three sequential browser -> Supabase round trips
// (each with its own CORS preflight) before anything could render.
//
// Now: ONE round trip. The business row comes back with its related rows embedded
// (PostgREST resource embedding over the existing foreign keys), fetched alongside
// the profile. Row Level Security is applied to every embedded table exactly as it is
// to a direct query, so the owner sees the same rows they always did; plan gating is
// applied in code to the result exactly as before.
//
// If the batched query ever errors (schema change, PostgREST hiccup) the previous
// step-by-step path runs instead, so the dashboard degrades to slower, never to broken.
//
// Pure of React/Next and of any import path alias, so it runs under `node --test`.

import type { Business, Booking, Customer, Invoice, Message } from '@/types'
import type { PaymentDetails } from '@/lib/payment'
import type { Plan, SubscriptionRecord, SubscriptionState } from '@/lib/plan-state'

// Only the part of the Supabase client we use, so tests can supply a fake.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DashboardClient { from(table: string): any }

export interface PlanHelpers {
  subscriptionStateFromRow: (row: SubscriptionRecord | null | undefined) => SubscriptionState
  hasFeature: (plan: Plan, feature: 'bookings' | 'crm' | 'invoices' | 'analytics') => boolean
}

export interface DashboardData {
  userName: string
  business: Business | null
  bank: PaymentDetails | null
  subscription: SubscriptionState | null
  plan: Plan
  messages: Message[]
  bookings: Booking[]
  customers: Customer[]
  invoices: Invoice[]
}

export type DashboardLoad =
  | { status: 'admin' }
  | { status: 'ready'; data: DashboardData; usedFallback: boolean }

const BANK_COLUMNS = 'bank_name, account_name, account_number, payment_instructions'

export const DASHBOARD_BUSINESS_SELECT =
  `*, subscriptions(plan, status, expires_at), business_payment_details(${BANK_COLUMNS}), ` +
  'messages(*), bookings(*), customers(*), invoices(*)'

// Related tables embedded in the business row, newest first like the old queries.
const NEWEST_FIRST = ['messages', 'bookings', 'customers', 'invoices'] as const

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))
const many = <T>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : [])

function build(
  userName: string,
  business: Business | null,
  related: {
    subscription: SubscriptionRecord | null
    bank: PaymentDetails | null
    messages: Message[]
    bookings: Booking[]
    customers: Customer[]
    invoices: Invoice[]
  },
  helpers: PlanHelpers
): DashboardData {
  if (!business) {
    return { userName, business: null, bank: null, subscription: null, plan: 'free', messages: [], bookings: [], customers: [], invoices: [] }
  }
  const subscription = helpers.subscriptionStateFromRow(related.subscription)
  const { plan } = subscription
  return {
    userName,
    business,
    bank: related.bank,
    subscription,
    plan,
    // Messages have no plan gating; the rest only load for plans that include them.
    messages: related.messages,
    bookings: helpers.hasFeature(plan, 'bookings') ? related.bookings : [],
    customers: helpers.hasFeature(plan, 'crm') ? related.customers : [],
    invoices: helpers.hasFeature(plan, 'invoices') ? related.invoices : [],
  }
}

type Batched = { kind: 'admin' } | { kind: 'error'; error: string } | { kind: 'ok'; data: DashboardData }

async function loadBatched(client: DashboardClient, userId: string, helpers: PlanHelpers): Promise<Batched> {
  let businessQuery = client.from('businesses').select(DASHBOARD_BUSINESS_SELECT).eq('user_id', userId)
  for (const table of NEWEST_FIRST) {
    businessQuery = businessQuery.order('created_at', { referencedTable: table, ascending: false })
  }

  const [profileRes, businessRes] = await Promise.all([
    client.from('profiles').select('name, role').eq('id', userId).single(),
    businessQuery.maybeSingle(),
  ])

  const profile = profileRes?.data as { name?: string; role?: string } | null
  if (profile?.role === 'admin') return { kind: 'admin' }
  if (businessRes?.error) return { kind: 'error', error: String(businessRes.error.message ?? businessRes.error.code ?? 'unknown') }

  const row = businessRes?.data as (Business & Record<string, unknown>) | null
  if (!row) return { kind: 'ok', data: build(profile?.name ?? '', null, { subscription: null, bank: null, messages: [], bookings: [], customers: [], invoices: [] }, helpers) }

  const {
    subscriptions, business_payment_details, messages, bookings, customers, invoices,
    ...business
  } = row as Record<string, unknown>
  return {
    kind: 'ok',
    data: build(profile?.name ?? '', business as unknown as Business, {
      subscription: one(subscriptions as SubscriptionRecord | SubscriptionRecord[] | null),
      bank: one(business_payment_details as PaymentDetails | PaymentDetails[] | null),
      messages: many(messages as Message[]),
      bookings: many(bookings as Booking[]),
      customers: many(customers as Customer[]),
      invoices: many(invoices as Invoice[]),
    }, helpers),
  }
}

// The previous behaviour, kept as the safety net (and exported so tests can measure it).
export async function loadSequential(client: DashboardClient, userId: string, helpers: PlanHelpers): Promise<DashboardLoad> {
  const [{ data: profile }, { data: businessData }] = await Promise.all([
    client.from('profiles').select('name, role').eq('id', userId).single(),
    client.from('businesses').select('*').eq('user_id', userId).single(),
  ])
  if (profile?.role === 'admin') return { status: 'admin' }
  const userName = (profile?.name as string | undefined) ?? ''
  if (!businessData) return { status: 'ready', usedFallback: true, data: build(userName, null, { subscription: null, bank: null, messages: [], bookings: [], customers: [], invoices: [] }, helpers) }

  const businessId = (businessData as Business).id
  const [{ data: sub }, { data: messages }, { data: bank }] = await Promise.all([
    client.from('subscriptions').select('plan, status, expires_at').eq('business_id', businessId).maybeSingle(),
    client.from('messages').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
    client.from('business_payment_details').select(BANK_COLUMNS).eq('business_id', businessId).maybeSingle(),
  ])
  const { plan } = helpers.subscriptionStateFromRow(sub as SubscriptionRecord | null)
  const newest = (table: string) =>
    client.from(table).select('*').eq('business_id', businessId).order('created_at', { ascending: false })
  const [b, c, i] = await Promise.all([
    helpers.hasFeature(plan, 'bookings') ? newest('bookings') : Promise.resolve({ data: null }),
    helpers.hasFeature(plan, 'crm') ? newest('customers') : Promise.resolve({ data: null }),
    helpers.hasFeature(plan, 'invoices') ? newest('invoices') : Promise.resolve({ data: null }),
  ])
  return {
    status: 'ready',
    usedFallback: true,
    data: build(userName, businessData as Business, {
      subscription: sub as SubscriptionRecord | null,
      bank: (bank as PaymentDetails | null) ?? null,
      messages: many(messages as Message[]),
      bookings: many(b.data as Booking[]),
      customers: many(c.data as Customer[]),
      invoices: many(i.data as Invoice[]),
    }, helpers),
  }
}

export async function loadDashboardData(
  client: DashboardClient,
  userId: string,
  helpers: PlanHelpers,
  onFallback: (reason: string) => void = (reason) => console.warn('[dashboard] batched load failed, using step-by-step load:', reason)
): Promise<DashboardLoad> {
  const batched = await loadBatched(client, userId, helpers)
  if (batched.kind === 'admin') return { status: 'admin' }
  if (batched.kind === 'ok') return { status: 'ready', data: batched.data, usedFallback: false }
  onFallback(batched.error)
  return loadSequential(client, userId, helpers)
}
