import { Bell,LogOut,Menu,UserRound } from 'lucide-react'
import { Link,useLocation } from 'react-router-dom'
import type { RefObject } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useRealtime } from '../../hooks/useRealtime'
import { signOut } from '../../services/apiClient'
import type { ThemeMode } from '../../hooks/useTheme'
import { ThemeToggle } from '../common/ThemeToggle'

const pageNames:Record<string,string>={dashboard:'Dashboard',history:'Telemetry History',alerts:'System Alerts','test-runs':'Test Runs',calibration:'Sensor Calibration','laboratory-validation':'Laboratory Validation',maintenance:'Maintenance',settings:'Settings'}

export function Header({onMenu,mobileOpen,menuButtonRef,theme,onThemeToggle}:{onMenu:()=>void;mobileOpen:boolean;menuButtonRef:RefObject<HTMLButtonElement|null>;theme:ThemeMode;onThemeToggle:()=>void}){
  const auth=useAuth()
  const user=auth.status==='authenticated'?auth.user:null
  const { connectionStatus, latestDevice, activeAlertCount } = useRealtime()
  const location=useLocation()
  const segment=location.pathname.split('/').filter(Boolean)[0]??'dashboard'
  const pageName=pageNames[segment]??'Dashboard'

  const isOnline = latestDevice?.connection === 'Online'
  const isOffline = latestDevice?.connection === 'Offline'
  const dotColor = isOnline ? 'bg-emerald-500 animate-pulse' : isOffline ? 'bg-amber-500' : connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-slate-400'
  const deviceText = latestDevice?.deviceId ?? (connectionStatus === 'connected' ? 'Live Stream' : 'Connecting…')

  return <header className="app-header flex-wrap">
    <div className="flex min-w-0 items-center gap-3">
      <button ref={menuButtonRef} className="icon-button mobile-menu-trigger" type="button" onClick={onMenu} aria-label="Open navigation" aria-controls="mobile-navigation" aria-expanded={mobileOpen}><Menu size={19}/></button>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-ink sm:text-base">{pageName}</div>
        <div className="hidden truncate text-xs text-muted sm:block">IoT Embedded Water Filtration System</div>
      </div>
    </div>
    <div className="flex w-full shrink-0 items-center justify-end gap-2 md:w-auto">
      <div className="device-chip" aria-label={`Device: ${deviceText}`} title={latestDevice ? `${latestDevice.deviceId} (${latestDevice.connection}) · Stream: ${connectionStatus}` : `Stream: ${connectionStatus}`}><span className={`status-dot ${dotColor}`} aria-hidden="true"/><span className="hidden sm:inline">{deviceText}</span><span className="sm:hidden">{isOnline ? 'Online' : isOffline ? 'Offline' : 'Live'}</span></div>
      <Link to="/alerts" className="icon-button relative" aria-label={`Open system alerts${activeAlertCount > 0 ? ` (${activeAlertCount} active)` : ''}`} title="System alerts">
        <Bell size={17}/>
        {activeAlertCount > 0 && <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm" aria-label={`${activeAlertCount} active alerts`}>{activeAlertCount > 9 ? '9+' : activeAlertCount}</span>}
      </Link>
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
