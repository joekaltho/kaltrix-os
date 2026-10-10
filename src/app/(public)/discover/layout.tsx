import type { Metadata } from 'next'

const SITE_URL = 'https://kaltrixos.com'

export const metadata: Metadata = {
  title: 'Discover Trusted Businesses | KaltrixOS',
  description:
    'Browse verified Nigerian businesses on KaltrixOS -- filter by TrustScore, industry, and city to find who to work with next.',
  alternates: {
    canonical: `${SITE_URL}/discover`,
  },
  openGraph: {
    title: 'Discover Trusted Businesses | KaltrixOS',
    description:
      'Browse verified Nigerian businesses on KaltrixOS -- filter by TrustScore, industry, and city.',
    url: `${SITE_URL}/discover`,
    type: 'website',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: "KaltrixOS — Africa's Business Operating System",
      },
    ],
  },
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}