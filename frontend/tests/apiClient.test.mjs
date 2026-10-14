import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}`
const permissions = moduleUrl(await readFile(new URL('../src/utils/permissions.ts', import.meta.url), 'utf8'))
const source = (await readFile(new URL('../src/services/apiClient.ts', import.meta.url), 'utf8')).replace('import.meta.env.VITE_API_BASE_URL', JSON.stringify('http://127.0.0.1:0/api/v1')).replace("'../utils/permissions'", JSON.stringify(permissions))
let version = 0
const activeUser = role => ({ id: 'synthetic-user', name: 'Fixture', email: 'fixture@example.test', role, status: 'Active' })
const session = (role = 'Administrator', token = 'fixture-access') => ({ token, refreshToken: 'fixture-refresh', expiresIn: 3600, user: activeUser(role) })
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })

async function check(run) {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  const storage = new Map()
  globalThis.window = { sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } }
  const api = await import(`${moduleUrl(source)}#${++version}`)
  try { await run(api, storage) }
  finally {
    globalThis.fetch = async () => response({})
    await api.signOut() // Clear scheduled refresh timers even after a failed assertion.
    globalThis.fetch = originalFetch
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow
  }
}

test('authenticated requests attach the access bearer, never the refresh token', () => check(async api => {
  const requests = []
  globalThis.fetch = async (url, options) => { requests.push({ url, options }); return response(url.endsWith('/auth/login') ? session() : []) }
  await api.signIn('fixture@example.test', 'synthetic-test-input')
  await api.apiRequest('users')
  assert.equal(requests[1].options.headers.get('Authorization'), 'Bearer fixture-access')
  assert.equal(requests[0].options.headers.get('Authorization'), null)
}))

test('health probe is public, uncached and cancellable without changing the session', () => check(async api => {
  globalThis.fetch = async () => response(session())
  await api.signIn('fixture@example.test', 'synthetic-test-input')
  const controller = new AbortController()
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith('/health'))
    assert.equal(options.method ?? 'GET', 'GET')
    assert.equal(options.headers.get('Authorization'), null)
    assert.equal(options.body, undefined)
    assert.equal(options.credentials, 'omit')
    assert.equal(options.cache, 'no-store')
    assert.equal(options.signal, controller.signal)
    return response({ status: 'ok' })
  }
  await api.checkBackendHealth(controller.signal)
  assert.equal(api.getAuthState().status, 'authenticated')
}))

test('health probe requires the actual healthy response, not just HTTP 200', () => check(async api => {
  for (const value of [null, {}, { status: 'starting' }]) {
    globalThis.fetch = async () => response(value)
    await assert.rejects(api.checkBackendHealth(new AbortController().signal), /not ready/)
  }
}))

test('403 rechecks the trusted profile and removes stale privileged UI role', () => check(async api => {
  globalThis.fetch = async url => response(url.endsWith('/auth/login') ? session() : url.endsWith('/auth/me') ? activeUser('Viewer') : { error: 'Forbidden' }, url.endsWith('/users') ? 403 : 200)
  await api.signIn('fixture@example.test', 'synthetic-test-input')
  await assert.rejects(api.apiRequest('users'), error => error.status === 403)
  assert.equal(api.getAuthState().user.role, 'Viewer')
}))

test('inactive refresh after 401 removes the stored session and does not retry the write', () => check(async (api, storage) => {
  let writes = 0
  globalThis.fetch = async url => {
    if (url.endsWith('/auth/login')) return response(session())
    if (url.endsWith('/users')) writes++
    return response({ error: 'Inactive' }, 401)
  }
  await api.signIn('fixture@example.test', 'synthetic-test-input')
  await assert.rejects(api.apiRequest('users', { method: 'POST', body: {} }), error => error.status === 401)
  assert.equal(api.getAuthState().status, 'unauthenticated')
  assert.equal(storage.size, 0)
  assert.equal(writes, 1)
}))

test('unknown roles and inactive login envelopes are never accepted', () => check(async api => {
  for (const user of [{ ...activeUser('Viewer'), status: 'Inactive' }, activeUser('Owner')]) {
    globalThis.fetch = async () => response({ ...session(), user })
    await assert.rejects(api.signIn('fixture@example.test', 'synthetic-test-input'), /invalid session/)
    assert.notEqual(api.getAuthState().status, 'authenticated')
  }
}))

test('logout clears local credentials even when server invalidation is unavailable', () => check(async (api, storage) => {
  globalThis.fetch = async () => response(session())
  await api.signIn('fixture@example.test', 'synthetic-test-input')
  globalThis.fetch = async () => { throw Error('Synthetic offline API') }
  await api.signOut()
  assert.equal(api.getAuthState().status, 'unauthenticated')
  assert.match(api.getAuthState().notice, /Signed out locally/)
  assert.equal(storage.size, 0)
}))

test('an old 403 profile check cannot sign out a newer login', () => check(async api => {
  let finishProfile
  let profileStarted
  const started = new Promise(resolve => { profileStarted = resolve })
  globalThis.fetch = async url => {
    if (url.endsWith('/auth/login')) return response(session())
    if (url.endsWith('/auth/me')) { profileStarted(); return new Promise(resolve => { finishProfile = resolve }) }
    return response({ error: 'Forbidden' }, 403)
  }
  await api.signIn('fixture@example.test', 'synthetic-test-input')
  const request = api.apiRequest('users')
  const rejected = assert.rejects(request, error => error.status === 403)
  await started
  globalThis.fetch = async () => response(session('Researcher', 'fixture-new-access'))
  await api.signIn('fixture@example.test', 'synthetic-test-input')
  finishProfile(response({ error: 'Expired old session' }, 401))
  await rejected
  assert.equal(api.getAuthState().status, 'authenticated')
  assert.equal(api.getAuthState().user.role, 'Researcher')
}))
