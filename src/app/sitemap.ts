import type { MetadataRoute } from 'next'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Revalidate the generated sitemap at most once an hour -- business
// listings change slowly enough that per-request generation isn't worth
// the extra DB round trip on every crawler hit.
export const revalidate = 3600

const SITE_URL = 'https://kaltrixos.com'

// A plain anon-key client (no cookies/session) is deliberate here: this
// route has no request-scoped user, and we want the exact same
// RLS-gated "public" view of `businesses` that an anonymous visitor
// gets -- not the service-role client, which would bypass RLS and risk
// listing rows that aren't meant to be public. `businesses` has no
// status/is_public/deleted column (confirmed against the live schema);
// row presence + RLS is what defines "public" for this table, so
// querying through the anon key is itself the privacy filter.
function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls: MetadataRoute.Sitemap = [
    { url: SITE_URL, priority: 1.0 },
    { url: `${SITE_URL}/discover`, priority: 0.9 },
    { url: `${SITE_URL}/signup`, priority: 0.8 },
    { url: `${SITE_URL}/login`, priority: 0.7 },
  ]

  let businessUrls: MetadataRoute.Sitemap = []

  try {
    const supabase = createPublicClient()
    const { data: businesses } = await supabase
      .from('businesses')
      .select('slug, created_at')

    businessUrls = (businesses || [])
      .filter((b): b is { slug: string; created_at: string | null } => Boolean(b.slug))
      .map((b) => ({
        url: `${SITE_URL}/business/${b.slug}`,
        // `businesses` has no `updated_at` column -- `created_at` is the
        // closest available signal for lastModified.
        ...(b.created_at ? { lastModified: new Date(b.created_at) } : {}),
        priority: 0.6,
      }))
  } catch {
    // If the businesses query fails for any reason, still return the
    // static URLs rather than let the whole sitemap 500.
  }

  return [...staticUrls, ...businessUrls]
}
