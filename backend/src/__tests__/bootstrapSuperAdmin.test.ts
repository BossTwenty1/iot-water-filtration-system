import { beforeEach, expect, it, vi } from 'vitest'
const mock=vi.hoisted(()=>({from:vi.fn(),identity:vi.fn(),rpc:vi.fn()}))
vi.mock('../config/supabaseClient',()=>({supabaseAdmin:{from:mock.from,auth:{admin:{getUserById:mock.identity}},rpc:mock.rpc}}))
import { bootstrapSuperAdmin } from '../../scripts/bootstrapSuperAdmin'
beforeEach(()=>{
  vi.clearAllMocks()
  mock.from.mockReturnValue({select:()=>({ilike:async()=>({data:[{id:'synthetic-id'}],error:null})})})
  mock.identity.mockResolvedValue({data:{user:{email:'designated@example.test',email_confirmed_at:'2026-10-11'}},error:null})
  mock.rpc.mockResolvedValue({error:null})
})
const designation=['--email','designated@example.test','--reason','Synthetic client-approved designation']
it('help makes no identity or database call',async()=>{
  await bootstrapSuperAdmin(['--help']);expect(mock.from).not.toHaveBeenCalled();expect(mock.rpc).not.toHaveBeenCalled()
})
it.each([[],['--apply','--dry-run'],['--unknown'],['--email'],['--apply','--apply']])('unsafe/incomplete flags fail before reads: %j',async(...flags)=>{
  await expect(bootstrapSuperAdmin([...designation,...flags])).rejects.toThrow()
  expect(mock.from).not.toHaveBeenCalled();expect(mock.rpc).not.toHaveBeenCalled()
})
it('dry-run verifies the exact identity without promotion',async()=>{
  await bootstrapSuperAdmin([...designation,'--dry-run']);expect(mock.identity).toHaveBeenCalledWith('synthetic-id');expect(mock.rpc).not.toHaveBeenCalled()
})
it('apply calls only guarded provisioning with explicit reason',async()=>{
  await bootstrapSuperAdmin([...designation,'--apply'])
  expect(mock.rpc).toHaveBeenCalledWith('provision_super_administrator',{p_target_id:'synthetic-id',p_reason:designation[3],p_authorizer_id:null})
})
it('unconfirmed or mismatched Auth identity cannot be promoted',async()=>{
  mock.identity.mockResolvedValue({data:{user:{email:'other@example.test',email_confirmed_at:null}},error:null})
  await expect(bootstrapSuperAdmin([...designation,'--apply'])).rejects.toThrow();expect(mock.rpc).not.toHaveBeenCalled()
})
it('database guard denial never reports success',async()=>{
  mock.rpc.mockResolvedValue({error:{code:'42501'}})
  await expect(bootstrapSuperAdmin([...designation,'--apply'])).rejects.toThrow('Provisioning denied')
})
