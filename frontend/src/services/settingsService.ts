import { appSettingsMock } from '../data/mock/systemMock'
import type { AppSettings } from '../types'
import { clone } from './mockStore'

let settings=clone(appSettingsMock)

export interface SettingsService { getSettings():Promise<AppSettings>; updateSettings(next:AppSettings):Promise<AppSettings> }

export const settingsService:SettingsService={getSettings:async()=>clone(settings),updateSettings:async(next)=>{settings=clone(next);return clone(settings)}}
