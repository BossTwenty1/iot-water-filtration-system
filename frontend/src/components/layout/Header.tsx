import { Bell,LogOut,Menu,UserRound } from 'lucide-react'
import { Link,useLocation } from 'react-router-dom'
import type { RefObject } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { signOut } from '../../services/apiClient'
import type { ThemeMode } from '../../hooks/useTheme'
import { ThemeToggle } from '../common/ThemeToggle'

const pageNames:Record<string,string>={dashboard:'Dashboard',history:'Telemetry History',alerts:'System Alerts','test-runs':'Test Runs',calibration:'Sensor Calibration','laboratory-validation':'Laboratory Validation',maintenance:'Maintenance',settings:'Settings'}

export function Header({onMenu,mobileOpen,menuButtonRef,theme,onThemeToggle}:{onMenu:()=>void;mobileOpen:boolean;menuButtonRef:RefObject<HTMLButtonElement|null>;theme:ThemeMode;onThemeToggle:()=>void}){
  const auth=useAuth()
  const user=auth.status==='authenticated'?auth.user:null
  const location=useLocation()
  const segment=location.pathname.split('/').filter(Boolean)[0]??'dashboard'
  const pageName=pageNames[segment]??'Dashboard'
  return <header className="app-header flex-wrap">
    <div className="flex min-w-0 items-center gap-3">
      <button ref={menuButtonRef} className="icon-button mobile-menu-trigger" type="button" onClick={onMenu} aria-label="Open navigation" aria-controls="mobile-navigation" aria-expanded={mobileOpen}><Menu size={19}/></button>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-ink sm:text-base">{pageName}</div>
        <div className="hidden truncate text-xs text-muted sm:block">IoT Embedded Water Filtration System</div>
      </div>
    </div>
    <div className="flex w-full shrink-0 items-center justify-end gap-2 md:w-auto">
      <div className="device-chip" aria-label="API-backed records; physical device connection is not verified" title="API records · physical device connection not verified"><span className="status-dot bg-slate-400" aria-hidden="true"/><span className="hidden sm:inline">API records</span><span className="sm:hidden">API data</span></div>
      <Link to="/alerts" className="icon-button relative" aria-label="Open system alerts" title="System alerts"><Bell size={17}/></Link>
      <ThemeToggle theme={theme} onToggle={onThemeToggle}/>
      {user&&<>
        <div className="flex min-w-0 items-center gap-2" title={user.email}>
          <UserRound size={18} className="shrink-0 text-muted" aria-hidden="true"/>
          <span className="sr-only md:not-sr-only md:max-w-32 md:truncate md:text-xs">{user.name||user.email||user.id}</span>
        </div>
        <button type="button" className="icon-button" aria-label="Sign out" title="Sign out" onClick={()=>void signOut()}><LogOut size={17} aria-hidden="true"/></button>
      </>}
    </div>
  </header>
}
