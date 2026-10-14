// Requires the explicitly synthetic loopback fixture, never a real backend.
import test from 'node:test'
import assert from 'node:assert/strict'

test('read-only preview isolates all four synthetic roles and refuses provisioning', async () => {
  const base = 'http://127.0.0.1:5185/api/v1/'
  for (const role of ['Super Administrator', 'Administrator', 'Researcher', 'Viewer']) {
    const token = `rbac-fixture|${role}|normal`
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const session = await fetch(`${base}auth/refresh`, { method: 'POST', headers, body: JSON.stringify({ refreshToken: token }) })
    assert.equal((await session.json()).user.role, role)
    const directory = await fetch(`${base}users`, { headers })
    assert.equal(directory.status, ['Administrator', 'Super Administrator'].includes(role) ? 200 : 403)
    if (role === 'Administrator') assert.ok((await directory.json()).every(row => ['Researcher', 'Viewer'].includes(row.role)))
    assert.equal((await fetch(`${base}users/audit`, { headers })).status, role === 'Super Administrator' ? 200 : 403)
    assert.equal((await fetch(`${base}users`, { method: 'POST', headers, body: '{}' })).status, 403)
  }
  const inactive = await fetch(`${base}auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: 'rbac-fixture|Administrator|inactive' }) })
  assert.equal(inactive.status, 401)
})
