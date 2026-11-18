// Test-only, loopback preview. No Supabase client, environment loading or real accounts.
// Build first with VITE_API_BASE_URL=/api/v1; never deploy this fixture server.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, sep, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const roles = ['Super Administrator', 'Administrator', 'Researcher', 'Viewer']
const fixturePrefix = 'rbac-fixture|'
const user = (id, name, role, status = 'Active') => ({ id, name, email: `${name.toLowerCase()}@example.test`, role, status })
const currentId = '00000000-0000-4000-8000-000000000001'
const records = [user('00000000-0000-4000-8000-000000000002', 'FixtureResearcher', 'Researcher'), user('00000000-0000-4000-8000-000000000003', 'FixtureViewer', 'Viewer', 'Inactive'), user('00000000-0000-4000-8000-000000000004', 'FixtureAdministrator', 'Administrator')]
const audit = [{ id: '00000000-0000-4000-8000-000000000005', actor_id: currentId, target_id: records[0].id, action: 'create', old_role: 'Viewer', new_role: 'Researcher', old_status: 'Inactive', new_status: 'Active', reason: 'Synthetic UI verification', created_at: '2026-10-11T00:00:00Z' }]
const json = (res, value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)) }
const body = async req => { let value = ''; for await (const chunk of req) { value += chunk; if (value.length > 10000) throw Error('Fixture payload too large') } return JSON.parse(value || '{}') }

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:5185')
    if (url.pathname.startsWith('/api/v1/')) {
      const input = req.method === 'POST' || req.method === 'PATCH' ? await body(req) : {}
      const token = url.pathname === '/api/v1/auth/refresh' ? input.refreshToken : req.headers.authorization?.replace('Bearer ', '')
      const [, role, mode] = (token ?? '').split('|')
      if (!token?.startsWith(fixturePrefix) || !roles.includes(role) || mode === 'inactive') return json(res, { error: 'Synthetic inactive or invalid session.' }, 401)
      const current = user(currentId, 'FixtureCurrent', role)
      if (url.pathname === '/api/v1/auth/refresh') return json(res, { token, refreshToken: token, expiresIn: 3600, user: current })
      if (url.pathname === '/api/v1/auth/me') return json(res, current)
      if (url.pathname === '/api/v1/auth/logout') { res.writeHead(204); return res.end() }
      if (req.method !== 'GET') return json(res, { error: 'Read-only synthetic preview: no account changes.' }, 403)
      if (url.pathname === '/api/v1/settings') return json(res, { deviceDisplayName: 'Synthetic preview', timezone: 'Asia/Manila', dateFormat: 'YYYY-MM-DD', timeFormat: '24-hour', notifications: {} })
      if (url.pathname === '/api/v1/devices') return json(res, [])
      if (!['Administrator', 'Super Administrator'].includes(role)) return json(res, { error: 'Synthetic forbidden response.' }, 403)
      if (url.pathname === '/api/v1/users/audit') return role === 'Super Administrator' ? json(res, audit) : json(res, { error: 'Synthetic forbidden response.' }, 403)
      if (url.pathname === '/api/v1/users') {
        if (mode === 'error') return json(res, { error: 'Synthetic directory failure. Try Refresh.' }, 503)
        let rows = mode === 'empty' ? [] : [current, ...records].filter(row => role === 'Super Administrator' || ['Researcher', 'Viewer'].includes(row.role))
        for (const key of ['role', 'status']) if (url.searchParams.get(key)) rows = rows.filter(row => row[key] === url.searchParams.get(key))
        if (url.searchParams.get('search')) rows = rows.filter(row => row.email.includes(url.searchParams.get('search').toLowerCase()))
        const offset = Number(url.searchParams.get('offset') ?? 0)
        return json(res, rows.slice(offset, offset + Number(url.searchParams.get('limit') ?? 25)))
      }
      const match = /^\/api\/v1\/users\/([^/]+)(?:\/(role|status))?$/.exec(url.pathname)
      const target = records.find(row => row.id === match?.[1])
      if (target && (role === 'Super Administrator' || ['Researcher', 'Viewer'].includes(target.role))) {
        if (req.method === 'GET') return json(res, target)
        // Confirmation submission is intentionally not supported: this preview never provisions accounts.
      }
      return json(res, { error: 'Read-only synthetic preview: no account changes.' }, 403)
    }
    const path = resolve(root, `.${decodeURIComponent(url.pathname)}`)
    if (!path.startsWith(`${resolve(root)}${sep}`)) return json(res, { error: 'Not found' }, 404)
    const isAsset = extname(path) && !path.endsWith('.html')
    let content = await readFile(isAsset ? path : resolve(root, 'index.html'))
    if (!isAsset) {
      const role = roles.includes(url.searchParams.get('role')) ? url.searchParams.get('role') : 'Administrator'
      const mode = ['empty', 'error', 'inactive'].includes(url.searchParams.get('mode')) ? url.searchParams.get('mode') : 'normal'
      const session = JSON.stringify(`${fixturePrefix}${role}|${mode}`)
      content = content.toString().replace('<head>', `<head><script>sessionStorage.setItem('iot-water-filtration.refresh-token',${session})</script>`).replace('<body>', '<body><div style="padding:8px;background:#fff4c2;color:#352800;font:12px system-ui">Synthetic RBAC UI fixture — no real accounts or database connection</div>')
    }
    const mime = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
    res.writeHead(200, { 'Content-Type': isAsset ? mime[extname(path)] ?? 'application/octet-stream' : 'text/html', 'Cache-Control': 'no-store' })
    res.end(content)
  } catch { json(res, { error: 'Local preview unavailable; rebuild the frontend fixture bundle.' }, 500) }
}).listen(5185, '127.0.0.1', () => console.log('Synthetic read-only RBAC UI preview: http://127.0.0.1:5185/users'))
