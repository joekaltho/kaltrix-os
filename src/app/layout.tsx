import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { ThemeProvider } from '@/context/ThemeContext'

export const metadata: Metadata = {
  metadataBase: new URL('https://kaltrixos.com'),
  title: "KaltrixOS — Africa's Business Operating System",
  description:
    'KaltrixOS gives African businesses an online presence with a TrustScore, and a complete operating system — bookings, CRM, invoicing and revenue tracking. Built for Nigerian SMEs.',

  keywords: [
    'Nigerian business directory',
    'Africa business platform',
    'trusted businesses Nigeria',
    'SME operating system',
    'business discovery Nigeria',
    'KaltrixOS',
    'Kaltrix',
  ],

  openGraph: {
    title: "KaltrixOS — Africa's Business Operating System",
    description:
      'Get found. Get trusted. Get customers. The complete business OS for African SMEs.',
    url: 'https://kaltrixos.com',
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
            // Light is the default. Dark only applies when the user has
            // explicitly picked it with the toggle (stored in localStorage) --
            // the OS preference is deliberately NOT consulted.
            __html: `(function(){try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}