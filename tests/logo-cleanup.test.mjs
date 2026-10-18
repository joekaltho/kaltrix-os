// Logo cleanup on admin business delete: which files may be deleted, and the
// ordering/safety rules. See src/lib/logo-storage.ts and src/lib/admin-delete.ts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { logoObjectName } from '../src/lib/logo-storage.ts'
import { deleteBusinessAndLogo } from '../src/lib/admin-delete.ts'

const SB = 'https://abcd.supabase.co'
const OWNER = '3f2c9c1e-aaaa-4bbb-8ccc-1234567890ab'
const OTHER = '99999999-aaaa-4bbb-8ccc-1234567890ab'
const BIZ = '11111111-1111-1111-1111-111111111111'
const url = (name) => `${SB}/storage/v1/object/public/logos/${name}`
const OWN_FILE = `${OWNER}-1760000000000.jpg`

test('logoObjectName: the owner\'s own app-generated file is recognised', () => {
  assert.equal(logoObjectName(url(OWN_FILE), OWNER, SB), OWN_FILE)
  assert.equal(logoObjectName(url(`${OWNER}-1760000000000.PNG`), OWNER, SB), `${OWNER}-1760000000000.PNG`)
  assert.equal(logoObjectName(url(OWN_FILE), OWNER.toUpperCase(), SB), OWN_FILE, 'uuid case does not matter')
})

test('logoObjectName: SECURITY - anything that is not exactly the owner\'s own file returns null', () => {
  const bad = {
    'someone else\'s file': url(`${OTHER}-1760000000000.jpg`),
    'other host': `https://evil.example/storage/v1/object/public/logos/${OWN_FILE}`,
    'host lookalike': `https://abcd.supabase.co.evil.example/storage/v1/object/public/logos/${OWN_FILE}`,
    'other bucket': `${SB}/storage/v1/object/public/avatars/${OWN_FILE}`,
    'signed/private path': `${SB}/storage/v1/object/sign/logos/${OWN_FILE}`,
    'folder': url(`sub/${OWN_FILE}`),
    'encoded slash': url(`sub%2F${OWN_FILE}`),
    'traversal': url(`..%2F${OWN_FILE}`),
    'dotdot in name': url(`${OWNER}-1760000000000..jpg`),
    'query string': `${url(OWN_FILE)}?download=1`,
    'hash': `${url(OWN_FILE)}#x`,
    'prefix only': url(`${OWNER}-`),
    'no extension': url(`${OWNER}-1760000000000`),
    'long extension': url(`${OWNER}-1760000000000.abcdefghijklm`),
    'non-numeric stamp': url(`${OWNER}-abc.jpg`),
    'not a url': 'not a url',
    'empty': '',
    'data url': 'data:image/png;base64,AAAA',
  }
  for (const [why, u] of Object.entries(bad)) assert.equal(logoObjectName(u, OWNER, SB), null, why)
  assert.equal(logoObjectName(null, OWNER, SB), null)
  assert.equal(logoObjectName(url(OWN_FILE), null, SB), null, 'no owner id')
  assert.equal(logoObjectName(url(OWN_FILE), OWNER, ''), null, 'no project url configured')
})

function deps(over = {}) {
  const calls = { removed: [], deleted: [], referenced: [] }
  const d = {
    logoNameFor: (u, owner) => logoObjectName(u, owner, SB),
    readBusiness: async () => ({ user_id: OWNER, logo_url: url(OWN_FILE) }),
    callDelete: async (id) => { calls.deleted.push(id); return { data: { id, business_name: 'Alpha' }, error: null } },
    logoStillReferenced: async (u) => { calls.referenced.push(u); return false },
    removeLogo: async (name) => { calls.removed.push(name); return { removed: true, error: null } },
    ...over,
  }
  return { d, calls }
}

test('success: deletes the business, then removes the owner\'s logo file', async () => {
  const { d, calls } = deps()
  assert.deepEqual(await deleteBusinessAndLogo(BIZ, d), { ok: true, id: BIZ, business_name: 'Alpha', logo: 'removed' })
  assert.deepEqual(calls.removed, [OWN_FILE])
})

test('REGRESSION: a refused delete (non-admin) never touches storage', async () => {
  const { d, calls } = deps({ callDelete: async () => ({ data: null, error: { message: 'forbidden', code: '42501' } }) })
  assert.deepEqual(await deleteBusinessAndLogo(BIZ, d), { ok: false, status: 403, message: 'Admins only' })
  assert.deepEqual(calls.removed, [], 'logo must not be removed when the delete was refused')
  assert.deepEqual(calls.referenced, [])
})

test('REGRESSION: a failed delete (any error, or no confirmation) never touches storage', async () => {
  for (const callDelete of [
    async () => ({ data: null, error: { message: 'boom', code: 'XX000' } }),
    async () => ({ data: null, error: null }),
    async () => ({ data: { id: 'someone-else' }, error: null }),
    async () => ({ data: [], error: null }),
    async () => { throw new Error('network') },
  ]) {
    const { d, calls } = deps({ callDelete })
    const r = await deleteBusinessAndLogo(BIZ, d)
    assert.equal(r.ok, false)
    assert.deepEqual(calls.removed, [])
  }
})

test('error mapping: not found -> 404, unknown DB errors are generic, a missing migration is surfaced', async () => {
  let r = await deleteBusinessAndLogo(BIZ, deps({ callDelete: async () => ({ data: null, error: { message: 'business not found', code: 'P0002' } }) }).d)
  assert.deepEqual(r, { ok: false, status: 404, message: 'business not found' })
  r = await deleteBusinessAndLogo(BIZ, deps({ callDelete: async () => ({ data: null, error: { message: 'relation "secret_table" does not exist', code: '42P01' } }) }).d)
  assert.deepEqual(r, { ok: false, status: 500, message: 'Database error' })
  r = await deleteBusinessAndLogo(BIZ, deps({ callDelete: async () => ({ data: null, error: { message: 'Could not find the function public.admin_delete_business(p_business_id) in the schema cache' } }) }).d)
  assert.equal(r.status, 500); assert.match(r.message, /Could not find the function/)
})

test('SECURITY: a logo_url pointing at someone else\'s file is skipped, not deleted', async () => {
  const { d, calls } = deps({ readBusiness: async () => ({ user_id: OWNER, logo_url: url(`${OTHER}-1760000000000.jpg`) }) })
  assert.equal((await deleteBusinessAndLogo(BIZ, d)).logo, 'skipped')
  assert.deepEqual(calls.removed, [])
})

test('SECURITY: external / traversal logo urls are skipped', async () => {
  for (const logo_url of ['https://evil.example/x.jpg', url('../../etc/passwd'), url(`sub/${OWN_FILE}`)]) {
    const { d, calls } = deps({ readBusiness: async () => ({ user_id: OWNER, logo_url }) })
    assert.equal((await deleteBusinessAndLogo(BIZ, d)).logo, 'skipped')
    assert.deepEqual(calls.removed, [])
  }
})

test('a logo still used by another business is kept; a failed reference check keeps it too', async () => {
  let d = deps({ logoStillReferenced: async () => true }).d
  assert.equal((await deleteBusinessAndLogo(BIZ, d)).logo, 'skipped')
  const { d: d2, calls } = deps({ logoStillReferenced: async () => { throw new Error('db down') } })
  assert.equal((await deleteBusinessAndLogo(BIZ, d2)).logo, 'skipped')
  assert.deepEqual(calls.removed, [])
})

test('no logo -> nothing to do; business unreadable -> delete still succeeds, logo left alone', async () => {
  assert.equal((await deleteBusinessAndLogo(BIZ, deps({ readBusiness: async () => ({ user_id: OWNER, logo_url: null }) }).d)).logo, 'none')
  assert.equal((await deleteBusinessAndLogo(BIZ, deps({ readBusiness: async () => ({ user_id: OWNER, logo_url: '' }) }).d)).logo, 'none')
  const { d, calls } = deps({ readBusiness: async () => { throw new Error('read failed') } })
  const r = await deleteBusinessAndLogo(BIZ, d)
  assert.equal(r.ok, true); assert.equal(r.logo, 'none'); assert.deepEqual(calls.removed, [])
})

test('storage trouble never hides a successful delete: it is reported as failed / none', async () => {
  let r = await deleteBusinessAndLogo(BIZ, deps({ removeLogo: async () => ({ removed: false, error: 'storage down' }) }).d)
  assert.equal(r.ok, true); assert.equal(r.logo, 'failed')
  r = await deleteBusinessAndLogo(BIZ, deps({ removeLogo: async () => { throw new Error('boom') } }).d)
  assert.equal(r.ok, true); assert.equal(r.logo, 'failed')
  r = await deleteBusinessAndLogo(BIZ, deps({ removeLogo: async () => ({ removed: false, error: null }) }).d)
  assert.equal(r.ok, true); assert.equal(r.logo, 'none', 'file was already gone')
})
