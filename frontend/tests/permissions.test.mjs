import test from 'node:test'
import assert from 'node:assert/strict'
import { hasPermission, manageableRoles, canManageAccount, userRoles } from '../src/utils/permissions.ts'

for (const role of userRoles) {
  test(`${role}: UI permission matrix and permitted role selector`, () => {
    const user={id:'synthetic-actor',name:'Synthetic actor',email:'actor@example.test',role,status:'Active'}
    const manager=['Administrator','Super Administrator'].includes(role)
    assert.equal(hasPermission(user,'research.write'),role!=='Viewer')
    assert.equal(hasPermission(user,'research.export'),role!=='Viewer')
    for (const permission of ['alerts.manage','settings.manage','users.manage']) assert.equal(hasPermission(user,permission),manager)
    assert.equal(hasPermission(user,'audit.read'),role==='Super Administrator')
    assert.equal(hasPermission(user,'unapproved'),false)
    assert.ok(!manageableRoles(user).includes('Super Administrator'))
    assert.equal(manageableRoles(user).includes('Administrator'),role==='Super Administrator')
    assert.equal(canManageAccount(user,{...user,id:'other',role:'Viewer'}),manager)
    assert.equal(canManageAccount(user,{...user,id:'other',role:'Administrator'}),role==='Super Administrator')
    assert.equal(canManageAccount(user,{...user,id:'other',role:'Super Administrator'}),false)
    assert.equal(canManageAccount(user,user),false)
    assert.equal(hasPermission({...user,status:'Inactive'},'users.manage'),false)
  })
}
test('missing and unknown role never displays privileged controls',()=>{
  assert.equal(hasPermission(null,'users.manage'),false)
  assert.deepEqual(manageableRoles(null),[])
  assert.equal(hasPermission({role:'Owner',status:'Active'},'users.manage'),false)
})
