import type * as Sentry from '@sentry/nextjs'

// Shared Sentry options for the browser, Node and edge runtimes.
//
// Inert until NEXT_PUBLIC_SENTRY_DSN is set -- with no DSN the SDK does
// nothing, so this is safe to ship before the Sentry project exists.
// The DSN is a public identifier (it only allows sending events), so it
// is fine for it to be NEXT_PUBLIC_.
//
// Errors only: no tracing, no session replay. Keeps the client bundle
// light and the free-tier quota for real errors.

// Query strings and hashes carry auth codes / tokens / search filters, and
// /invoice/<id> is a capability URL. Neither should ever reach Sentry.
export function scrubUrl(url: string): string {
  return url.split(/[?#]/)[0].replace(/\/invoice\/[^/]+/, '/invoice/[id]')
}

export const sentryOptions: Sentry.NodeOptions & Sentry.BrowserOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled:
    process.env.NODE_ENV === 'production' &&
    Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  // v11 collects cookies, headers, request/response bodies, query params
  // and local variables by default. Reviews, messages and invoices carry
  // names, phone numbers and emails, so turn all of it off.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    stackFrameVariables: false,
  },
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications.',
  ],
  beforeSend(event) {
    if (event.request?.url) event.request.url = scrubUrl(event.request.url)
    if (event.request) delete event.request.query_string
    return event
  },
  beforeBreadcrumb(breadcrumb) {
    const data = breadcrumb.data
    if (data) {
      for (const key of ['url', 'from', 'to'] as const) {
        if (typeof data[key] === 'string') data[key] = scrubUrl(data[key])
      }
    }
    return breadcrumb
  },
}
