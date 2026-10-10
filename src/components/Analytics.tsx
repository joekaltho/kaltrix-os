'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

// Google Analytics 4. Renders nothing until NEXT_PUBLIC_GA_MEASUREMENT_ID
// is set, and only in production on the production Vercel environment
// (no dev or preview traffic in the numbers).
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
const ENABLED =
  Boolean(GA_ID) &&
  process.env.NODE_ENV === 'production' &&
  (process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'production') === 'production'

// Private or token-bearing pages never reach GA: signed-in app, admin,
// invoice links (capability URLs) and auth callbacks / password reset.
const EXCLUDED_PREFIXES = ['/dashboard', '/admin', '/invoice', '/auth', '/reset-password']

function isExcluded(pathname: string) {
  return EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

type GtagWindow = Window & {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
  __gaReady?: boolean
  [key: `ga-disable-${string}`]: boolean | undefined
}

export default function Analytics() {
  const pathname = usePathname()

  useEffect(() => {
    if (!ENABLED || !GA_ID) return
    const w = window as unknown as GtagWindow

    // Queue commands now; gtag.js drains the queue when it loads.
    w.dataLayer = w.dataLayer || []
    if (!w.gtag) {
      w.gtag = function gtag() {
        // GA requires the `arguments` object, not a rest array.
        // eslint-disable-next-line prefer-rest-params
        w.dataLayer!.push(arguments)
      }
    }
    if (!w.__gaReady) {
      w.gtag('js', new Date())
      // Page views are sent manually below so the path (no query string)
      // is under our control on every client-side navigation.
      w.gtag('config', GA_ID, { send_page_view: false })
      w.__gaReady = true
    }

    const excluded = isExcluded(pathname)
    // Official GA opt-out flag, checked on every hit.
    w[`ga-disable-${GA_ID}`] = excluded
    if (excluded) return

    w.gtag('event', 'page_view', {
      page_path: pathname,
      page_location: `${window.location.origin}${pathname}`,
      page_title: document.title,
    })
  }, [pathname])

  if (!ENABLED || !GA_ID) return null

  return (
    <Script
      id="ga-gtag"
      src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
      strategy="afterInteractive"
    />
  )
}
