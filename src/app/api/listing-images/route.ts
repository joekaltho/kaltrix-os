import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiError, checkRateLimits, rateLimitResponse, readJsonBody } from '@/lib/api-guard'
import {
  LISTING_IMAGE_BUCKET,
  LISTING_IMAGE_MAX_BYTES,
  listingImageObjectPath,
  listingImageObjectPathFromUrl,
  validateImageMeta,
  validateImageUpload,
} from '@/lib/listing-image'

// Shop listing images. This is the ONLY write path into the `listing-images` bucket:
// Storage has no insert/update/delete policy for browsers, so nobody can upload,
// replace or delete a file by talking to Storage directly.
//
// Who may do what is decided here, in this order:
//   1. the caller must be signed in (session cookie, verified with auth.getUser()),
//   2. they must own a business (looked up with THEIR session, so RLS applies),
//   3. the file is checked on its real bytes (type, size, signature) -- not on the
//      filename or the browser-supplied MIME type,
//   4. the object name is built by the server from the caller's own user id and
//      business id plus a fresh uuid; nothing in the request chooses the path.
// The service-role key is used only for the Storage write/remove and the rate
// limiter, after those checks, and never leaves the server.

// Room for multipart framing on top of the file itself.
const MAX_REQUEST_BYTES = LISTING_IMAGE_MAX_BYTES + 64 * 1024

async function authenticate() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, response: apiError('Please sign in again.', 401) }

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) {
    console.error('Listing image: business lookup failed:', error.code)
    return { ok: false as const, response: apiError('Could not verify your business. Please try again.', 500) }
  }
  if (!business) {
    return { ok: false as const, response: apiError('Create your business profile before uploading images.', 403) }
  }
  return { ok: true as const, userId: user.id, businessId: business.id as string }
}

export async function POST(request: Request) {
  try {
    const declared = Number(request.headers.get('content-length') ?? 0)
    if (declared > MAX_REQUEST_BYTES) {
      return apiError('That image is too large. The maximum size is 4 MB.', 413)
    }
    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
      return apiError('Invalid upload request.', 400)
    }

    const auth = await authenticate()
    if (!auth.ok) return auth.response

    let service: ReturnType<typeof createServiceClient>
    try {
      service = createServiceClient()
    } catch (err) {
      console.error('Listing image: service client unavailable:', err instanceof Error ? err.message : err)
      return apiError('Image uploads are temporarily unavailable. Please try again shortly.', 503)
    }

    const limit = await checkRateLimits(service, [
      { key: `listing-image:user:${auth.userId}`, max: 40, windowSeconds: 3600 },
    ])
    if (limit.status !== 'ok') return rateLimitResponse(limit)

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return apiError('Invalid upload request.', 400)
    }
    const file = form.get('file')
    if (!(file instanceof File)) return apiError('Choose an image to upload.', 400)

    const meta = validateImageMeta(file)
    if (!meta.ok) return apiError(meta.error, meta.status)

    // Never trust file.size: measure the bytes we actually received.
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.length > LISTING_IMAGE_MAX_BYTES) {
      return apiError('That image is too large. The maximum size is 4 MB.', 413)
    }
    const checked = validateImageUpload({ name: file.name, type: file.type, size: bytes.length }, bytes)
    if (!checked.ok) return apiError(checked.error, checked.status)

    const path = listingImageObjectPath(auth.userId, auth.businessId, randomUUID(), checked.ext)
    const { error: uploadError } = await service.storage.from(LISTING_IMAGE_BUCKET).upload(path, bytes, {
      // From the verified signature, not the request.
      contentType: checked.contentType,
      // Every upload gets a fresh name, so the file never changes under its URL.
      cacheControl: '31536000',
      upsert: false,
    })
    if (uploadError) {
      console.error('Listing image: storage upload failed:', uploadError.message)
      return apiError('Upload failed. Please try again.', 500)
    }

    const { data: pub } = service.storage.from(LISTING_IMAGE_BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: pub.publicUrl }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('Listing image upload error:', err instanceof Error ? err.message : err)
    return apiError('Upload failed. Please try again.', 500)
  }
}

// Best-effort removal of a file the caller no longer uses (replaced, removed, or a
// listing deleted). The browser calls this AFTER the listing row has been saved, so
// a failed save never leaves a listing pointing at a deleted file.
//
// Safe by construction: only the caller's OWN file in this project's bucket is ever
// deletable (see listingImageObjectPathFromUrl), and a file that any listing still
// references is left alone. Anything else is a harmless no-op, which is the normal
// case when replacing an old pasted external image URL.
export async function DELETE(request: Request) {
  try {
    const parsed = await readJsonBody(request)
    if (!parsed.ok) return parsed.response
    const url = parsed.body.url
    if (typeof url !== 'string' || url.length === 0 || url.length > 2048) return apiError('Invalid request.', 400)

    const auth = await authenticate()
    if (!auth.ok) return auth.response

    const path = listingImageObjectPathFromUrl(url, auth.userId, auth.businessId, process.env.NEXT_PUBLIC_SUPABASE_URL)
    if (!path) return NextResponse.json({ removed: false, reason: 'not_managed' })

    let service: ReturnType<typeof createServiceClient>
    try {
      service = createServiceClient()
    } catch (err) {
      console.error('Listing image delete: service client unavailable:', err instanceof Error ? err.message : err)
      return apiError('Service temporarily unavailable.', 503)
    }

    const limit = await checkRateLimits(service, [
      { key: `listing-image-del:user:${auth.userId}`, max: 120, windowSeconds: 3600 },
    ])
    if (limit.status !== 'ok') return rateLimitResponse(limit)

    // Service role on purpose: the check must see EVERY listing, including ones in
    // other businesses that happen to point at this same URL.
    const { count, error: refError } = await service
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('image_url', url)
    if (refError) {
      console.error('Listing image delete: reference check failed:', refError.code)
      return NextResponse.json({ removed: false, reason: 'unverified' })
    }
    if ((count ?? 0) > 0) return NextResponse.json({ removed: false, reason: 'in_use' })

    const { error: removeError } = await service.storage.from(LISTING_IMAGE_BUCKET).remove([path])
    if (removeError) {
      console.error('Listing image delete: storage remove failed:', removeError.message)
      return apiError('Could not remove the old image file.', 500)
    }
    return NextResponse.json({ removed: true })
  } catch (err) {
    console.error('Listing image delete error:', err instanceof Error ? err.message : err)
    return apiError('Something went wrong.', 500)
  }
}
