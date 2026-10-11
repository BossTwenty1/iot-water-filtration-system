import { beforeEach, describe, expect, it, vi } from 'vitest'
import express, { type Request, type Response } from 'express'
import request from 'supertest'
import { errorHandler } from '../middleware/errorHandler'
import { roles } from '../lib/permissions'

const mock = vi.hoisted(() => ({ getUser:vi.fn(), signIn:vi.fn(), refresh:vi.fn(), from:vi.fn(), rpc:vi.fn(), create:vi.fn(), delete:vi.fn() }))
vi.mock('../config/supabaseClient', () => ({
  supabaseAnon: { auth: { getUser:mock.getUser, signInWithPassword:mock.signIn, refreshSession:mock.refresh } },
  supabaseAdmin: { from:mock.from, rpc:mock.rpc, auth:{admin:{createUser:mock.create,deleteUser:mock.delete}} },
  createScopedClient: vi.fn(),
}))
import routes from './index'
import { requireAuth } from '../middleware/auth'
import { streamAuthorized } from '../lib/sse'

const actorId='10000000-0000-4000-8000-000000000001'
const targetId='10000000-0000-4000-8000-000000000002'
let actor: Record<string,unknown>
let target: Record<string,unknown>
const writes=vi.fn()
const filters=vi.fn()
function builder(table:string) {
  let id:string|undefined
  let value:unknown = []
  const query:Record<string,unknown>={}
  for (const method of ['select','order','limit','range','gt','gte','lte','ilike','in']) query[method]=(...args:unknown[])=>{filters(table,method,...args);return query}
  query.eq=(key:string,input:string)=>{if(key==='id')id=input;filters(table,'eq',key,input);return query}
  for(const method of ['insert','update']) query[method]=(input:unknown)=>{writes(table,method,input);value={id:targetId,...(typeof input==='object'?input:{}),occurred_at:'2026-10-11T00:00:00Z'};return query}
  const result=(single=false)=>({data:table==='profiles'?(single?(id===actorId?{...actor}:target):[target]):table==='account_audit'?[]:value,error:null})
  query.maybeSingle=query.single=()=>Promise.resolve(result(true))
  query.then=(resolve:(result:unknown)=>unknown)=>Promise.resolve(result()).then(resolve)
  return query
}
function app() {
  const app=express()
  app.use(express.json());app.use('/api/v1',routes)
  app.get('/api/v1/unapproved',requireAuth,(_req,res)=>res.sendStatus(204))
  app.use(errorHandler)
  return app
}
function call(method:string,path:string,body:object={}) {
  const agent=request(app())
  const req=method==='GET'?agent.get(path):method==='POST'?agent.post(path):method==='PUT'?agent.put(path):method==='DELETE'?agent.delete(path):agent.patch(path)
  return req.set('Authorization','Bearer synthetic-token').send(body)
}
beforeEach(()=>{
  vi.clearAllMocks()
  actor={id:actorId,role:'Administrator',status:'Active',email:'actor@example.test',full_name:'Synthetic actor'}
  target={id:targetId,role:'Viewer',status:'Active',email:'target@example.test',full_name:'Synthetic target'}
  mock.getUser.mockResolvedValue({data:{user:{id:actorId,user_metadata:{role:'Super Administrator'}}},error:null})
  const session={access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600,user:{id:actorId}}
  mock.signIn.mockResolvedValue({data:{session},error:null});mock.refresh.mockResolvedValue({data:{session},error:null})
  mock.from.mockImplementation(builder);mock.rpc.mockResolvedValue({data:target,error:null})
  mock.create.mockResolvedValue({data:{user:{id:targetId}},error:null});mock.delete.mockResolvedValue({error:null})
})

describe('current trusted profile and sessions',()=>{
  for (const role of roles) it(`${role} reads own profile`,async()=>{
    actor.role=role
    const res=await call('GET','/api/v1/auth/me')
    expect(res.status).toBe(200);expect(res.body.role).toBe(role)
  })
  it('metadata cannot promote Viewer',async()=>{
    actor.role='Viewer'
    expect((await call('GET','/api/v1/users')).status).toBe(403)
    expect((await call('GET','/api/v1/auth/me')).body.role).toBe('Viewer')
  })
  it('unauthenticated and invalid tokens receive 401',async()=>{
    expect((await request(app()).get('/api/v1/auth/me')).status).toBe(401)
    mock.getUser.mockResolvedValue({data:{user:null},error:{message:'invalid'}})
    expect((await call('GET','/api/v1/auth/me')).status).toBe(401)
  })
  it('deactivation immediately blocks an existing token',async()=>{
    expect((await call('GET','/api/v1/auth/me')).status).toBe(200)
    actor.status='Inactive'
    expect((await call('GET','/api/v1/auth/me')).status).toBe(401)
    expect((await call('GET','/api/v1/telemetry')).status).toBe(401)
  })
  for (const endpoint of ['login','refresh']) it(`inactive ${endpoint} never returns credentials`,async()=>{
    actor.status='Inactive'
    const res=await request(app()).post(`/api/v1/auth/${endpoint}`).send(endpoint==='login'?{email:'actor@example.test',password:'synthetic'}:{refreshToken:'synthetic'})
    expect(res.status).toBe(401);expect(res.body.token).toBeUndefined();expect(res.body.refreshToken).toBeUndefined()
  })
  it('missing or unknown-role profile fails closed',async()=>{
    actor.role='Owner';expect((await call('GET','/api/v1/auth/me')).status).toBe(401)
    mock.from.mockReturnValue({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})})
    expect((await call('GET','/api/v1/auth/me')).status).toBe(401)
  })
  it('profile database failure returns 503',async()=>{
    mock.from.mockReturnValue({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:{code:'offline'}})})})})
    expect((await call('GET','/api/v1/auth/me')).status).toBe(503)
  })
  it('streams close after deactivation',async()=>{
    actor.status='Inactive'
    const res={writableEnded:false,destroyed:false,end:vi.fn()} as unknown as Response
    expect(await streamAuthorized({authToken:'synthetic-token'} as Request,res)).toBe(false)
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('"status":401'))
  })
})

describe('real protected routers',()=>{
  const denied=[['POST','test-runs'],['PATCH',`test-runs/${targetId}/complete`],['PATCH',`test-runs/${targetId}/notes`],['POST','calibration'],['POST','laboratory-validation'],['PATCH',`laboratory-validation/${targetId}/result`],['POST','maintenance/records'],['POST','maintenance/reminders'],['PATCH',`maintenance/reminders/${targetId}/dismiss`],['PATCH',`alerts/${targetId}/acknowledge`],['PATCH',`alerts/${targetId}/resolve`],['PUT','settings'],['POST','devices'],['GET','export/csv']]
  for (const [method,path] of denied) it(`Viewer denied ${method} ${path} before writes`,async()=>{
    actor.role='Viewer'
    expect((await call(method!,`/api/v1/${path}`)).status).toBe(403)
    expect(writes).not.toHaveBeenCalled();expect(mock.rpc).not.toHaveBeenCalled()
  })
  for (const role of ['Researcher','Administrator','Super Administrator']) it(`${role} creates maintenance research records`,async()=>{
    actor.role=role
    expect((await call('POST','/api/v1/maintenance/records',{component:'Synthetic fixture',notes:'No hardware'})).status).toBe(201)
    expect(writes).toHaveBeenCalledWith('maintenance_records','insert',expect.objectContaining({performed_by:actorId}))
  })
  for (const path of [`alerts/${targetId}/acknowledge`,`alerts/${targetId}/resolve`,'settings','devices']) it(`Researcher denied administrative ${path}`,async()=>{
    actor.role='Researcher'
    expect((await call(path==='settings'?'PUT':path==='devices'?'POST':'PATCH',`/api/v1/${path}`)).status).toBe(403)
    expect(writes).not.toHaveBeenCalled()
  })
  for (const role of roles) it(`${role} cannot use unapproved settings or endpoints`,async()=>{
    actor.role=role
    for (const path of ['thresholds','data-retention','notifications/providers',`devices/${targetId}/config`]) expect((await call('PUT',`/api/v1/${path}`)).status).toBe(403)
    expect((await call('GET','/api/v1/unapproved')).status).toBe(403)
  })
})

describe('account management API',()=>{
  for (const role of roles) it(`${role} directory and audit permissions`,async()=>{
    actor.role=role
    expect((await call('GET','/api/v1/users')).status).toBe(['Administrator','Super Administrator'].includes(role)?200:403)
    expect((await call('GET','/api/v1/users/AUDIT')).status).toBe(role==='Super Administrator'?200:403)
  })
  it('Administrator directory scoped; privileged details denied',async()=>{
    await call('GET','/api/v1/users?search=target&role=Viewer&status=Active&limit=25')
    expect(filters).toHaveBeenCalledWith('profiles','in','role',['Researcher','Viewer'])
    expect(filters).toHaveBeenCalledWith('profiles','ilike','email','%target%')
    target.role='Administrator';expect((await call('GET',`/api/v1/users/${targetId}`)).status).toBe(403)
  })
  it('create omits role metadata and finalizes via audited RPC',async()=>{
    const res=await call('POST','/api/v1/users',{name:'Synthetic user',email:'new@example.test',password:'synthetic-long-passphrase',role:'Researcher'})
    expect(res.status).toBe(201)
    expect(mock.create.mock.calls[0]![0].user_metadata).toEqual({full_name:'Synthetic user'})
    expect(mock.rpc).toHaveBeenCalledWith('manage_account',expect.objectContaining({p_actor_id:actorId,p_target_id:targetId,p_action:'create',p_value:'Researcher'}))
    expect(res.body.password).toBeUndefined()
  })
  it('only Super Administrator creates Administrator',async()=>{
    const input={name:'Synthetic user',email:'new@example.test',password:'synthetic-long-passphrase',role:'Administrator'}
    expect((await call('POST','/api/v1/users',input)).status).toBe(403);expect(mock.create).not.toHaveBeenCalled()
    actor.role='Super Administrator';expect((await call('POST','/api/v1/users',input)).status).toBe(201)
  })
  it('rejects public Super Administrator selection, invalid roles/status/passwords',async()=>{
    for (const role of ['Super Administrator','Owner','']) expect((await call('PATCH',`/api/v1/users/${targetId}/role`,{role})).status).toBe(400)
    expect((await call('PATCH',`/api/v1/users/${targetId}/status`,{status:'Suspended'})).status).toBe(400)
    expect((await call('POST','/api/v1/users',{name:'Test',email:'new@example.test',password:'short',role:'Viewer'})).status).toBe(400)
    expect(mock.rpc).not.toHaveBeenCalled();expect(mock.create).not.toHaveBeenCalled()
  })
  it('database guard denial prevents Auth deletion',async()=>{
    mock.rpc.mockResolvedValue({data:null,error:{code:'42501',message:'last administrator'}})
    expect((await call('DELETE',`/api/v1/users/${targetId}`)).status).toBe(403);expect(mock.delete).not.toHaveBeenCalled()
  })
  it('role/status use trusted actor and audit transaction RPC',async()=>{
    for (const [action,value] of [['role','Researcher'],['status','Inactive']]) {
      expect((await call('PATCH',`/api/v1/users/${targetId}/${action}`,{[action!]:value,actor_id:targetId})).status).toBe(400)
      expect((await call('PATCH',`/api/v1/users/${targetId}/${action}`,{[action!]:value})).status).toBe(200)
      expect(mock.rpc).toHaveBeenCalledWith('manage_account',expect.objectContaining({p_actor_id:actorId,p_action:action,p_value:value}))
    }
  })
  it('deletion reserves before Auth and reports partial failure',async()=>{
    mock.delete.mockResolvedValue({error:{message:'unavailable'}})
    const res=await call('DELETE',`/api/v1/users/${targetId}`)
    expect(res.status).toBe(503);expect(res.body.error).toContain('remains blocked')
    expect(mock.rpc.mock.invocationCallOrder[0]).toBeLessThan(mock.delete.mock.invocationCallOrder[0]!)
  })
  it('successful deletion returns 204; audit-read uses audit table',async()=>{
    expect((await call('DELETE',`/api/v1/users/${targetId}`)).status).toBe(204)
    actor.role='Super Administrator'
    expect((await call('GET','/api/v1/users/audit')).status).toBe(200);expect(mock.from).toHaveBeenCalledWith('account_audit')
  })
  it('bad pagination, IDs and filters rejected',async()=>{
    for (const path of ['users?limit=-1','users?offset=1.5','users?role=Owner','users/not-a-uuid']) expect((await call('GET',`/api/v1/${path}`)).status).toBe(400)
  })
})
