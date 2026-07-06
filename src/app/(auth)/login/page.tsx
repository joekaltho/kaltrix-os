'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) { setError(signInError.message); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex font-sans">

      {/* Left — brand panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-ink flex-col justify-between p-14 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] rounded-full bg-brand/8 blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-brand/5 blur-3xl" />
        </div>

        <Link href="/" className="relative z-10">
          <span className="text-xl font-black text-white tracking-tight">
            Kaltrix<span className="text-brand">OS</span>
          </span>
        </Link>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-brand/10 border border-brand/20 rounded-full px-3 py-1 mb-10">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse-slow" />
            <span className="text-brand text-xs font-semibold tracking-wide">Africa&apos;s Business OS</span>
          </div>
          <h2 className="text-4xl font-black text-white leading-tight mb-4">
            Every verified business<br />deserves to be found.
          </h2>
          <p className="text-white/40 text-base leading-relaxed max-w-xs">
            Bookings, CRM, invoices and trust — all in one place for Nigerian SMBs.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-4">
            {[
              { value: '40M+', label: 'SMEs in Nigeria' },
              { value: '<2%', label: 'Have a web presence' },
              { value: '98%', label: 'Economically invisible' },
              { value: '$1T+', label: 'Untapped opportunity' },
            ].map((s) => (
              <div key={s.label} className="bg-white/4 border border-white/8 rounded-xl p-4">
                <p className="text-2xl font-black text-brand mb-0.5">{s.value}</p>
                <p className="text-white/40 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/20 text-xs relative z-10">© 2026 KaltrixOS · Built in Nigeria</p>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-ivory">
        <div className="w-full max-w-sm">

          <div className="lg:hidden text-center mb-10">
            <Link href="/" className="text-2xl font-black text-ink">
              Kaltrix<span className="text-brand">OS</span>
            </Link>
          </div>

          <h1 className="text-2xl font-black text-ink mb-1">Welcome back</h1>
          <p className="text-inkFaint text-sm mb-8">Sign in to your KaltrixOS account</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 mb-5 text-sm">
              {error}
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
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-inkMid uppercase tracking-wider">Password</label>
                <Link href="/forgot-password" className="text-xs text-brand hover:underline font-medium">Forgot?</Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-brand text-white font-black py-3.5 rounded-xl transition shadow-brand hover:shadow-brandLg disabled:opacity-50 text-sm mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border text-center">
            <p className="text-inkFaint text-sm">
              No account yet?{' '}
              <Link href="/signup" className="text-brand font-bold hover:underline">Create one free</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
