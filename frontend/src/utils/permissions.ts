import type { User, UserRole } from '../types'

export type Permission = 'research.write' | 'research.export' | 'alerts.manage' | 'settings.manage' | 'users.manage' | 'audit.read'
export const userRoles: UserRole[] = ['Super Administrator','Administrator','Researcher','Viewer']
export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user || user.status !== 'Active' || !userRoles.includes(user.role)) return false
  if (permission === 'audit.read') return user.role === 'Super Administrator'
  if (permission === 'research.write' || permission === 'research.export') return user.role !== 'Viewer'
  return ['alerts.manage','settings.manage','users.manage'].includes(permission) && (user.role === 'Administrator' || user.role === 'Super Administrator')
}
export function manageableRoles(user: User | null): Exclude<UserRole,'Super Administrator'>[] {
  if (!hasPermission(user, 'users.manage')) return []
  return user?.role === 'Super Administrator' ? ['Administrator','Researcher','Viewer'] : ['Researcher','Viewer']
}
export function canManageAccount(actor: User | null, target: User): boolean {
  return actor?.id !== target.id && manageableRoles(actor).includes(target.role as Exclude<UserRole,'Super Administrator'>)
}
