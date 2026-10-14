import { useAuth } from './useAuth'
import { hasPermission, type Permission } from '../utils/permissions'

export function usePermission(permission: Permission): boolean {
  const auth = useAuth()
  return hasPermission(auth.status === 'authenticated' ? auth.user : null, permission)
}
