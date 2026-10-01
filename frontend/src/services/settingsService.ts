import type { AppSettings } from '../types'
import { apiRequest } from './apiClient'

export interface SettingsService { getSettings():Promise<AppSettings>; updateSettings(next:AppSettings):Promise<AppSettings> }

export const settingsService:SettingsService={
  getSettings:()=>apiRequest<AppSettings>('settings'),
  updateSettings:(next)=>apiRequest<AppSettings>('settings',{method:'PUT',body:next}),
}
