import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'KaltrixOS — Africa\'s Business Operating System',
  description: 'KaltrixOS gives African businesses a verified online presence, a TrustScore, and a complete operating system — bookings, CRM, invoicing and revenue tracking. Built for Nigerian SMEs.',
  keywords: 'Nigerian business directory, Africa business platform, verified businesses Nigeria, SME operating system, business discovery Nigeria, KaltrixOS, Kaltrix',
  openGraph: {
    title: 'KaltrixOS — Africa\'s Business Operating System',
    description: 'Get found. Get trusted. Get customers. The complete business OS for African SMEs.',
    url: 'https://kaltrix-os.vercel.app',
    siteName: 'KaltrixOS',
    locale: 'en_NG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KaltrixOS — Africa\'s Business Operating System',
    description: 'Get found. Get trusted. Get customers. Built for African SMEs.',
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
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}