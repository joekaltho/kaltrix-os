import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-ivory font-sans flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-brandBg border border-brand/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-7 h-7 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-brand text-xs font-black uppercase tracking-widest mb-3">404</p>
        <h1 className="text-3xl font-black text-ink mb-3">Page not found</h1>
        <p className="text-inkFaint text-base mb-8 leading-relaxed">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="gradient-brand text-white font-black px-8 py-3 rounded-xl transition shadow-brand text-sm"
          >
            Go Home
          </Link>
          <Link
            href="/discover"
            className="bg-surface border border-border hover:border-inkFaint text-ink font-bold px-8 py-3 rounded-xl transition text-sm shadow-card"
          >
            Discover Businesses
          </Link>
        </div>
      </div>
    </div>
  )
}