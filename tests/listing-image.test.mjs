// Shop listing images: upload validation, delete-safety rules, cleanup ordering,
// and a guard that the uploaded image is only ever rendered where intended.
// See src/lib/listing-image.ts, src/lib/listing-image-cleanup.ts and
// src/app/api/listing-images/route.ts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  LISTING_IMAGE_MAX_BYTES,
  listingImageObjectPath,
  listingImageObjectPathFromUrl,
  sniffImageKind,
  validateImageMeta,
  validateImageUpload,
} from '../src/lib/listing-image.ts'
import { cleanUpBusinessListingImages } from '../src/lib/listing-image-cleanup.ts'

const bytes = (...b) => new Uint8Array(b)
const ascii = (s) => [...s].map((c) => c.charCodeAt(0))
const pad = (arr, n = 64) => { const out = new Uint8Array(Math.max(n, arr.length)); out.set(arr); return out }

const JPEG = pad([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, ...ascii('JFIF')])
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...ascii('IHDR')])
const webp = (total = 64, chunk = 'VP8 ') => {
  const b = new Uint8Array(total)
  b.set(ascii('RIFF'), 0)
  const size = total - 8
  b[4] = size & 255; b[5] = (size >> 8) & 255; b[6] = (size >> 16) & 255; b[7] = (size >> 24) & 255
  b.set(ascii('WEBP'), 8)
  b.set(ascii(chunk), 12)
  return b
}
const WEBP = webp()
const GIF = pad([...ascii('GIF89a'), 1, 0, 1, 0])
const PHP = new TextEncoder().encode('<?php system($_GET["c"]); ?>')
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
const HTML = new TextEncoder().encode('<!doctype html><script>alert(1)</script>')
const EXE = pad([0x4d, 0x5a, 0x90, 0x00])

const file = (name, type, content) => ({ name, type, size: content.length })
const check = (name, type, content) => validateImageUpload(file(name, type, content), content)

// --- accepted -------------------------------------------------------------------

test('accepts real JPEG, PNG and WebP files and derives the stored type from the bytes', () => {
  assert.deepEqual(check('shoe.jpg', 'image/jpeg', JPEG), { ok: true, kind: 'jpeg', ext: 'jpg', contentType: 'image/jpeg' })
  assert.deepEqual(check('shoe.jpeg', 'image/jpeg', JPEG), { ok: true, kind: 'jpeg', ext: 'jpg', contentType: 'image/jpeg' })
  assert.deepEqual(check('bag.png', 'image/png', PNG), { ok: true, kind: 'png', ext: 'png', contentType: 'image/png' })
  assert.deepEqual(check('cap.webp', 'image/webp', WEBP), { ok: true, kind: 'webp', ext: 'webp', contentType: 'image/webp' })
  assert.deepEqual(check('WHATSAPP IMAGE 2026.JPG', 'IMAGE/JPEG', JPEG).ok, true, 'case does not matter')
  assert.equal(check('a.b.c.photo.png', 'image/png', PNG).ok, true, 'dots in a normal name are fine')
})

test('the browser can pre-check with just the first bytes of a WebP', () => {
  const full = webp(5000)
  const head = full.slice(0, 32)
  assert.equal(validateImageUpload({ name: 'a.webp', type: 'image/webp', size: 5000 }, head).ok, true)
})

// --- rejected: the formats the task names explicitly -----------------------------

test('SECURITY - PHP, Python, SVG, HTML, executables and GIF are rejected by type', () => {
  const cases = [
    ['shell.php', 'application/x-php', PHP],
    ['shell.php', 'image/jpeg', JPEG], // real JPEG bytes, but a .php name
    ['tool.py', 'text/x-python', new TextEncoder().encode('import os')],
    ['logo.svg', 'image/svg+xml', SVG],
    ['logo.svg', 'image/png', PNG], // claims PNG, named .svg
    ['page.html', 'text/html', HTML],
    ['page.htm', 'text/html', HTML],
    ['setup.exe', 'application/octet-stream', EXE],
    ['setup.exe', 'image/png', PNG],
    ['anim.gif', 'image/gif', GIF],
    ['noextension', 'image/png', PNG],
    ['', 'image/png', PNG],
  ]
  for (const [name, type, content] of cases) {
    const r = check(name, type, content)
    assert.equal(r.ok, false, `${name} (${type}) must be rejected`)
    assert.ok(r.error.length > 0)
  }
})

test('SECURITY - double extensions and blocked inner extensions are rejected', () => {
  for (const name of ['shell.php.jpg', 'shell.php.png', 'x.html.webp', 'x.svg.png', 'x.exe.jpg', 'x.py.jpeg', 'x.phtml.png']) {
    assert.equal(check(name, name.endsWith('webp') ? 'image/webp' : 'image/png', PNG).ok, false, name)
  }
})

test('SECURITY - a PHP/HTML/SVG payload dressed up with an image name and MIME type is rejected by its CONTENT', () => {
  for (const payload of [PHP, SVG, HTML, EXE, GIF]) {
    for (const [name, type] of [['a.jpg', 'image/jpeg'], ['a.png', 'image/png'], ['a.webp', 'image/webp']]) {
      const r = check(name, type, payload)
      assert.equal(r.ok, false, `${name} with non-image bytes must be rejected`)
      assert.equal(r.status, 415)
    }
  }
})

test('SECURITY - extension, declared MIME type and real content must all agree', () => {
  assert.equal(check('a.png', 'image/png', JPEG).ok, false, 'png name + jpeg bytes')
  assert.equal(check('a.jpg', 'image/jpeg', PNG).ok, false, 'jpg name + png bytes')
  assert.equal(check('a.jpg', 'image/png', JPEG).ok, false, 'MIME disagrees with the bytes')
  assert.equal(check('a.webp', 'image/jpeg', WEBP).ok, false)
  assert.equal(check('a.jpg', 'image/svg+xml', JPEG).ok, false)
  assert.equal(check('a.jpg', '', JPEG).ok, false, 'a missing MIME type is not accepted')
})

test('truncated or malformed images are not accepted just for starting correctly', () => {
  assert.equal(sniffImageKind(bytes(0xff, 0xd8)), null)
  assert.equal(sniffImageKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), null, 'PNG signature with no IHDR')
  assert.equal(sniffImageKind(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...ascii('XXXX')])), null)
  assert.equal(sniffImageKind(webp(64, 'JUNK')), null, 'RIFF/WEBP with an unknown first chunk')
  const lying = webp(64); lying[4] = 0xff; lying[5] = 0xff; lying[6] = 0xff
  assert.equal(sniffImageKind(lying), null, 'RIFF length claims more bytes than the file has')
  assert.equal(sniffImageKind(new Uint8Array(0)), null)
  assert.equal(sniffImageKind(PHP), null)
})

test('size limits: empty and oversized files are rejected before anything is read or uploaded', () => {
  assert.equal(validateImageMeta({ name: 'a.png', type: 'image/png', size: 0 }).ok, false)
  const big = validateImageMeta({ name: 'a.png', type: 'image/png', size: LISTING_IMAGE_MAX_BYTES + 1 })
  assert.equal(big.ok, false); assert.equal(big.status, 413)
  assert.equal(validateImageMeta({ name: 'a.png', type: 'image/png', size: LISTING_IMAGE_MAX_BYTES }).ok, true)
  assert.equal(validateImageMeta({ name: 'a.png', type: 'image/png', size: Number.NaN }).ok, false)
})

// --- delete safety ---------------------------------------------------------------

const SB = 'https://abcd.supabase.co'
const OWNER = '3f2c9c1e-aaaa-4bbb-8ccc-1234567890ab'
const OTHER = '99999999-aaaa-4bbb-8ccc-1234567890ab'
const BIZ = '11111111-1111-4111-8111-111111111111'
const OTHER_BIZ = '22222222-2222-4222-8222-222222222222'
const FID = '5b1e7a52-0000-4000-8000-0123456789ab'
const url = (path) => `${SB}/storage/v1/object/public/listing-images/${path}`
const OWN = `${OWNER}/${BIZ}/${FID}.jpg`

test('listingImageObjectPath builds the owner/business/uuid name the server uses', () => {
  assert.equal(listingImageObjectPath(OWNER.toUpperCase(), BIZ, FID, 'webp'), `${OWNER}/${BIZ}/${FID}.webp`)
})

test('delete target: the caller\'s own uploaded file is recognised', () => {
  assert.equal(listingImageObjectPathFromUrl(url(OWN), OWNER, BIZ, SB), OWN)
  assert.equal(listingImageObjectPathFromUrl(url(`${OWNER}/${BIZ}/${FID}.png`), OWNER.toUpperCase(), BIZ, SB), `${OWNER}/${BIZ}/${FID}.png`)
})

test('SECURITY - delete target: anything that is not exactly the caller\'s own file returns null', () => {
  const bad = {
    'someone else\'s file': url(`${OTHER}/${BIZ}/${FID}.jpg`),
    'another business of the same owner': url(`${OWNER}/${OTHER_BIZ}/${FID}.jpg`),
    'other host': `https://evil.example/storage/v1/object/public/listing-images/${OWN}`,
    'host lookalike': `https://abcd.supabase.co.evil.example/storage/v1/object/public/listing-images/${OWN}`,
    'logos bucket': `${SB}/storage/v1/object/public/logos/${OWN}`,
    'signed path': `${SB}/storage/v1/object/sign/listing-images/${OWN}`,
    'extra folder': url(`x/${OWN}`),
    'encoded traversal': url(`${OWNER}/${BIZ}/..%2F${FID}.jpg`),
    'dotdot': url(`${OWNER}/${BIZ}/../${FID}.jpg`),
    'query string': `${url(OWN)}?download=1`,
    'hash': `${url(OWN)}#x`,
    'folder only': url(`${OWNER}/${BIZ}/`),
    'not a uuid file name': url(`${OWNER}/${BIZ}/photo.jpg`),
    'disallowed extension': url(`${OWNER}/${BIZ}/${FID}.svg`),
    'php extension': url(`${OWNER}/${BIZ}/${FID}.php`),
    'not a url': 'not a url',
    'data url': 'data:image/png;base64,AAAA',
    'empty': '',
  }
  for (const [label, u] of Object.entries(bad)) {
    assert.equal(listingImageObjectPathFromUrl(u, OWNER, BIZ, SB), null, label)
  }
  assert.equal(listingImageObjectPathFromUrl(url(OWN), null, BIZ, SB), null)
  assert.equal(listingImageObjectPathFromUrl(url(OWN), OWNER, null, SB), null)
  assert.equal(listingImageObjectPathFromUrl(url(OWN), OWNER, BIZ, undefined), null)
  assert.equal(listingImageObjectPathFromUrl(null, OWNER, BIZ, SB), null)
  assert.equal(listingImageObjectPathFromUrl('https://example.com/photo.jpg', OWNER, BIZ, SB), null, 'old pasted external URLs are never "ours"')
})

// --- cleanup when an admin deletes a business ------------------------------------

function fakeDeps(over = {}) {
  const calls = { listed: [], removed: [], referencedQueries: [] }
  const deps = {
    listFiles: async (folder) => { calls.listed.push(folder); return over.files ?? [] },
    publicUrlFor: (p) => url(p),
    referencedUrls: async (urls) => { calls.referencedQueries.push(urls); if (over.refErr) throw new Error('x'); return over.referenced ?? [] },
    removeFiles: async (paths) => { calls.removed.push(paths); return { error: over.removeErr ?? null } },
  }
  return { deps, calls }
}
const F1 = `${FID}.jpg`
const F2 = '6c2f8b63-1111-4111-8111-0123456789ab.png'

test('cleanup removes every file in the deleted business\'s own folder', async () => {
  const { deps, calls } = fakeDeps({ files: [F1, F2] })
  assert.equal(await cleanUpBusinessListingImages(OWNER, BIZ, deps), 'removed')
  assert.deepEqual(calls.listed, [`${OWNER}/${BIZ}`])
  assert.deepEqual(calls.removed, [[`${OWNER}/${BIZ}/${F1}`, `${OWNER}/${BIZ}/${F2}`]])
})

test('cleanup SAFETY - a file some remaining listing still references is kept', async () => {
  const { deps, calls } = fakeDeps({ files: [F1, F2], referenced: [url(`${OWNER}/${BIZ}/${F1}`)] })
  assert.equal(await cleanUpBusinessListingImages(OWNER, BIZ, deps), 'skipped')
  assert.deepEqual(calls.removed, [[`${OWNER}/${BIZ}/${F2}`]])
  const all = fakeDeps({ files: [F1], referenced: [url(`${OWNER}/${BIZ}/${F1}`)] })
  assert.equal(await cleanUpBusinessListingImages(OWNER, BIZ, all.deps), 'skipped')
  assert.deepEqual(all.calls.removed, [])
})

test('cleanup SAFETY - only uuid-named image files are touched; junk entries are ignored', async () => {
  const { deps, calls } = fakeDeps({ files: ['.emptyFolderPlaceholder', 'notes.txt', '../x.jpg', 'a.php', F1] })
  assert.equal(await cleanUpBusinessListingImages(OWNER, BIZ, deps), 'removed')
  assert.deepEqual(calls.removed, [[`${OWNER}/${BIZ}/${F1}`]])
})

test('cleanup SAFETY - bad ids never reach storage; failures are reported, not thrown', async () => {
  for (const [o, b] of [[null, BIZ], ['', BIZ], ['../..', BIZ], [OWNER, 'nope'], [OWNER, '*']]) {
    const { deps, calls } = fakeDeps({ files: [F1] })
    assert.equal(await cleanUpBusinessListingImages(o, b, deps), 'skipped')
    assert.deepEqual(calls.listed, [])
    assert.deepEqual(calls.removed, [])
  }
  assert.equal(await cleanUpBusinessListingImages(OWNER, BIZ, fakeDeps({ files: [] }).deps), 'none')
  assert.equal(await cleanUpBusinessListingImages(OWNER, BIZ, fakeDeps({ files: [F1], removeErr: 'boom' }).deps), 'failed')
  const unverifiable = fakeDeps({ files: [F1], refErr: true })
  assert.equal(await cleanUpBusinessListingImages(OWNER, BIZ, unverifiable.deps), 'failed')
  assert.deepEqual(unverifiable.calls.removed, [], 'cannot prove it is unshared -> nothing is deleted')
  const throwing = { ...fakeDeps().deps, listFiles: async () => { throw new Error('storage down') } }
  assert.equal(await cleanUpBusinessListingImages(OWNER, BIZ, throwing), 'failed')
})

// --- display scope ---------------------------------------------------------------

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

test('display scope: only the known files touch listing images, and only the Shop tab renders them publicly', () => {
  const rel = (p) => p.split('\\').join('/')
  const touching = walk('src').filter((p) => /\.(tsx?|mjs)$/.test(p) && /image_url/.test(readFileSync(p, 'utf8'))).map(rel).sort()
  assert.deepEqual(touching, [
    'src/app/(dashboard)/dashboard/listings/new/page.tsx',
    'src/app/(public)/business/[slug]/page.tsx',
    'src/app/api/admin/businesses/[id]/route.ts',
    'src/app/api/listing-images/route.ts', // server: reference check only, renders nothing
    'src/components/ListingsPanel.tsx',
    'src/lib/listing-image.ts', // pure helpers (mentioned in a comment), renders nothing
    'src/types/index.ts',
  ].sort(), 'a new file reading image_url would be a new place the image can appear -- review it against the Shop-only rule')

  const publicPage = readFileSync('src/app/(public)/business/[slug]/page.tsx', 'utf8')
  assert.equal((publicPage.match(/listing\.image_url/g) ?? []).length, 2, 'public profile renders listing.image_url exactly once (guard + src)')
  const shopStart = publicPage.indexOf("activeTab === 'shop'")
  const shopEnd = publicPage.indexOf("activeTab === 'about'")
  const at = publicPage.indexOf('listing.image_url')
  assert.ok(shopStart > 0 && shopEnd > shopStart && at > shopStart && at < shopEnd, 'and that render is inside the Shop tab block')

  for (const p of ['src/app/(public)/discover/page.tsx', 'src/components/dashboard/OverviewPanel.tsx', 'src/components/dashboard/Sidebar.tsx', 'src/app/invoice/[id]/page.tsx']) {
    assert.ok(!/image_url|ListingImageField/.test(readFileSync(p, 'utf8')), `${p} must not show listing images`)
  }
})

test('the URL-only workflow is gone from the listing forms', () => {
  for (const p of ['src/components/ListingsPanel.tsx', 'src/app/(dashboard)/dashboard/listings/new/page.tsx']) {
    const src = readFileSync(p, 'utf8')
    assert.ok(!/name="image_url"/.test(src), `${p} must not ask for an image URL`)
    assert.ok(!/Image URL/.test(src))
    assert.ok(/ListingImageField/.test(src))
  }
})
