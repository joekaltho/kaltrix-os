import type { Metadata } from 'next'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const SITE_URL = 'https://kaltrixos.com'

// Anon-key client, no cookies/session needed -- same RLS-gated public
// view the client page itself queries through. Keeping this separate
// from the page's own client-side fetch is intentional: metadata is
// generated server-side and must not depend on browser state.
function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const supabase = createPublicClient()

  const { data: business } = await supabase
    .from('businesses')
    .select('business_name, description')
    .eq('slug', slug)
    .maybeSingle()

  if (!business) {
    // Let the page itself handle the not-found state (it already shows
    // a load error / empty state client-side) -- just fall back to
    // sane defaults for metadata rather than guessing at a business
    // name that doesn't exist.
    return {
      title: `Business | KaltrixOS`,
      alternates: { canonical: `${SITE_URL}/business/${slug}` },
    }
  }

  const title = `${business.business_name} | KaltrixOS`
  const description =
    business.description?.trim() ||
    `${business.business_name} on KaltrixOS -- see reviews, TrustScore, and how to get in touch.`

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/business/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/business/${slug}`,
      type: 'website',
    },
  }
}

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
