import Logo from '@/components/Logo'
import Link from 'next/link'
import FeedbackForm from '@/components/FeedbackForm'

export const metadata = {
  title: 'Feedback — KaltrixOS',
  description: 'Tell us what is working and what is not on KaltrixOS.',
}

export default function PublicFeedbackPage() {
  return (
    <div className="min-h-screen bg-ivory font-sans text-ink">
      <nav className="glass sticky top-0 z-20 border-b border-border shadow-card">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-base font-black tracking-tight">
            <Logo size="md" />
          </Link>
          <Link href="/discover" className="text-sm font-medium text-inkFaint transition hover:text-ink">
            Discover
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Feedback</h1>
        <p className="mb-6 mt-1 text-sm text-inkFaint">
          Found a problem, or have an idea? Tell us. You do not need an account.
        </p>
        <FeedbackForm variant="customer" />
      </main>
    </div>
  )
}
