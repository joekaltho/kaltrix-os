'use client'

import Logo from '@/components/Logo'
import { useEffect } from 'react'
import Link from 'next/link'
import { ExternalLink, LogOut, Menu, Settings, Sparkles, X, Zap, CreditCard } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import type { Business } from '@/types'
import type { Plan, SubscriptionState } from '@/lib/check-plan'
import { MOBILE_PRIORITY, tabHref, type NavGroup, type NavItem, type Tab } from './nav'

const groupLabels: Record<NavGroup, string | null> = { main: null, manage: 'Manage', insights: 'Insights' }

function NavLink({
  item,
  active,
  onSelect,
}: {
  item: NavItem
  active: boolean
  onSelect: (tab: Tab) => void
}) {
  const Icon = item.icon
  return (
    <a
      href={tabHref(item.id)}
      aria-current={active ? 'page' : undefined}
      onClick={(e) => {
        // Let cmd/ctrl-click open in a new tab; otherwise switch in place.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        onSelect(item.id)
      }}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-ivoryDim text-ink' : 'text-inkMid hover:bg-ivoryDim hover:text-ink'
      }`}
    >
      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-brandText' : 'text-inkFaint'}`} aria-hidden />
      <span className="flex-1">{item.label}</span>
      {(item.badge ?? 0) > 0 && (
        <span
          className={`min-w-5 rounded-full px-1.5 text-center text-xs font-semibold leading-5 ${
            item.badgeTone === 'alert' ? 'bg-warn text-white dark:text-black' : 'bg-ivoryDeep text-inkMid'
          }`}
        >
          {item.badge}
        </span>
      )}
    </a>
  )
}

interface SidebarProps {
  business: Business | null
  userName: string
  plan: Plan
  subscription: SubscriptionState | null
  activeTab: Tab
  navItems: NavItem[]
  onSelect: (tab: Tab) => void
  onSignOut: () => void
}

export function Sidebar({ business, userName, plan, subscription, activeTab, navItems, onSelect, onSignOut }: SidebarProps) {
  const showUpgrade = plan === 'free' || subscription?.isTrialing

  return (
    <div className="flex h-full w-full flex-col">
      <div className="shrink-0 border-b border-border px-5 py-4">
        <Logo size="md" />
      </div>

      {business && (
        <div className="shrink-0 border-b border-border px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-ivoryDim text-xs font-bold text-inkMid">
              {business.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={business.logo_url} alt="" className="h-full w-full object-cover" />
                : business.business_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{business.business_name}</p>
              <p className="truncate text-xs text-inkFaint">
                TrustScore {business.trust_score}{business.is_verified ? ' · Verified' : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      <nav aria-label="Dashboard" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {(['main', 'manage', 'insights'] as NavGroup[]).map((group) => {
          const items = navItems.filter((i) => i.group === group)
          if (items.length === 0) return null
          return (
            <div key={group}>
              {groupLabels[group] && (
                <p className="mb-1 px-3 text-xs font-medium text-inkFaint">{groupLabels[group]}</p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink key={item.id} item={item} active={activeTab === item.id} onSelect={onSelect} />
                ))}
              </div>
            </div>
          )
        })}

        <div>
          <p className="mb-1 px-3 text-xs font-medium text-inkFaint">Account</p>
          <div className="space-y-0.5">
            <Link href="/dashboard/profile" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-inkMid transition-colors hover:bg-ivoryDim hover:text-ink">
              <Settings className="h-[18px] w-[18px] shrink-0 text-inkFaint" aria-hidden />
              Business settings
            </Link>
            {business?.slug && (
              <Link href={`/business/${business.slug}`} target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-inkMid transition-colors hover:bg-ivoryDim hover:text-ink">
                <ExternalLink className="h-[18px] w-[18px] shrink-0 text-inkFaint" aria-hidden />
                View public page
              </Link>
            )}
            {showUpgrade && (
              <Link href="/dashboard/upgrade" className="flex items-center gap-3 rounded-lg bg-brandBg px-3 py-2 text-sm font-semibold text-brandText transition-colors hover:bg-brandMid">
                <Zap className="h-[18px] w-[18px] shrink-0" aria-hidden />
                Upgrade plan
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Coming soon: deliberately quiet, no coloured pills competing with real nav */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        <p className="mb-1.5 text-xs font-medium text-inkFaint">Coming soon</p>
        <ul className="space-y-1 text-xs text-inkFaint">
          <li className="flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" aria-hidden />KaltrixPay</li>
          <li className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" aria-hidden />Velocity AI</li>
        </ul>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-ink">{userName}</p>
          <p className="text-xs capitalize text-inkFaint">
            {plan} plan{subscription?.isTrialing ? ` · trial, ${subscription.trialDaysLeft}d left` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-inkMid transition-colors hover:bg-dangerBg hover:text-danger"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}

// Mobile: the four most-used destinations one thumb-tap away, everything else under "More".
export function MobileBottomNav({
  navItems,
  activeTab,
  onSelect,
  onMore,
}: {
  navItems: NavItem[]
  activeTab: Tab
  onSelect: (tab: Tab) => void
  onMore: () => void
}) {
  const primary = MOBILE_PRIORITY
    .map((id) => navItems.find((i) => i.id === id))
    .filter((i): i is NavItem => !!i)
    .slice(0, 4)

  const slot = 'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors'

  return (
    <nav
      aria-label="Dashboard"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {primary.map((item) => {
        const Icon = item.icon
        const active = activeTab === item.id
        return (
          <a
            key={item.id}
            href={tabHref(item.id)}
            aria-current={active ? 'page' : undefined}
            onClick={(e) => { e.preventDefault(); onSelect(item.id) }}
            className={`${slot} ${active ? 'text-brandText' : 'text-inkFaint'}`}
          >
            <span className="relative">
              <Icon className="h-5 w-5" aria-hidden />
              {(item.badge ?? 0) > 0 && item.badgeTone === 'alert' && (
                <span className="absolute -right-1.5 -top-1 min-w-4 rounded-full bg-warn px-1 text-center text-[10px] font-semibold leading-4 text-white dark:text-black">
                  {item.badge}
                </span>
              )}
            </span>
            {item.label}
          </a>
        )
      })}
      <button type="button" onClick={onMore} className={`${slot} text-inkFaint`}>
        <Menu className="h-5 w-5" aria-hidden />
        More
      </button>
    </nav>
  )
}

export function MobileDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 bg-inkStatic/40" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-modal">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-inkFaint hover:bg-ivoryDim hover:text-ink"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  )
}
