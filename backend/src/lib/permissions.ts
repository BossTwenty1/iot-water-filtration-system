import type { UserRole } from '../types/domain'

export const roles = ['Super Administrator', 'Administrator', 'Researcher', 'Viewer'] as const
export type Permission = 'read' | 'research.write' | 'research.export' | 'alerts.manage' | 'settings.manage' | 'devices.manage' | 'users.manage' | 'audit.read'
const grants: Record<UserRole, readonly Permission[]> = {
  Viewer: ['read'],
  Researcher: ['read', 'research.write', 'research.export'],
  Administrator: ['read', 'research.write', 'research.export', 'alerts.manage', 'settings.manage', 'devices.manage', 'users.manage'],
  'Super Administrator': ['read', 'research.write', 'research.export', 'alerts.manage', 'settings.manage', 'devices.manage', 'users.manage', 'audit.read'],
}
export function isRole(value: unknown): value is UserRole { return roles.some(role => role === value) }
export function hasPermission(role: unknown, permission: Permission): boolean { return isRole(role) && grants[role].includes(permission) }
export function canManageAccount(actor: { id: string; role?: string | null }, target: { id: string; role?: string | null }, nextRole = target.role): boolean {
  if (actor.id === target.id || !isRole(target.role) || !isRole(nextRole) || nextRole === 'Super Administrator' || target.role === 'Super Administrator') return false
  return actor.role === 'Super Administrator' || (actor.role === 'Administrator' && ['Researcher', 'Viewer'].includes(target.role) && ['Researcher', 'Viewer'].includes(nextRole))
}

// Explicit endpoint allowlist: a new protected endpoint gets no permission by accident.
export function routePermission(method: string, url: string): Permission | null {
  // Express routes are case-insensitive by default; authorization must match.
  const path = url.split('?')[0]?.replace(/\/$/, '').toLowerCase() ?? ''
  if (method === 'GET' && /^\/api\/v1\/(dashboard(?:\/[^/]+)?|telemetry(?:\/[^/]+)?|alerts(?:\/[^/]+)?|test-runs(?:\/[^/]+)?|calibration(?:\/[^/]+(?:\/history)?)?|laboratory-validation(?:\/[^/]+)?|maintenance\/(records|reminders)|devices(?:\/[^/]+(?:\/status)?)?|realtime\/stream|settings|thresholds|data-retention|auth\/me)$/.test(path)) return 'read'
  if (method === 'POST' && path === '/api/v1/auth/logout') return 'read'
  if (method === 'GET' && path === '/api/v1/export/csv') return 'research.export'
  if (path === '/api/v1/users/audit' && method === 'GET') return 'audit.read'
  if (/^\/api\/v1\/users(?:\/[^/]+(?:\/(role|status))?)?$/.test(path) && ['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) return 'users.manage'
  if ((method === 'POST' && /^\/api\/v1\/(test-runs|calibration|laboratory-validation|maintenance\/(records|reminders))$/.test(path)) || (method === 'PATCH' && /^\/api\/v1\/(test-runs\/[^/]+\/(complete|notes)|laboratory-validation\/[^/]+\/result|maintenance\/reminders\/[^/]+\/dismiss)$/.test(path))) return 'research.write'
  if (method === 'PATCH' && /^\/api\/v1\/alerts\/[^/]+\/(acknowledge|resolve)$/.test(path)) return 'alerts.manage'
  if (method === 'PUT' && path === '/api/v1/settings') return 'settings.manage'
  if (method === 'POST' && path === '/api/v1/devices') return 'devices.manage'
  return null
}
