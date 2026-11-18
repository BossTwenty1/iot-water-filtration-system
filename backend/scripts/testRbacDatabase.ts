import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Never import backend env/config or fall back to hosted credentials.
export function localPsql() {
  const connection = process.env.RBAC_LOCAL_TEST_DATABASE_URL
  if (!connection) throw new Error('Explicit local test URL required')
  const url = new URL(connection)
  if (!['postgres:','postgresql:'].includes(url.protocol) || !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Local database required')
  const container = process.env.RBAC_LOCAL_TEST_CONTAINER
  if (container) {
    // Only explicit disposable projects whose published DB port matches the local URL.
    if (!/^supabase_db_safe-rbac-[a-z0-9-]+$/.test(container) || url.username !== 'postgres' || url.pathname !== '/postgres') throw new Error('Disposable Supabase container required')
    const inspection = spawnSync('docker',['inspect','--format','{"ports":{{json .NetworkSettings.Ports}},"labels":{{json .Config.Labels}}}',container], { encoding:'utf8' })
    if (inspection.status !== 0) throw new Error('Container verification failed')
    const metadata = JSON.parse(inspection.stdout)
    if (metadata.labels['safe.rbac.disposable'] !== 'true' || metadata.labels['com.supabase.cli.project'] !== container.slice('supabase_db_'.length)) throw new Error('Disposable project label required')
    const ports = metadata.ports['5432/tcp'] as { HostIp: string; HostPort: string }[] | undefined
    if (!ports?.length || !ports.every(port => ['127.0.0.1','::1'].includes(port.HostIp) && port.HostPort === url.port)) throw new Error('Loopback container port required')
    return { command:'docker', args:['exec','-i','--user','postgres',container,'psql','--no-psqlrc','--set','ON_ERROR_STOP=1','--tuples-only','--no-align','--dbname','postgres','--file','-'], env:process.env }
  }
  return { command:'psql', args:['--no-psqlrc','--set','ON_ERROR_STOP=1','--tuples-only','--no-align','--file','-'],
    env: { ...process.env, PGHOST:url.hostname === '[::1]' ? '::1' : url.hostname, PGPORT:url.port || '54322', PGUSER:decodeURIComponent(url.username), PGPASSWORD:decodeURIComponent(url.password), PGDATABASE:url.pathname.slice(1), PGSSLMODE:'disable' } }
}

if (require.main === module) {
  try {
    const client = localPsql()
    const result = spawnSync(client.command,client.args,{ env:client.env, input:readFileSync(path.join(__dirname,'../supabase/tests/rbac.sql'),'utf8'), encoding:'utf8' })
    if (result.stderr) process.stderr.write(result.stderr)
    if (result.error || result.status !== 0) throw new Error('SQL checks failed or psql unavailable')
    console.log('Local rollback-only RBAC SQL regression passed.')
  } catch {
    console.error('Local SQL checks not confirmed: require psql (or a verified disposable RBAC_LOCAL_TEST_CONTAINER), an empty migrated disposable local database and RBAC_LOCAL_TEST_DATABASE_URL. No hosted fallback is allowed.')
    process.exitCode=1
  }
}
