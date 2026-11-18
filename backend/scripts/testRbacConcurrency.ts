import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { localPsql } from './testRbacDatabase'

// Focused real-DB gaps only. Writes committed synthetic data into an EMPTY disposable
// project; destroy that project's volumes afterwards, never an existing development DB.
async function main() {
  const container = process.env.RBAC_LOCAL_TEST_CONTAINER
  assert.ok(container, 'Explicit disposable container required')
  const client = localPsql()
  const project = container.slice('supabase_db_'.length)
  const query = (sql: string) => {
    const result = spawnSync(client.command,client.args,{ env:client.env, input:sql, encoding:'utf8' })
    if (result.stderr) process.stderr.write(result.stderr)
    assert.equal(result.status,0,'Local SQL query failed')
    return result.stdout.trim()
  }
  const scalar = (sql: string) => query(sql).split('\n').at(-1)!.trim()
  const authOnly = process.argv.includes('--auth-only')
  if (authOnly) {
    assert.equal(scalar("select count(*) from auth.users where email !~ '^[0-9a-f-]{36}@example\\.test$';"),'0','API resume requires only synthetic local fixtures')
  } else {
    assert.equal(scalar('select (select count(*) from auth.users)+(select count(*) from public.profiles)+(select count(*) from public.account_audit);'),'0','Requires empty disposable accounts/audits')
  }
  const session = (sql: string) => new Promise<{code:number|null;stderr:string}>((resolve,reject) => {
    const child = spawn(client.command,client.args,{ env:client.env })
    let stderr = ''
    child.stderr.on('data',data => { stderr += data.toString() })
    child.stdout.resume()
    child.on('error',reject)
    child.on('close',code => resolve({code,stderr}))
    child.stdin.end(sql)
  })
  const first = randomUUID(), second = randomUUID()
  const actions = [
    ['deactivate', (id: string) => `update public.profiles set status='Inactive' where id='${id}';`],
    ['demote', (id: string) => `update public.profiles set role='Viewer' where id='${id}';`],
    ['auth-cascade-delete', (id: string) => `delete from auth.users where id='${id}';`],
    ['profile-delete', (id: string) => `delete from public.profiles where id='${id}';`],
  ] as const
  for (const [name,change] of authOnly ? [] : actions) {
    // Repair only these synthetic fixtures if a previous scenario deleted a row.
    const authorizer = scalar("select coalesce((select id::text from public.profiles where role='Super Administrator' and status='Active' limit 1),'');")
    query(`begin;
      insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
        ('${first}','${first}@example.test',now(),'{}'),('${second}','${second}@example.test',now(),'{}') on conflict(id) do nothing;
      insert into public.profiles(id,email,role,status) select id,email,'Viewer','Inactive' from auth.users where id in ('${first}','${second}') on conflict(id) do nothing;
      select public.provision_super_administrator('${first}','Synthetic concurrency fixture',${authorizer ? `'${authorizer}'` : 'null'});
      select public.provision_super_administrator('${second}','Synthetic concurrency fixture','${first}'); commit;`)
    assert.equal(scalar("select count(*) from public.profiles where role='Super Administrator' and status='Active';"),'2')
    const before = Number(scalar('select count(*) from public.account_audit;'))
    const tag = 'safe-rbac-' + randomUUID()
    const firstSession = session(`begin; set application_name='${tag}'; set local statement_timeout='12s'; ${change(first)} select pg_sleep(3); commit;`)
    let locked = false
    for (let attempt=0; attempt<20; attempt++) {
      locked = scalar(`select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.application_name='${tag}' and l.relation='public.profiles'::regclass and l.mode='ShareRowExclusiveLock' and l.granted;`) !== '0'
      if (locked) break
      await new Promise(resolve => setTimeout(resolve,50))
    }
    assert.ok(locked,'First session did not acquire the protection lock')
    const secondSession = session(`begin; set local statement_timeout='12s'; ${change(second)} commit;`)
    const [a,b] = await Promise.all([firstSession,secondSession])
    assert.equal(a.code,0,a.stderr)
    assert.notEqual(b.code,0,'Both conflicting removals committed')
    assert.match(b.stderr,/Cannot remove the last active Super Administrator/)
    assert.equal(scalar("select count(*) from public.profiles where role='Super Administrator' and status='Active';"),'1')
    assert.ok(Number(scalar('select count(*) from public.account_audit;')) > before,'Committed mutation audit missing')
    if (name === 'auth-cascade-delete') {
      assert.equal(scalar(`select (select count(*) from auth.users where id='${first}')+(select count(*) from public.profiles where id='${first}');`),'0')
      assert.equal(scalar(`select count(*) from public.account_audit where target_id='${first}' and action='delete';`),'1')
    }
    console.log(`PASS two-session ${name}: one commit, one last-administrator rejection, one survivor; committed audit persisted`)
  }

  // Use only this disposable project's existing local Auth credentials, in memory.
  const api = new URL(process.env.RBAC_LOCAL_TEST_API_URL || '')
  assert.equal(api.protocol,'http:')
  assert.equal(api.hostname,'127.0.0.1')
  const gateway = spawnSync('docker',['inspect','--format','{"ports":{{json .NetworkSettings.Ports}},"labels":{{json .Config.Labels}}}','supabase_kong_' + project],{encoding:'utf8'})
  assert.equal(gateway.status,0)
  const gatewayMetadata = JSON.parse(gateway.stdout)
  assert.equal(gatewayMetadata.labels['safe.rbac.disposable'],'true')
  assert.ok(gatewayMetadata.ports['8000/tcp']?.length && gatewayMetadata.ports['8000/tcp'].every((port:{HostIp:string;HostPort:string}) => port.HostIp === '127.0.0.1' && port.HostPort === api.port),'Local API port mismatch or gateway stopped')
  const auth = spawnSync('docker',['inspect','--format','{{json .Config.Env}}','supabase_auth_' + project],{encoding:'utf8'})
  assert.equal(auth.status,0)
  const authEnv = JSON.parse(auth.stdout) as string[]
  assert.ok(authEnv.includes('GOTRUE_DISABLE_SIGNUP=true'),'Local public signup must be disabled')
  const secret = authEnv.find(value => value.startsWith('GOTRUE_JWT_SECRET='))?.slice('GOTRUE_JWT_SECRET='.length)
  assert.ok(secret,'Local Auth signing secret unavailable')
  const token = (role:string) => {
    const encode = (value:unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const now = Math.floor(Date.now()/1000)
    const unsigned = encode({alg:'HS256',typ:'JWT'}) + '.' + encode({role,iss:'supabase',iat:now,exp:now+600})
    return unsigned + '.' + createHmac('sha256',secret).update(unsigned).digest('base64url')
  }
  const options = {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
  const admin = createClient(api.origin,token('service_role'),options)
  const anon = createClient(api.origin,token('anon'),options)
  const password = randomUUID() + randomUUID()
  const signup = await anon.auth.signUp({email:randomUUID()+'@example.test',password})
  assert.ok(signup.error,'Public signup unexpectedly succeeded')
  assert.match(signup.error.message,/signups.*not.*allowed|signup.*disabled/i)
  console.log('PASS actual local Auth API: public signup disabled')
  const created = await admin.auth.admin.createUser({email:randomUUID()+'@example.test',password,email_confirm:true,user_metadata:{role:'Super Administrator'}})
  assert.ok(!created.error && created.data.user,'Synthetic local Auth creation failed')
  const id = created.data.user.id
  assert.equal(scalar(`select role||'/'||status from public.profiles where id='${id}';`),'Viewer/Inactive')
  const deleted = await admin.auth.admin.deleteUser(id)
  assert.ok(!deleted.error,'Synthetic local Auth deletion failed')
  assert.equal(scalar(`select (select count(*) from auth.users where id='${id}')+(select count(*) from public.profiles where id='${id}');`),'0')
  assert.equal(scalar(`select count(*) from public.account_audit where target_id='${id}' and action='delete';`),'1')
  console.log('PASS actual local Auth API: metadata cannot escalate; deletion cascaded; committed deletion audit persisted')
  const survivor = scalar("select id::text from public.profiles where role='Super Administrator' and status='Active';")
  const protectedDelete = await admin.auth.admin.deleteUser(survivor)
  assert.ok(protectedDelete.error,'Auth API removed the last active Super Administrator')
  assert.equal(scalar(`select count(*) from auth.users u join public.profiles p on p.id=u.id where p.id='${survivor}' and p.role='Super Administrator' and p.status='Active';`),'1')
  console.log('PASS actual local Auth API: last active Super Administrator deletion rejected and rolled back')
  console.log('Committed synthetic fixture data remains only in this disposable project; tear down its volumes after verification.')
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Local database verification failed'); process.exitCode=1 })
