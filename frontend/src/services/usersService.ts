import { usersMock } from '../data/mock/recordsMock'
import type { User } from '../types'
import { clone } from './mockStore'

export interface UsersService { getUsers():Promise<User[]> }
export const usersService:UsersService={getUsers:async()=>clone(usersMock)}
