import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { ThemeProvider } from '@/context/ThemeContext'

export const metadata: Metadata = {
  title: "KaltrixOS — Africa's Business Operating System",
  description:
    'KaltrixOS gives African businesses a verified online presence, a TrustScore, and a complete operating system — bookings, CRM, invoicing and revenue tracking. Built for Nigerian SMEs.',

  keywords: [
    'Nigerian business directory',
    'Africa business platform',
    'verified businesses Nigeria',
    'SME operating system',
    'business discovery Nigeria',
    'KaltrixOS',
    'Kaltrix',
  ],

  openGraph: {
    title: "KaltrixOS — Africa's Business Operating System",
    description:
      'Get found. Get trusted. Get customers. The complete business OS for African SMEs.',
    url: 'https://kaltrix-os.vercel.app',
    siteName: 'KaltrixOS',
    locale: 'en_NG',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: "KaltrixOS — Africa's Business Operating System",
    description:
      'Get found. Get trusted. Get customers. Built for African SMEs.',
    creator: '@kaltrixos',
  },

  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}