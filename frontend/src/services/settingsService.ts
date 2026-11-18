import type { AppSettings } from '../types'
import { apiRequest } from './apiClient'
import { dateTimeSettings } from '../utils/formatters'

export interface SettingsService { getSettings():Promise<AppSettings>; updateSettings(next:AppSettings):Promise<AppSettings> }

export const settingsService:SettingsService={
  getSettings:async()=>({...await apiRequest<AppSettings>('settings'),...dateTimeSettings}),
  updateSettings:(next)=>apiRequest<AppSettings>('settings',{method:'PUT',body:{...next,...dateTimeSettings}}),
}
