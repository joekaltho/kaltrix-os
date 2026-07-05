'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const urlError = searchParams?.get('error')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    if (resetError) { setError(resetError.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-ivory font-sans flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-10">
          <Link href="/" className="text-2xl font-black text-ink">
            Kaltrix<span className="text-brand">OS</span>
          </Link>
        </div>

        <div className="bg-surface rounded-2xl border border-border shadow-lift p-8 sm:p-10">
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-brandBg border border-brand/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-black text-ink mb-2">Check your email</h2>
              <p className="text-inkFaint text-sm leading-relaxed mb-6">
                We sent a reset link to <span className="text-ink font-semibold">{email}</span>. Click it to set a new password.
              </p>
              <Link href="/login" className="text-brand text-sm font-bold hover:underline">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-black text-ink mb-1">Forgot your password?</h2>
              <p className="text-inkFaint text-sm mb-8">Enter your email and we will send you a reset link.</p>

              {(error || urlError) && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-3 mb-5 text-sm">
                  {urlError === 'expired'
                    ? 'Your reset link has expired. Please request a new one below.'
                    : urlError === 'denied'
                    ? 'Access was denied. Please request a new reset link.'
                    : error || 'Something went wrong. Please try again.'}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-inkMid uppercase tracking-wider mb-1.5 block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full bg-ivory border border-border rounded-xl px-4 py-3 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full gradient-brand text-white font-black py-3.5 rounded-xl transition shadow-brand disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</>
                  ) : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-border text-center">
                <p className="text-inkFaint text-sm">
                  Remember your password?{' '}
                  <Link href="/login" className="text-brand font-bold hover:underline">Sign in</Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}