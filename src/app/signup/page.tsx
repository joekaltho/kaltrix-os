'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  const LAUNCH_DATE = new Date('2026-06-22T00:00:00')
  const isRegistrationOpen = new Date() >= LAUNCH_DATE

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isRegistrationOpen) return
    setLoading(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { name: form.name },
      },
    })

    if (signUpError) { setError(signUpError.message); setLoading(false); return }
    if (!data.user) { setError('Signup failed — please try again.'); setLoading(false); return }

    if (data.session) {
      // Email auto-confirmed — insert profile and go straight to onboarding
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        name: form.name,
        email: form.email,
        role: 'business',
      })
      if (profileError) {
        console.error('Profile insert error:', profileError.message)
      }
      router.push('/dashboard/create-business')
    } else {
      // Email confirmation required — save pending profile data and show confirm screen
      if (typeof window !== 'undefined') {
        localStorage.setItem('pendingProfile', JSON.stringify({
          id: data.user.id,
          name: form.name,
          email: form.email,
        }))
      }
      setLoading(false)
      router.push('/signup/confirm')
    }
  }

  if (!isRegistrationOpen) {
    return (
      <div className="min-h-screen bg-ivory font-sans flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <Link href="/" className="text-2xl font-black text-ink block mb-10">
            Kaltrix<span className="text-brand">OS</span>
          </Link>
          <div className="bg-surface rounded-2xl border border-border shadow-lift p-10">
            <div className="w-14 h-14 bg-brandBg border border-brand/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <span className="text-2xl">🚀</span>
            </div>
            <h1 className="text-xl font-black text-ink mb-2">Registration Opening Soon</h1>
            <p className="text-inkFaint text-sm mb-6">KaltrixOS launches June 22, 2026. Join the waitlist to be first in.</p>
            <a href="/#waitlist" className="block gradient-brand text-white font-bold py-3 rounded-xl transition shadow-brand text-sm mb-3">
              Join the Waitlist →
            </a>
            <Link href="/login" className="text-brand text-sm hover:underline font-medium">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex font-sans">

      {/* Left — brand panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-ink flex-col justify-between p-12 relative overflow-hidden">
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
          <div className="inline-flex items-center gap-2 bg-brand/10 border border-brand/20 rounded-full px-3 py-1 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse-slow" />
            <span className="text-brand text-xs font-semibold tracking-wide">Free to get started</span>
          </div>
          <h2 className="text-3xl font-black text-white leading-tight mb-4">
            Your business deserves<br />to be discovered.
          </h2>
          <p className="text-white/40 text-sm leading-relaxed max-w-xs">
            Set up your verified business profile in minutes. Get found. Build trust. Grow.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { icon: '✓', text: 'Free verified business profile' },
              { icon: '✓', text: 'TrustScore visible to customers' },
              { icon: '✓', text: 'Listed on Discover instantly' },
              { icon: '✓', text: 'No credit card required' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-brand text-xs font-bold">{item.icon}</span>
                </div>
                <p className="text-white/60 text-sm">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/20 text-xs relative z-10">© 2026 KaltrixOS · Built in Nigeria</p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-ivory">
        <div className="w-full max-w-sm">

          <div className="lg:hidden text-center mb-10">
            <Link href="/" className="text-2xl font-black text-ink">
              Kaltrix<span className="text-brand">OS</span>
            </Link>
          </div>

          <h1 className="text-2xl font-black text-ink mb-1">Create your account</h1>
          <p className="text-inkFaint text-sm mb-8">Get your business online in minutes. Free forever.</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 mb-5 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-inkMid uppercase tracking-wider mb-1.5 block">Full Name</label>
              <input
                type="text" name="name" value={form.name} onChange={handleChange} required
                placeholder="John Doe"
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition text-sm shadow-inner"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-inkMid uppercase tracking-wider mb-1.5 block">Email Address</label>
              <input
                type="email" name="email" value={form.email} onChange={handleChange} required
                placeholder="you@example.com"
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition text-sm shadow-inner"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-inkMid uppercase tracking-wider mb-1.5 block">Password</label>
              <input
                type="password" name="password" value={form.password} onChange={handleChange} required
                placeholder="Min. 8 characters"
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition text-sm shadow-inner"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full gradient-brand text-white font-black py-3.5 rounded-xl transition shadow-brand hover:shadow-brandLg disabled:opacity-50 text-sm mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </>
              ) : 'Create Account →'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border text-center">
            <p className="text-inkFaint text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-brand font-bold hover:underline">Sign in</Link>
            </p>
          </div>

          <p className="text-center text-inkFaint text-xs mt-4">
            By creating an account you agree to our terms of service.
          </p>
        </div>
      </div>
    </div>
  )
}
