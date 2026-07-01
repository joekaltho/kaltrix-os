// KaltrixOS TrustScore Engine
// Produces granular scores between 0-100, never round multiples
// Each signal has a weighted base + micro-variance based on content quality

interface TrustInput {
  business_name?: string
  industry?: string
  city?: string
  phone?: string
  website_url?: string
  description?: string
  has_logo?: boolean
  is_verified?: boolean
  review_count?: number
  avg_rating?: number
}

function nameQuality(name: string): number {
  if (!name) return 0
  let score = 8
  if (name.length > 10) score += 2  // longer names feel more legitimate
  if (name.split(' ').length > 1) score += 2  // multi-word names score higher
  if (/[^a-zA-Z0-9\s&'-]/.test(name)) score -= 1  // penalise odd chars
  return Math.min(score, 12)
}

function descriptionQuality(desc: string): number {
  if (!desc) return 0
  const len = desc.length
  if (len < 50) return 3
  if (len < 100) return 7
  if (len < 200) return 11
  if (len < 400) return 14
  return 17 // rich descriptions get max
}

function phoneQuality(phone: string): number {
  if (!phone) return 0
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return 13  // standard Nigerian number
  if (digits.length === 10) return 11
  return 7 // present but odd format
}

function websiteQuality(url: string): number {
  if (!url) return 0
  let score = 14
  if (url.startsWith('https://')) score += 3  // SSL bonus
  if (url.includes('www.')) score += 1
  return Math.min(score, 18)
}

function reviewSignal(count: number, avg: number): number {
  if (!count || !avg) return 0
  let score = Math.min(count * 0.5, 8)  // up to 8 points for volume
  score += (avg / 5) * 7                // up to 7 points for quality
  return Math.round(score)
}

// Deterministic micro-variance based on business name
// Same business always gets same score — not random
function deterministicVariance(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  // Returns a value between -3 and +3
  return ((Math.abs(hash) % 7) - 3)
}

export function calculateTrustScore(input: TrustInput): number {
  let score = 0

  score += nameQuality(input.business_name || '')
  score += input.industry ? 8 : 0
  score += input.city ? 9 : 0
  score += phoneQuality(input.phone || '')
  score += websiteQuality(input.website_url || '')
  score += descriptionQuality(input.description || '')
  score += input.has_logo ? 16 : 0
  score += input.is_verified ? 12 : 0
  score += reviewSignal(input.review_count || 0, input.avg_rating || 0)

  // Add deterministic micro-variance so scores never feel AI-rounded
  const seed = (input.business_name || '') + (input.city || '') + (input.phone || '')
  score += deterministicVariance(seed)

  return Math.max(1, Math.min(100, Math.round(score)))
}
