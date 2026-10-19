// Shop listing images: what may be uploaded, and which stored files we may touch.
//
// Pure functions only (no React, no Supabase, no `@/` imports) so the SAME rules run
// in the browser (fast feedback) and in /api/listing-images (the part that counts),
// and so they can be unit-tested with plain `node --test`.
//
// The browser is never trusted: the server re-runs validateImageUpload() on the real
// bytes, and the stored object's name and Content-Type come from what the bytes
// actually are, never from the client's filename or MIME type.

export const LISTING_IMAGE_BUCKET = 'listing-images'

// 4 MB, deliberately under Vercel's 4.5 MB request-body ceiling for serverless
// functions (multipart framing adds overhead) so an oversized file gets our clear
// message instead of an opaque platform 413. The bucket enforces the same cap.
export const LISTING_IMAGE_MAX_BYTES = 4 * 1024 * 1024
export const LISTING_IMAGE_MAX_LABEL = '4 MB'

export const LISTING_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'
export const LISTING_IMAGE_TYPES_LABEL = 'JPG, PNG or WebP'

export type ImageKind = 'jpeg' | 'png' | 'webp'

const MIME_TO_KIND: Record<string, ImageKind> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const EXT_TO_KIND: Record<string, ImageKind> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
}
const KIND_INFO: Record<ImageKind, { ext: 'jpg' | 'png' | 'webp'; contentType: string }> = {
  jpeg: { ext: 'jpg', contentType: 'image/jpeg' },
  png: { ext: 'png', contentType: 'image/png' },
  webp: { ext: 'webp', contentType: 'image/webp' },
}

// Extensions that must never ride along anywhere in a filename ("shell.php.png").
// The allow-list above already rejects them as the final extension; this also
// rejects them as an inner extension, which is the classic double-extension trick.
const BLOCKED_SEGMENTS = new Set([
  'php', 'php3', 'php4', 'php5', 'phtml', 'phar', 'py', 'pyc', 'rb', 'pl', 'cgi',
  'svg', 'svgz', 'html', 'htm', 'xhtml', 'xml', 'js', 'mjs', 'jsp', 'asp', 'aspx',
  'exe', 'dll', 'bat', 'cmd', 'com', 'scr', 'msi', 'sh', 'jar', 'apk', 'app', 'gif',
])

export type ImageCheck =
  | { ok: true }
  | { ok: false; status: 400 | 413 | 415; error: string }

const TYPE_ERROR = `Only ${LISTING_IMAGE_TYPES_LABEL} images are allowed.`

function extensionParts(name: string): string[] {
  const base = name.split(/[\\/]/).pop() ?? ''
  return base.toLowerCase().split('.').slice(1)
}

// Cheap checks that need no file bytes: filename extension, declared MIME type, size.
export function validateImageMeta(file: { name: string; type: string; size: number }): ImageCheck {
  if (!file || typeof file.name !== 'string' || !file.name) {
    return { ok: false, status: 400, error: 'Choose an image to upload.' }
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, status: 400, error: 'That file is empty.' }
  }
  if (file.size > LISTING_IMAGE_MAX_BYTES) {
    return { ok: false, status: 413, error: `That image is too large. The maximum size is ${LISTING_IMAGE_MAX_LABEL}.` }
  }
  const parts = extensionParts(file.name)
  if (parts.length === 0 || parts.some((p) => BLOCKED_SEGMENTS.has(p))) {
    return { ok: false, status: 415, error: TYPE_ERROR }
  }
  if (!(parts[parts.length - 1] in EXT_TO_KIND)) {
    return { ok: false, status: 415, error: TYPE_ERROR }
  }
  if (!(String(file.type).toLowerCase() in MIME_TO_KIND)) {
    return { ok: false, status: 415, error: TYPE_ERROR }
  }
  return { ok: true }
}

function ascii(bytes: Uint8Array, start: number, text: string): boolean {
  if (bytes.length < start + text.length) return false
  for (let i = 0; i < text.length; i++) {
    if (bytes[start + i] !== text.charCodeAt(i)) return false
  }
  return true
}

// What the bytes ARE, from their signature. Only the first ~30 bytes are read, so
// the browser can pass just the head of a file; `totalLength` is then the real file
// size (used only to catch a WebP whose RIFF header claims more bytes than exist).
export function sniffImageKind(bytes: Uint8Array, totalLength: number = bytes.length): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'

  // PNG: 8-byte signature, then the mandatory IHDR chunk.
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length >= 16 && PNG.every((b, i) => bytes[i] === b) && ascii(bytes, 12, 'IHDR')) return 'png'

  // WebP: RIFF container, "WEBP" form type, a known first chunk, and a declared
  // RIFF length that does not claim more bytes than the file actually has.
  if (bytes.length >= 16 && ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) {
    const first = ascii(bytes, 12, 'VP8 ') || ascii(bytes, 12, 'VP8L') || ascii(bytes, 12, 'VP8X')
    const declared = (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) >>> 0
    if (first && declared + 8 <= totalLength) return 'webp'
  }
  return null
}

export type ImageValidation =
  | { ok: true; kind: ImageKind; ext: 'jpg' | 'png' | 'webp'; contentType: string }
  | { ok: false; status: 400 | 413 | 415; error: string }

// The full check. Extension, declared MIME type AND real content must all agree on
// one of the three allowed formats. `bytes` is the actual file content (the browser
// passes just the first few bytes, the server the whole file); `file.size` must be
// the real total size in both cases.
export function validateImageUpload(
  file: { name: string; type: string; size: number },
  bytes: Uint8Array
): ImageValidation {
  const meta = validateImageMeta(file)
  if (!meta.ok) return meta

  const kind = sniffImageKind(bytes, file.size)
  if (!kind) {
    return { ok: false, status: 415, error: `That file is not a valid ${LISTING_IMAGE_TYPES_LABEL} image.` }
  }
  const parts = extensionParts(file.name)
  const extKind = EXT_TO_KIND[parts[parts.length - 1]]
  const mimeKind = MIME_TO_KIND[String(file.type).toLowerCase()]
  if (extKind !== kind || mimeKind !== kind) {
    return { ok: false, status: 415, error: 'The file contents do not match its file type. Export it again as JPG, PNG or WebP.' }
  }
  return { ok: true, kind, ...KIND_INFO[kind] }
}

// --- Stored-object naming and delete-safety -------------------------------------
//
// Objects live at  <owner user id>/<business id>/<random uuid>.<jpg|png|webp>
// in the public `listing-images` bucket. The server writes them with the service
// role after authenticating the caller; Storage has NO insert/update/delete policy
// for browsers at all.

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const OBJECT_PATH = new RegExp(`^(${UUID})/(${UUID})/(${UUID})\\.(jpg|png|webp)$`, 'i')
const PUBLIC_PATH = `/storage/v1/object/public/${LISTING_IMAGE_BUCKET}/`

export function listingImageObjectPath(ownerUserId: string, businessId: string, fileId: string, ext: string): string {
  return `${ownerUserId.toLowerCase()}/${businessId.toLowerCase()}/${fileId.toLowerCase()}.${ext}`
}

// logo_url-style rule: image_url is a free-text column the owner can write, so it
// must never be trusted as a delete target on its own. Returns the object path if
// and only if the URL is one of THIS caller's own uploaded files on THIS project's
// storage origin; anything else (an external URL, someone else's file, a folder,
// a traversal, a signed URL...) returns null = "not ours, leave it alone".
export function listingImageObjectPathFromUrl(
  imageUrl: string | null | undefined,
  ownerUserId: string | null | undefined,
  businessId: string | null | undefined,
  supabaseUrl: string | null | undefined
): string | null {
  if (!imageUrl || !ownerUserId || !businessId || !supabaseUrl) return null
  let url: URL
  let base: URL
  try {
    url = new URL(imageUrl)
    base = new URL(supabaseUrl)
  } catch {
    return null
  }
  if (url.origin !== base.origin || url.search || url.hash) return null
  if (!url.pathname.startsWith(PUBLIC_PATH)) return null

  let path: string
  try {
    path = decodeURIComponent(url.pathname.slice(PUBLIC_PATH.length))
  } catch {
    return null
  }
  const m = OBJECT_PATH.exec(path)
  if (!m) return null
  if (m[1].toLowerCase() !== ownerUserId.toLowerCase()) return null
  if (m[2].toLowerCase() !== businessId.toLowerCase()) return null
  return path
}
