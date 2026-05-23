'use client'

export const dynamic = 'force-dynamic' // ✅ Prevents static generation

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // ✅ Lazy load Supabase client only when needed
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()

    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => {
      router.push('/login')
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            Kaltrix<span className="text-green-400">OS</span>
          </h1>
          <p className="text-gray-400 mt-2">Africa's Business Operating System</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-2">
            Reset your password
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            Enter your new password below.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 mb-6 text-sm">
              {error}
            </div>
          )}

          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-400/10 border border-green-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-8 h-8 bg-green-400 rounded-full" />
              </div>
              <h3 className="text-white font-semibold mb-2">Password Reset!</h3>
              <p className="text-gray-400 text-sm mb-4">
                Your password has been updated. Redirecting to login...
              </p>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Min. 8 characters"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-400 hover:bg-green-300 text-black font-semibold rounded-lg px-4 py-3 transition disabled:opacity-50"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          <p className="text-center text-gray-400 text-sm mt-6">
            Remember your password?{' '}
            <Link href="/login" className="text-green-400 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}