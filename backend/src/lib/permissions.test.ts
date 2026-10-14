import { describe, expect, it } from 'vitest'
import { canManageAccount, hasPermission, roles, routePermission } from './permissions'

describe('approved four-role software policy', () => {
  for (const role of roles) {
    it(`${role}: explicit permissions only`, () => {
      expect(hasPermission(role,'read')).toBe(true)
      expect(hasPermission(role,'research.write')).toBe(role !== 'Viewer')
      expect(hasPermission(role,'research.export')).toBe(role !== 'Viewer')
      for (const permission of ['alerts.manage','settings.manage','devices.manage','users.manage'] as const) expect(hasPermission(role,permission)).toBe(['Administrator','Super Administrator'].includes(role))
      expect(hasPermission(role,'audit.read')).toBe(role === 'Super Administrator')
    })
    for (const targetRole of roles) for (const nextRole of roles) {
      it(`${role} manages ${targetRole} -> ${nextRole}`, () => {
        const expected = targetRole !== 'Super Administrator' && nextRole !== 'Super Administrator' && (role === 'Super Administrator' || (role === 'Administrator' && ['Researcher','Viewer'].includes(targetRole) && ['Researcher','Viewer'].includes(nextRole)))
        expect(canManageAccount({id:'actor',role},{id:'target',role:targetRole},nextRole)).toBe(expected)
        expect(canManageAccount({id:'actor',role},{id:'actor',role:targetRole},nextRole)).toBe(false)
      })
    }
  }
  it('unknown/missing role has no access', () => {
    for (const role of ['Owner','admin',null,undefined]) expect(hasPermission(role,'read')).toBe(false)
  })
  it('unapproved writes and unknown routes deny by default', () => {
    for (const [method,path] of [['PUT','thresholds'],['PUT','data-retention'],['PUT','notifications/providers'],['GET','notifications/providers'],['PUT','devices/device/config'],['POST','pump/start'],['DELETE','test-runs/run'],['POST','new-feature']]) expect(routePermission(method!,`/api/v1/${path}`)).toBeNull()
    expect(routePermission('GET','/api/v1/users/AUDIT')).toBe('audit.read')
    expect(routePermission('GET','/api/v1/users/audit/?limit=25')).toBe('audit.read')
  })
})
