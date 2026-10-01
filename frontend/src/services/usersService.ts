import type { User } from '../types'
import { apiRequest } from './apiClient'

export interface UsersService { getUsers():Promise<User[]> }
export const usersService:UsersService={getUsers:()=>apiRequest<User[]>('users')}
