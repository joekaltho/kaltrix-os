'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      setHasSession(!!data.session)
      setCheckingSession(false)
    }
    checkSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setDone(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-ivory font-sans flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
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
          {!hasSession ? (
            <div className="text-center">
              <h2 className="text-xl font-black text-ink mb-2">Reset link invalid or expired</h2>
              <p className="text-inkFaint text-sm leading-relaxed mb-6">
                Please request a new password reset link.
              </p>
              <Link href="/forgot-password" className="text-brand text-sm font-bold hover:underline">
                Back to Forgot Password
              </Link>
            </div>
          ) : done ? (
            <div className="text-center">
              <h2 className="text-xl font-black text-ink mb-2">Password updated</h2>
              <p className="text-inkFaint text-sm leading-relaxed">
                Redirecting you to your dashboard&hellip;
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-black text-ink mb-1">Set a new password</h2>
              <p className="text-inkFaint text-sm mb-8">Choose a strong password for your account.</p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 mb-5 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-inkMid uppercase tracking-wider mb-1.5 block">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    className="w-full bg-ivory border border-border rounded-xl px-4 py-3 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-inkMid uppercase tracking-wider mb-1.5 block">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    className="w-full bg-ivory border border-border rounded-xl px-4 py-3 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full gradient-brand text-white font-black py-3.5 rounded-xl transition shadow-brand disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
