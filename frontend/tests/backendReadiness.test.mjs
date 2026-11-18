import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}`
const permissions = moduleUrl(await readFile(new URL('../src/utils/permissions.ts', import.meta.url), 'utf8'))
const api = moduleUrl((await readFile(new URL('../src/services/apiClient.ts', import.meta.url), 'utf8')).replace('import.meta.env.VITE_API_BASE_URL', JSON.stringify('http://127.0.0.1:0/api/v1')).replace("'../utils/permissions'", JSON.stringify(permissions)))
const { waitForBackend } = await import(moduleUrl((await readFile(new URL('../src/services/backendReadiness.ts', import.meta.url), 'utf8')).replace("'./apiClient'", JSON.stringify(api))))
const response = (value = { status: 'ok' }, status = 200) => new Response(JSON.stringify(value), { status })
const flush = () => new Promise(resolve => setImmediate(resolve))

function setup(t, fetch) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  t.mock.method(globalThis, 'fetch', fetch)
}

test('ready server resolves immediately; only public GET health is requested', async t => {
  let calls = 0
  setup(t, async (url, options) => {
    calls++
    assert.equal(url, 'http://127.0.0.1:0/api/v1/health')
    assert.equal(options.method ?? 'GET', 'GET')
    assert.equal(options.body, undefined)
    assert.equal(options.headers.get('Authorization'), null)
    return response()
  })
  await waitForBackend(new AbortController().signal)
  t.mock.timers.tick(90_000)
  assert.equal(calls, 1)
})

test('transient failures retry every five seconds and stop after recovery', async t => {
  let calls = 0
  setup(t, async () => ++calls === 1 ? response({}, 503) : calls === 2 ? new Response('Starting server', { status: 200 }) : response())
  const pending = waitForBackend(new AbortController().signal)
  await flush()
  t.mock.timers.tick(4_999)
  await flush()
  assert.equal(calls, 1)
  t.mock.timers.tick(1)
  await flush()
  assert.equal(calls, 2)
  t.mock.timers.tick(5_000)
  await pending
  t.mock.timers.tick(90_000)
  assert.equal(calls, 3)
})

test('a slow cold-start request can complete without overlapping probes', async t => {
  let calls = 0
  setup(t, () => { calls++; return new Promise(resolve => setTimeout(() => resolve(response()), 60_000)) })
  const pending = waitForBackend(new AbortController().signal)
  t.mock.timers.tick(60_000)
  await pending
  assert.equal(calls, 1)
})

test('hung requests abort at 90 seconds; a fresh retry can succeed', async t => {
  let aborted = false
  setup(t, (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(signal.reason) }, { once: true })))
  const failed = assert.rejects(waitForBackend(new AbortController().signal), /Server unavailable/)
  t.mock.timers.tick(90_000)
  await failed
  assert.equal(aborted, true)
  globalThis.fetch = async () => response()
  await waitForBackend(new AbortController().signal)
})

test('persistent offline failures stop retrying at the overall deadline', async t => {
  let calls = 0
  setup(t, async () => { calls++; throw new TypeError('Synthetic offline connection') })
  const failed = assert.rejects(waitForBackend(new AbortController().signal), /Server unavailable/)
  for (let elapsed = 0; elapsed < 90_000; elapsed += 5_000) {
    await flush()
    t.mock.timers.tick(5_000)
  }
  await failed
  const finishedCalls = calls
  t.mock.timers.tick(90_000)
  await flush()
  assert.equal(calls, finishedCalls)
})

test('unmount cancellation clears delayed retries and prevents new probes', async t => {
  let calls = 0
  setup(t, async () => { calls++; return response({}, 503) })
  const controller = new AbortController()
  const cancelled = assert.rejects(waitForBackend(controller.signal), error => error.name === 'AbortError')
  await flush()
  controller.abort()
  await cancelled
  t.mock.timers.tick(90_000)
  assert.equal(calls, 1)
  await assert.rejects(waitForBackend(controller.signal), error => error.name === 'AbortError')
  assert.equal(calls, 1)
})

test('unmount cancellation aborts an in-flight health request', async t => {
  let requestSignal
  setup(t, (_url, { signal }) => {
    requestSignal = signal
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
  })
  const controller = new AbortController()
  const cancelled = assert.rejects(waitForBackend(controller.signal), error => error.name === 'AbortError')
  controller.abort()
  await cancelled
  assert.equal(requestSignal.aborted, true)
})
