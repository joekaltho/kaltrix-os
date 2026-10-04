import Logo from '@/components/Logo'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

// Shared frame for the stand-alone "new X" / settings screens: one back link
// (instead of a second "← Dashboard" in the top bar), then title, then form.
export default function FormPage({
  title,
  description,
  backHref = '/dashboard',
  backLabel = 'Dashboard',
  children,
}: {
  title: string
  description?: string
  backHref?: string
  backLabel?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-ivory font-sans text-ink">
      <header className="glass sticky top-0 z-20 border-b border-border">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4 sm:px-6">
          <Link href="/dashboard" className="text-base font-black tracking-tight">
            <Logo size="md" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8">
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-inkFaint transition hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </Link>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-inkFaint">{description}</p>}
        </div>
        {children}
      </main>
    </div>
  )
}

// Section card used inside FormPage forms.
export function FormSection({
  title,
  description,
  id,
  children,
}: {
  title: string
  description?: string
  id?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20 rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-inkFaint">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

// Sticky bottom action bar so the submit button is always in thumb reach.
export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-2xl items-center justify-end gap-3 px-4 py-3 sm:px-6">{children}</div>
    </div>
  )
}
