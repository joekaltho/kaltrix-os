'use client'

import Link from 'next/link'

export default function ConfirmEmailPage() {
  return (
    <div className="min-h-screen bg-ivory font-sans flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="text-xl font-black text-ink block mb-10">
          Kaltrix<span className="text-brand">OS</span>
        </Link>
        <div className="bg-surface rounded-2xl border border-border shadow-lift p-10">
          <div className="w-14 h-14 bg-brandBg border border-brand/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-black text-ink mb-2">Check your email</h1>
          <p className="text-inkFaint text-sm mb-6 leading-relaxed">
            We sent you a confirmation link. Click it to verify your account — you'll be taken straight to your dashboard.
          </p>
          <Link href="/login" className="block gradient-brand text-white font-black py-3 rounded-xl transition shadow-brand text-sm mb-3">
            Go to Sign In
          </Link>
          <p className="text-inkFaint text-xs">
            Didn't get it? Check your spam folder or{' '}
            <Link href="/signup" className="text-brand hover:underline font-medium">try again</Link>
          </p>
        </div>
      </div>
    </div>
  )
}