'use client'

import * as Sentry from '@sentry/nextjs'

export default function SentryTestPage() {
  function sendTestError() {
    Sentry.captureException(
      new Error('KaltrixOS Sentry integration test')
    )
  }

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Sentry Integration Test</h1>
      <p>Click the button to send a test error to Sentry.</p>
      <button onClick={sendTestError}>
        Send test error
      </button>
    </main>
  )
}