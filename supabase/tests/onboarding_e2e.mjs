// End-to-end check of the REAL client paths for the onboarding work:
// supabase-js -> PostgREST -> Postgres (RLS, grants, SECURITY DEFINER
// functions, JWT subjects, error shapes), plus the real deliverWelcomeEmail()
// against a real database with a fake email sender.
//
// Scratch databases only. Needs: Postgres with onboarding_harness.sql + the
// three Oct 15 2026 migrations applied, and PostgREST running against it
// (see supabase/tests/README.md). Env: PGHOST PGPORT PGDATABASE (psql),
// POSTGREST_URL (default http://127.0.0.1:3011), JWT_SECRET.
import { createHmac, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { deliverWelcomeEmail } from '../../src/lib/welcome-delivery.ts'
import { buildWelcomeEmail } from '../../src/lib/welcome-email.ts'
import { NOTIFICATION_COLUMNS, safeHref } from '../../src/lib/notifications.ts'
import { adminDeleteBusiness, adminSetBusinessVerified } from '../../src/lib/admin-actions.ts'
import { deleteBusinessAndLogo } from '../../src/lib/admin-delete.ts'
import { logoObjectName } from '../../src/lib/logo-storage.ts'

const URL_ = process.env.POSTGREST_URL ?? 'http://127.0.0.1:3011'
const SECRET = process.env.JWT_SECRET
if (!SECRET) throw new Error('Set JWT_SECRET to the jwt-secret your scratch PostgREST was started with')

const A = 'a0000000-0000-0000-0000-00000000000a'
const B = 'b0000000-0000-0000-0000-00000000000b'
const ADMIN = 'ad000000-0000-0000-0000-0000000000ad'

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (claims) => {
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims })
  return `${head}.${body}.${createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`
}
// supabase-js appends /rest/v1; PostgREST serves from /. Strip it.
const rewrite = (u, init) => fetch(String(u).replace('/rest/v1', ''), init)
const client = (claims) =>
  createClient(URL_, 'unused-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: rewrite, headers: { Authorization: `Bearer ${jwt(claims)}` } },
  })
const sql = (q) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim()

const owner = (id) => client({ sub: id, role: 'authenticated' })
const asA = owner(A)
const asB = owner(B)
const asAdmin = owner(ADMIN)
const anon = client({ role: 'anon' })
const service = client({ role: 'service_role' })

let passed = 0
const check = (name, fn) => fn().then(
  () => { passed++; console.log(`  ok  ${name}`) },
  (e) => { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1 },
)

// ---- fixtures ---------------------------------------------------------------
sql(`truncate public.businesses, public.profiles cascade;
     insert into public.profiles (id, role) values ('${A}', 'business'), ('${B}', 'business'), ('${ADMIN}', 'admin');`)

// Exactly the insert the create-business page performs (as the signed-in owner, through RLS).
const create = (c, uid, name, slug) =>
  c.from('businesses').insert({ user_id: uid, business_name: name, industry: 'food', city: 'Abuja', slug })
const bizId = (slug) => sql(`select id from public.businesses where slug = '${slug}'`)

console.log('Registration + welcome outbox')
await check('owner creates a business through RLS; one pending welcome row is queued', async () => {
  const { error } = await create(asA, A, 'Alpha Foods', 'alpha-foods-x1')
  assert.equal(error, null)
  assert.equal(sql(`select count(*) from public.email_deliveries where status='pending' and attempts=0`), '1')
})
await check('owners cannot read or write the outbox through the API', async () => {
  const r = await asA.from('email_deliveries').select('*')
  assert.ok(r.error, 'select must be denied'); assert.equal(r.error.code, '42501')
  const w = await asA.from('email_deliveries').update({ status: 'sent' }).eq('business_id', bizId('alpha-foods-x1')).select()
  assert.ok(w.error || (w.data ?? []).length === 0)
  const c = await asA.rpc('claim_email_delivery', { p_business_id: bizId('alpha-foods-x1'), p_kind: 'welcome' })
  assert.ok(c.error, 'owners must not be able to claim'); assert.equal(c.error.code, '42501')
})

const sendOk = (log) => async (p) => { log.push(p); await new Promise((r) => setTimeout(r, 80)); return { ok: true, id: 'em_test' } }
const deliver = (id, name, slug, send) =>
  deliverWelcomeEmail({ service, businessId: id, recipient: 'owner@example.com', email: buildWelcomeEmail({ businessName: name, slug }), send })

await check('six concurrent requests for one business send exactly one email', async () => {
  const id = bizId('alpha-foods-x1'); const log = []
  const outcomes = await Promise.all(Array.from({ length: 6 }, () => deliver(id, 'Alpha Foods', 'alpha-foods-x1', sendOk(log))))
  assert.equal(log.length, 1, `sender called ${log.length}x`)
  assert.equal(outcomes.filter((o) => o === 'sent').length, 1)
  assert.equal(outcomes.filter((o) => o === 'skipped').length, 5)
  assert.equal(log[0].idempotencyKey, `welcome-${id}`)
  assert.equal(sql(`select status||','||attempts||','||(provider_id is not null)||','||(sent_at is not null) from public.email_deliveries where business_id='${id}'`), 'sent,1,true,true')
})
await check('a later call (dashboard retry) after success sends nothing', async () => {
  const log = []
  assert.equal(await deliver(bizId('alpha-foods-x1'), 'Alpha Foods', 'alpha-foods-x1', sendOk(log)), 'skipped')
  assert.equal(log.length, 0)
})
await check('provider outage: marked failed, not retried immediately, retried after the delay, then sent', async () => {
  assert.equal((await create(asB, B, 'Beta Tailors', 'beta-tailors-x2')).error, null)
  const id = bizId('beta-tailors-x2'); const log = []
  const err = console.error; console.error = () => {}
  try {
    assert.equal(await deliver(id, 'Beta Tailors', 'beta-tailors-x2', async (p) => { log.push(p); return { ok: false, error: 'resend_500' } }), 'failed')
    assert.equal(sql(`select status||','||attempts||','||last_error from public.email_deliveries where business_id='${id}'`), 'failed,1,resend_500')
    assert.equal(await deliver(id, 'Beta Tailors', 'beta-tailors-x2', sendOk(log)), 'skipped', 'backoff: no immediate retry')
  } finally { console.error = err }
  sql(`update public.email_deliveries set updated_at = now() - interval '5 minutes' where business_id='${id}'`)
  assert.equal(await deliver(id, 'Beta Tailors', 'beta-tailors-x2', sendOk(log)), 'sent')
  assert.equal(sql(`select status||','||attempts||','||coalesce(last_error,'none') from public.email_deliveries where business_id='${id}'`), 'sent,2,none')
  assert.equal(log.length, 2)
})
await check('no API key configured: attempt is given back; email goes out once configured', async () => {
  const id = randomUUID()
  sql(`insert into public.businesses (id, user_id, business_name, slug) values ('${id}', '${randomUUID()}', 'Gamma', 'gamma-x3')`)
  assert.equal(await deliver(id, 'Gamma', 'gamma-x3', async () => ({ ok: false, notConfigured: true })), 'not_configured')
  assert.equal(sql(`select status||','||attempts from public.email_deliveries where business_id='${id}'`), 'pending,0')
  assert.equal(await deliver(id, 'Gamma', 'gamma-x3', sendOk([])), 'sent')
})
await check('retry answered "key already used with a different payload" is recorded as sent (first attempt was accepted), not failed', async () => {
  const id = randomUUID()
  sql(`insert into public.businesses (id, user_id, business_name, slug) values ('${id}', '${randomUUID()}', 'Zeta', 'zeta-x6')`)
  const err = console.error; console.error = () => {}
  try {
    // Attempt 1: Resend accepted it but our response was lost -> we record a failure.
    assert.equal(await deliver(id, 'Zeta', 'zeta-x6', async () => ({ ok: false, error: 'resend_network_error' })), 'failed')
    sql(`update public.email_deliveries set updated_at = now() - interval '5 minutes' where business_id='${id}'`)
    // Attempt 2: the owner renamed the business, so the rebuilt payload differs -> 409.
    const out = await deliver(id, 'Zeta Renamed', 'zeta-x6', async () => ({ ok: false, error: 'resend_409_invalid_idempotent_request', alreadyAccepted: true }))
    assert.equal(out, 'sent')
  } finally { console.error = err }
  assert.equal(sql(`select status||','||attempts||','||last_error from public.email_deliveries where business_id='${id}'`), 'sent,2,idempotent_replay')
  const log = []
  assert.equal(await deliver(id, 'Zeta Renamed', 'zeta-x6', sendOk(log)), 'skipped')
  assert.equal(log.length, 0, 'nothing further is ever sent')
})
await check('a business that pre-dates the feature (no outbox row) is never emailed', async () => {
  const id = randomUUID()
  sql(`insert into public.businesses (id, user_id, business_name, slug) values ('${id}', '${randomUUID()}', 'Old', 'old-x4');
       delete from public.email_deliveries where business_id='${id}';`)
  const log = []
  assert.equal(await deliver(id, 'Old', 'old-x4', sendOk(log)), 'skipped')
  assert.equal(log.length, 0)
})

console.log('Verification badge')
const PUBLIC_COLUMNS = 'id, business_name, industry, city, phone, email, website_url, address, description, logo_url, trust_score, is_verified, slug'
const publicProfile = (slug) => anon.from('businesses').select(PUBLIC_COLUMNS).eq('slug', slug).single()

await check('ROOT CAUSE reproduced: an admin\'s direct UPDATE silently changes nothing', async () => {
  const r = await asAdmin.from('businesses').update({ is_verified: true }).eq('id', bizId('alpha-foods-x1')).select('trust_score, trust_signals').single()
  assert.ok(r.error, 'the old handler got an error it ignored (PGRST116: 0 rows)')
  assert.equal(r.error.code, 'PGRST116')
  assert.equal((await publicProfile('alpha-foods-x1')).data.is_verified, false)
})
await check('owners cannot verify themselves via the RPC', async () => {
  const r = await asA.rpc('admin_set_business_verified', { p_business_id: bizId('alpha-foods-x1'), p_verified: true })
  assert.ok(r.error); assert.equal(r.error.code, '42501')
  assert.equal((await publicProfile('alpha-foods-x1')).data.is_verified, false)
})
await check('anonymous visitors cannot call the RPC', async () => {
  const r = await anon.rpc('admin_set_business_verified', { p_business_id: bizId('alpha-foods-x1'), p_verified: true })
  assert.ok(r.error)
})
await check('admin verifies: the RPC confirms it AND the public page query now returns is_verified=true', async () => {
  const r = await asAdmin.rpc('admin_set_business_verified', { p_business_id: bizId('alpha-foods-x1'), p_verified: true })
  assert.equal(r.error, null)
  assert.equal(r.data.is_verified, true)
  const pub = await publicProfile('alpha-foods-x1')
  assert.equal(pub.error, null)
  assert.equal(pub.data.is_verified, true, 'public profile data carries the verified flag the badge renders from')
  assert.equal(pub.data.trust_score, r.data.trust_score)
  assert.equal((await publicProfile('beta-tailors-x2')).data.is_verified, false, 'other businesses unaffected')
})
await check('admin removes verification: public flag follows', async () => {
  const r = await asAdmin.rpc('admin_set_business_verified', { p_business_id: bizId('alpha-foods-x1'), p_verified: false })
  assert.equal(r.data.is_verified, false)
  assert.equal((await publicProfile('alpha-foods-x1')).data.is_verified, false)
  await asAdmin.rpc('admin_set_business_verified', { p_business_id: bizId('alpha-foods-x1'), p_verified: true })
})
await check('unknown business id surfaces an error (the admin UI shows it instead of faking success)', async () => {
  const r = await asAdmin.rpc('admin_set_business_verified', { p_business_id: randomUUID(), p_verified: true })
  assert.ok(r.error); assert.equal(r.error.code, 'P0002')
})

console.log('Notifications')
const myList = (c, businessId) => c.from('notifications').select(NOTIFICATION_COLUMNS).eq('business_id', businessId).order('created_at', { ascending: false }).limit(20)
await check('events create notifications the owner can read exactly as the bell does', async () => {
  const id = bizId('alpha-foods-x1')
  assert.equal((await service.from('messages').insert({ business_id: id, sender_name: 'Ada', sender_phone: '0801', content: 'Do you deliver?' })).error, null)
  assert.equal((await service.from('reviews').insert({ business_id: id, reviewer_name: 'Chidi', rating: 5, comment: 'Great' })).error, null)
  const list = await myList(asA, id)
  assert.equal(list.error, null)
  const types = list.data.map((n) => n.type).sort()
  assert.deepEqual(types, ['new_message', 'new_review', 'verification_granted', 'verification_granted', 'verification_removed'].sort())
  for (const n of list.data) assert.ok(n.href === null || safeHref(n.href), `href ${n.href} passes the client check`)
  const unread = await asA.from('notifications').select('id', { count: 'exact', head: true }).eq('business_id', id).is('read_at', null)
  assert.equal(unread.count, 5)
})
await check('owner can mark read (one and all); read state persists', async () => {
  const id = bizId('alpha-foods-x1')
  const first = (await myList(asA, id)).data[0]
  assert.equal((await asA.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', first.id).is('read_at', null)).error, null)
  assert.equal((await asA.from('notifications').select('id', { count: 'exact', head: true }).eq('business_id', id).is('read_at', null)).count, 4)
  assert.equal((await asA.from('notifications').update({ read_at: new Date().toISOString() }).eq('business_id', id).is('read_at', null)).error, null)
  assert.equal((await asA.from('notifications').select('id', { count: 'exact', head: true }).eq('business_id', id).is('read_at', null)).count, 0)
})
await check('another business owner cannot see, read-mark or touch them', async () => {
  const id = bizId('alpha-foods-x1')
  assert.equal((await myList(asB, id)).data.length, 0)
  const nid = (await myList(asA, id)).data[0].id
  const upd = await asB.from('notifications').update({ read_at: null }).eq('id', nid).select()
  assert.equal((upd.data ?? []).length, 0)
  assert.equal(sql(`select (read_at is not null) from public.notifications where id='${nid}'`), 't')
})
await check('owners cannot forge, edit, retarget or delete notifications', async () => {
  const id = bizId('alpha-foods-x1'); const nid = (await myList(asA, id)).data[0].id
  const forge = await asA.from('notifications').insert({ business_id: id, type: 'new_message', title: 'x', dedupe_key: 'forged' })
  assert.ok(forge.error); assert.equal(forge.error.code, '42501')
  const edit = await asA.from('notifications').update({ title: 'hacked', href: 'https://evil.example' }).eq('id', nid)
  assert.ok(edit.error); assert.equal(edit.error.code, '42501')
  const del = await asA.from('notifications').delete().eq('id', nid)
  assert.ok(del.error); assert.equal(del.error.code, '42501')
  assert.equal(sql(`select count(*) from public.notifications where id='${nid}'`), '1')
})
await check('anonymous visitors cannot read notifications', async () => {
  const r = await anon.from('notifications').select('*')
  assert.ok(r.error); assert.equal(r.error.code, '42501')
})
await check('hostile sender/reviewer names land as inert, capped text', async () => {
  const id = bizId('alpha-foods-x1')
  await service.from('messages').insert({ business_id: id, sender_name: '<img src=x onerror=alert(1)>', sender_phone: '0', content: '<script>alert(1)</script>' })
  const n = (await myList(asA, id)).data.find((x) => x.type === 'new_message' && x.title.includes('<img'))
  assert.ok(n, 'stored as plain text (the UI renders text nodes; React escapes it)')
  assert.ok(n.title.length <= 120)
})

console.log('Admin actions through the helpers the admin page uses')
const C = 'c0000000-0000-0000-0000-00000000000c'
const asC = owner(C)
const adminRpc = (fn, args) => asAdmin.rpc(fn, args)
const ownerRpc = (fn, args) => asB.rpc(fn, args)

await check('helper: verify confirms the stored state; failures (non-admin, unknown id) are reported, not faked', async () => {
  const id = bizId('beta-tailors-x2')
  const ok = await adminSetBusinessVerified(adminRpc, id, true)
  assert.equal(ok.ok, true); assert.equal(ok.data.is_verified, true)
  assert.equal((await publicProfile('beta-tailors-x2')).data.is_verified, true)
  const denied = await adminSetBusinessVerified(ownerRpc, id, false)
  assert.equal(denied.ok, false); assert.match(denied.message, /forbidden/)
  assert.equal((await publicProfile('beta-tailors-x2')).data.is_verified, true, 'unchanged after the rejected call')
  const missing = await adminSetBusinessVerified(adminRpc, randomUUID(), true)
  assert.equal(missing.ok, false); assert.match(missing.message, /business not found/)
})

let deltaId
await check('ROOT CAUSE reproduced: an admin\'s direct DELETE through the API removes nothing and reports no error', async () => {
  assert.equal((await create(asC, C, 'Delta Crafts', 'delta-crafts-x5')).error, null)
  const id = deltaId = bizId('delta-crafts-x5')
  const r = await asAdmin.from('businesses').delete().eq('id', id).select()
  assert.equal(r.error, null)
  assert.deepEqual(r.data, [], 'zero rows deleted, no error: exactly what the old page treated as success')
  assert.equal(sql(`select count(*) from public.businesses where id='${id}'`), '1')
})
await check('owners cannot use the admin delete function; the business survives', async () => {
  const id = bizId('delta-crafts-x5')
  const r = await adminDeleteBusiness(ownerRpc, id)
  assert.equal(r.ok, false); assert.match(r.message, /forbidden/); assert.match(r.message, /Nothing was deleted/)
  assert.equal(sql(`select count(*) from public.businesses where id='${id}'`), '1')
})
await check('admin delete: helper confirms, business and dependants are gone, public page no longer finds it', async () => {
  const id = bizId('delta-crafts-x5')
  await service.from('messages').insert({ business_id: id, sender_name: 'X', content: 'hello' })
  assert.ok(Number(sql(`select count(*) from public.notifications where business_id='${id}'`)) > 0)
  const r = await adminDeleteBusiness(adminRpc, id)
  assert.equal(r.ok, true); assert.deepEqual(r.data, { id, business_name: 'Delta Crafts', logo: null })
  assert.equal(sql(`select count(*) from public.businesses where id='${id}'`), '0')
  assert.equal(sql(`select (select count(*) from public.messages where business_id='${id}') + (select count(*) from public.notifications where business_id='${id}') + (select count(*) from public.email_deliveries where business_id='${id}')`), '0')
  const pub = await publicProfile('delta-crafts-x5')
  assert.ok(pub.error, 'public profile is gone'); assert.equal(pub.error.code, 'PGRST116')
  assert.ok(Number(sql(`select count(*) from public.businesses`)) > 0, 'other businesses untouched')
})
await check('deleting the same business again, or an unknown id, is a reported failure, never success', async () => {
  for (const id of [deltaId, randomUUID()]) {
    const r = await adminDeleteBusiness(adminRpc, id)
    assert.equal(r.ok, false); assert.match(r.message, /business not found/)
  }
})

console.log('Admin delete + logo cleanup (real database; storage is faked and records what it is asked to remove)')
const SB = 'https://project.supabase.co'
const logoUrl = (name) => `${SB}/storage/v1/object/public/logos/${name}`
const removedFiles = []
const logoDeps = (asClient) => ({
  logoNameFor: (u, ownerId) => logoObjectName(u, ownerId, SB),
  readBusiness: async (id) => (await asClient.from('businesses').select('user_id, logo_url').eq('id', id).maybeSingle()).data,
  callDelete: async (id) => { const r = await asClient.rpc('admin_delete_business', { p_business_id: id }); return { data: r.data, error: r.error ? { message: r.error.message, code: r.error.code } : null } },
  logoStillReferenced: async (u) => ((await service.from('businesses').select('id', { count: 'exact', head: true }).eq('logo_url', u)).count ?? 0) > 0,
  removeLogo: async (name) => { removedFiles.push(name); return { removed: true, error: null } },
})
const seedBiz = (slug, userId, logo) => {
  const id = randomUUID()
  sql(`insert into public.businesses (id, user_id, business_name, slug, logo_url) values ('${id}', '${userId}', '${slug}', '${slug}', ${logo ? `'${logo}'` : 'null'})`)
  return id
}
const exists = (id) => sql(`select count(*) from public.businesses where id='${id}'`) === '1'

await check('admin deletes a business: its own logo file is removed, after the delete', async () => {
  removedFiles.length = 0
  const owner = randomUUID(); const file = `${owner}-1760000000000.jpg`
  const id = seedBiz('logo-a', owner, logoUrl(file))
  const r = await deleteBusinessAndLogo(id, logoDeps(asAdmin))
  assert.deepEqual(r, { ok: true, id, business_name: 'logo-a', logo: 'removed' })
  assert.deepEqual(removedFiles, [file]); assert.equal(exists(id), false)
})
await check('a non-admin is refused (403) and nothing is deleted or removed from storage', async () => {
  removedFiles.length = 0
  const owner = randomUUID(); const id = seedBiz('logo-b', owner, logoUrl(`${owner}-1760000000001.png`))
  const r = await deleteBusinessAndLogo(id, logoDeps(asB))
  assert.deepEqual(r, { ok: false, status: 403, message: 'Admins only' })
  assert.deepEqual(removedFiles, []); assert.equal(exists(id), true)
})
await check('an unknown business is a 404 and storage is untouched', async () => {
  removedFiles.length = 0
  const r = await deleteBusinessAndLogo(randomUUID(), logoDeps(asAdmin))
  assert.equal(r.ok, false); assert.equal(r.status, 404); assert.deepEqual(removedFiles, [])
})
await check('SECURITY: a business whose logo_url points at ANOTHER user\'s file is deleted but that file is left alone', async () => {
  removedFiles.length = 0
  const victim = randomUUID(); const attacker = randomUUID()
  const id = seedBiz('logo-evil', attacker, logoUrl(`${victim}-1760000000002.jpg`))
  const r = await deleteBusinessAndLogo(id, logoDeps(asAdmin))
  assert.equal(r.ok, true); assert.equal(r.logo, 'skipped')
  assert.deepEqual(removedFiles, []); assert.equal(exists(id), false)
})
await check('a logo URL copied onto another business can\'t get the original file deleted; the real owner\'s own deletion still cleans it up', async () => {
  removedFiles.length = 0
  const owner = randomUUID(); const copier = randomUUID(); const url = logoUrl(`${owner}-1760000000003.jpg`)
  const original = seedBiz('logo-original', owner, url); const copy = seedBiz('logo-copy', copier, url)
  // Deleting the business that merely copied the URL: not its owner's file -> never touched.
  const first = await deleteBusinessAndLogo(copy, logoDeps(asAdmin))
  assert.equal(first.ok, true); assert.equal(first.logo, 'skipped'); assert.deepEqual(removedFiles, [])
  // Deleting the real owner's business afterwards: no other references remain -> file removed.
  const second = await deleteBusinessAndLogo(original, logoDeps(asAdmin))
  assert.equal(second.ok, true); assert.equal(second.logo, 'removed')
  assert.deepEqual(removedFiles, [`${owner}-1760000000003.jpg`])
})
await check('while another business still references the owner\'s file, it is kept', async () => {
  removedFiles.length = 0
  const owner = randomUUID(); const copier = randomUUID(); const url = logoUrl(`${owner}-1760000000004.jpg`)
  const original = seedBiz('logo-original-2', owner, url); const copy = seedBiz('logo-copy-2', copier, url)
  const r = await deleteBusinessAndLogo(original, logoDeps(asAdmin))
  assert.equal(r.ok, true); assert.equal(r.logo, 'skipped', 'the copy still points at it')
  assert.deepEqual(removedFiles, []); assert.equal(exists(copy), true)
})
await check('business with no logo: deleted, nothing to clean up', async () => {
  removedFiles.length = 0
  const id = seedBiz('logo-none', randomUUID(), null)
  const r = await deleteBusinessAndLogo(id, logoDeps(asAdmin))
  assert.equal(r.ok, true); assert.equal(r.logo, 'none'); assert.deepEqual(removedFiles, [])
})

console.log('Review moderation (what the admin handlers rely on)')
await check('supabase-js returns an exact row count for UPDATE (the handlers treat count !== 1 as failure)', async () => {
  const id = bizId('alpha-foods-x1')
  await service.from('reviews').insert({ business_id: id, reviewer_name: 'Mod Target', rating: 1, comment: 'meh' })
  const rid = sql(`select id from public.reviews where reviewer_name='Mod Target'`)
  const hit = await asAdmin.from('reviews').update({ moderation_status: 'removed' }, { count: 'exact' }).eq('id', rid)
  assert.equal(hit.error, null); assert.equal(hit.count, 1, `count was ${hit.count}`)
  const miss = await asAdmin.from('reviews').update({ moderation_status: 'removed' }, { count: 'exact' }).eq('id', randomUUID())
  assert.equal(miss.error, null); assert.equal(miss.count, 0, 'an update that matches nothing reports 0, so the page shows an error')
})
await check('removing a review notifies the owner (review_removed) and links to their public page', async () => {
  const id = bizId('alpha-foods-x1')
  const list = await myList(asA, id)
  const n = list.data.find((x) => x.type === 'review_removed')
  assert.ok(n, 'review_removed notification exists')
  assert.equal(safeHref(n.href), '/business/alpha-foods-x1')
})
await check('flagging a review notifies the owner once per flag', async () => {
  const id = bizId('alpha-foods-x1')
  await service.from('reviews').insert({ business_id: id, reviewer_name: 'Flag Target', rating: 2, comment: 'hmm' })
  const rid = sql(`select id from public.reviews where reviewer_name='Flag Target'`)
  await asAdmin.from('reviews').update({ moderation_status: 'flagged' }).eq('id', rid)
  await asAdmin.from('reviews').update({ moderation_status: 'flagged' }).eq('id', rid) // no change -> no second alert
  assert.equal(sql(`select count(*) from public.notifications where business_id='${id}' and type='review_flagged'`), '1')
})

console.log(`\n${passed} checks passed${process.exitCode ? ', SOME FAILED' : ''}`)
