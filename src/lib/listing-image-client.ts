// Browser side of Shop listing images. Talks only to our own /api/listing-images
// route (never to Storage directly) and turns every failure into a message a
// business owner can act on. Callers must treat { ok: false } as "nothing was
// uploaded" and must not save an image reference.

import { validateImageUpload } from '@/lib/listing-image'

export type UploadResult = { ok: true; url: string } | { ok: false; error: string }

// Same rules the server applies, run on the real first bytes so a renamed .php/.svg
// (or a .png that is really something else) is turned away before any upload.
// The server still re-checks everything; this is only for fast feedback.
export async function precheckImageFile(file: File): Promise<string | null> {
  let head: Uint8Array
  try {
    head = new Uint8Array(await file.slice(0, 32).arrayBuffer())
  } catch {
    return 'Could not read that file. Please choose a different image.'
  }
  const checked = validateImageUpload(file, head)
  return checked.ok ? null : checked.error
}

export async function uploadListingImage(file: File): Promise<UploadResult> {
  const body = new FormData()
  body.append('file', file)
  try {
    const res = await fetch('/api/listing-images', { method: 'POST', body })
    const json = (await res.json().catch(() => null)) as { url?: unknown; error?: unknown } | null
    if (!res.ok) {
      const message = typeof json?.error === 'string' && json.error
        ? json.error
        : res.status === 413
          ? 'That image is too large. The maximum size is 4 MB.'
          : 'Upload failed. Please try again.'
      return { ok: false, error: message }
    }
    if (!json || typeof json.url !== 'string' || !json.url) {
      return { ok: false, error: 'Upload failed. Please try again.' }
    }
    return { ok: true, url: json.url }
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' }
  }
}

// Best effort and silent: a leftover file is harmless, whereas failing a save the
// owner already completed because cleanup hiccuped would not be. The server only
// ever deletes the caller's own file and never one a listing still references.
export async function removeListingImageFile(url: string | null | undefined): Promise<void> {
  if (!url) return
  try {
    await fetch('/api/listing-images', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
  } catch {
    // ignore
  }
}
