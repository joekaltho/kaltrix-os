// next.config.ts
import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs/config'

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
}

// Source-map upload only runs when SENTRY_AUTH_TOKEN (+ SENTRY_ORG and
// SENTRY_PROJECT) are set in the build environment. Without them the
// build still succeeds; stack traces are just minified.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
})
