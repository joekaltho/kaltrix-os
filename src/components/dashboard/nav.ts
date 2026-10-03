import { Activity, CalendarDays, FileText, Inbox, LayoutGrid, Store, Users, type LucideIcon } from 'lucide-react'

export type Tab = 'overview' | 'inbox' | 'bookings' | 'customers' | 'invoices' | 'listings' | 'pulse'

export const isTab = (value: string | null): value is Tab =>
  value === 'overview' || value === 'inbox' || value === 'bookings' || value === 'customers' ||
  value === 'invoices' || value === 'listings' || value === 'pulse'

export type NavGroup = 'main' | 'manage' | 'insights'

export interface NavItem {
  id: Tab
  label: string
  icon: LucideIcon
  group: NavGroup
  badge?: number
  // 'alert' draws attention (unread messages); 'count' is just a quiet number.
  badgeTone?: 'alert' | 'count'
}

// Same seven destinations as before, same ids and plan gating -- only grouped
// (Miller's Law) so seven flat items read as three small clusters.
export const NAV_BASE: Omit<NavItem, 'badge' | 'badgeTone'>[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid, group: 'main' },
  { id: 'inbox', label: 'Inbox', icon: Inbox, group: 'main' },
  { id: 'bookings', label: 'Bookings', icon: CalendarDays, group: 'manage' },
  { id: 'customers', label: 'Customers', icon: Users, group: 'manage' },
  { id: 'invoices', label: 'Invoices', icon: FileText, group: 'manage' },
  { id: 'listings', label: 'Listings', icon: Store, group: 'manage' },
  { id: 'pulse', label: 'Pulse', icon: Activity, group: 'insights' },
]

// Order in which items earn a slot in the 4-slot mobile bottom bar.
export const MOBILE_PRIORITY: Tab[] = ['overview', 'inbox', 'bookings', 'invoices', 'customers', 'listings', 'pulse']

// Real URLs (not just component state) so the back button, refresh, and
// shared links all land on the right tab.
export const tabHref = (tab: Tab) => (tab === 'overview' ? '/dashboard' : `/dashboard?tab=${tab}`)
