'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

// Catches errors that escape every other boundary, including the root
// layout. It replaces the whole document, so it carries its own <html>,
// <body> and styles (the app's Tailwind theme is not available here).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#f7f7f2',
          color: '#0a0a0a',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/kaltrixos-mark.svg"
            alt="KaltrixOS"
            width={48}
            height={50}
            style={{ marginBottom: 24 }}
          />
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: '0 0 12px' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#3a3a3a', lineHeight: 1.6, margin: '0 0 28px' }}>
            This page hit an unexpected error. Try again, and if it keeps
            happening, reload the page or come back in a few minutes.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: '#06231e',
              color: '#eef6f0',
              border: 0,
              borderRadius: 12,
              padding: '12px 28px',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
