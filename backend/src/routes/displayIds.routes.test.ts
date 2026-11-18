import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { chainable, ok } from '../__tests__/helpers/supabaseMock'

const {from}=vi.hoisted(()=>({from:vi.fn()}))
vi.mock('../config/supabaseClient',()=>({supabaseAdmin:{from}}))
vi.mock('../middleware/auth',()=>({requireAuth:(req:express.Request,_res:express.Response,next:express.NextFunction)=>{req.profile={id:'user-uuid'} as express.Request['profile'];next()}}))
import alertsRouter from './alerts.routes'
import telemetryRouter from './telemetry.routes'
import usersRouter from './users.routes'
import { errorHandler } from '../middleware/errorHandler'

const app=express()
app.use(express.json())
app.use('/alerts',alertsRouter)
app.use('/telemetry',telemetryRouter)
app.use('/users',usersRouter)
app.use(errorHandler)
beforeEach(()=>from.mockReset())

describe('display IDs in API records',()=>{
  it('adds readable audit account numbers without changing the stored UUIDs',async()=>{
    from.mockReturnValueOnce(chainable(ok([{id:'audit-event',actor_id:'actor-uuid',target_id:'target-uuid'}])))
      .mockReturnValueOnce(chainable(ok([{id:'actor-uuid',display_number:1},{id:'target-uuid',display_number:2}])))
    const response=await request(app).get('/users/audit').expect(200)
    expect(response.body[0]).toMatchObject({actor_id:'actor-uuid',target_id:'target-uuid',actorDisplayId:'User 0001',targetDisplayId:'User 0002'})
  })
  it('does not invent account numbers for deleted audit accounts',async()=>{
    from.mockReturnValueOnce(chainable(ok([{id:'audit-event',actor_id:null,target_id:'deleted-uuid'}])))
      .mockReturnValueOnce(chainable(ok([])))
    const response=await request(app).get('/users/audit').expect(200)
    expect(response.body[0]).toEqual({id:'audit-event',actor_id:null,target_id:'deleted-uuid'})
  })
  const id='c46b7644-3d0e-4231-9062-b1fac4ad64f3'
  const testId='fb9f5e84-ada9-4277-bb01-95b8a131c3cb'
  const alert={id,display_number:3,test_run_id:testId,test_run:{display_number:1},status:'Active',severity:'Warning'}
  it('includes stable own and related labels in list responses',async()=>{
    from.mockReturnValueOnce(chainable(ok([alert])))
    const response=await request(app).get('/alerts').expect(200)
    expect(response.body[0]).toMatchObject({id,displayId:'Alert 0003',testRunId:testId,testRunDisplayId:'Test 0001'})
  })
  it.each([['acknowledge','Acknowledged'],['resolve','Resolved']])('keeps UUID requests and labels after %s',async(action,status)=>{
    const updated=chainable(ok({...alert,status}))
    const eq=vi.fn(()=>updated);updated.eq=eq
    from.mockReturnValueOnce(chainable(ok(alert))).mockReturnValueOnce(updated).mockReturnValueOnce(chainable(ok(null)))
    const response=await request(app).patch(`/alerts/${id}/${action}`).expect(200)
    expect(eq).toHaveBeenCalledWith('id',id)
    expect(response.body).toMatchObject({id,displayId:'Alert 0003',testRunId:testId,testRunDisplayId:'Test 0001',status})
  })
  it('includes test/device labels while retaining the grouped record key',async()=>{
    from.mockReturnValueOnce(chainable(ok([{
      device_id:'device-uuid',test_run_id:testId,measured_at:'2026-10-27T00:00:00Z',value:7,
      sensor:{category:'ph',position:'pre_filtration',unit:'pH'},test_run:{display_number:1},device:{display_number:2},
    }])))
    const response=await request(app).get('/telemetry').expect(200)
    expect(response.body[0]).toMatchObject({id:`device-uuid|${testId}|2026-10-27T00:00:00Z`,testRunId:testId,testRunDisplayId:'Test 0001',deviceId:'device-uuid',deviceDisplayId:'Device 0002',before:{pH:7}})
  })
})
