import type { User } from '../types'
import { apiRequest } from './apiClient'

export type ManagedUser = User & { deletionPending?:boolean }
export interface UserFilters { search?:string;role?:string;status?:string;offset?:number }
export interface AccountAudit { id:string;actor_id:string|null;target_id:string;actorDisplayId?:string;targetDisplayId?:string;action:string;old_role:string|null;new_role:string|null;old_status:string|null;new_status:string|null;reason:string|null;created_at:string }
export const usersService={
  getUsers:(filters:UserFilters={})=>{
    const query=new URLSearchParams({limit:'25',offset:String(filters.offset??0)})
    for(const key of ['search','role','status'] as const)if(filters[key])query.set(key,filters[key]!)
    return apiRequest<ManagedUser[]>(`users?${query}`)
  },
  getUser:(id:string)=>apiRequest<ManagedUser>(`users/${encodeURIComponent(id)}`),
  createUser:(input:{name:string;email:string;password:string;role:string})=>apiRequest<ManagedUser>('users',{method:'POST',body:input}),
  updateRole:(id:string,role:string)=>apiRequest<ManagedUser>(`users/${encodeURIComponent(id)}/role`,{method:'PATCH',body:{role}}),
  updateStatus:(id:string,status:'Active'|'Inactive')=>apiRequest<ManagedUser>(`users/${encodeURIComponent(id)}/status`,{method:'PATCH',body:{status}}),
  deleteUser:(id:string)=>apiRequest<void>(`users/${encodeURIComponent(id)}`,{method:'DELETE'}),
  getAudit:(offset=0)=>apiRequest<AccountAudit[]>(`users/audit?limit=25&offset=${offset}`),
}
