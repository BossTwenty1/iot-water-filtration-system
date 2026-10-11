import { spawnSync } from 'node:child_process'
import path from 'node:path'

// Never import backend env/config or fall back to hosted credentials.
try {
  const connection = process.env.RBAC_LOCAL_TEST_DATABASE_URL
  if (!connection) throw new Error('Explicit local test URL required')
  const url = new URL(connection)
  if (!['postgres:','postgresql:'].includes(url.protocol) || !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Local database required')
  const result = spawnSync('psql',['--no-psqlrc','--set','ON_ERROR_STOP=1','--file',path.join(__dirname,'../supabase/tests/rbac.sql')], {
    env: { ...process.env, PGHOST:url.hostname === '[::1]' ? '::1' : url.hostname, PGPORT:url.port || '54322', PGUSER:decodeURIComponent(url.username), PGPASSWORD:decodeURIComponent(url.password), PGDATABASE:url.pathname.slice(1), PGSSLMODE:'disable' }, encoding:'utf8',
  })
  if (result.error || result.status !== 0) throw new Error('SQL checks failed or psql unavailable')
  console.log('Local rollback-only RBAC SQL regression passed.')
} catch {
  console.error('Local SQL checks not confirmed: require psql, an empty migrated disposable local database and RBAC_LOCAL_TEST_DATABASE_URL. No hosted fallback is allowed.')
  process.exitCode=1
}
