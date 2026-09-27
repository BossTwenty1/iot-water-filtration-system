import { Bell,Menu } from 'lucide-react'
import { Link,useLocation } from 'react-router-dom'
import type { RefObject } from 'react'
import type { ThemeMode } from '../../hooks/useTheme'
import { ThemeToggle } from '../common/ThemeToggle'

const pageNames:Record<string,string>={dashboard:'Dashboard',history:'Telemetry History',alerts:'System Alerts','test-runs':'Test Runs',calibration:'Sensor Calibration','laboratory-validation':'Laboratory Validation',maintenance:'Maintenance',settings:'Settings'}

export function Header({onMenu,mobileOpen,menuButtonRef,theme,onThemeToggle}:{onMenu:()=>void;mobileOpen:boolean;menuButtonRef:RefObject<HTMLButtonElement|null>;theme:ThemeMode;onThemeToggle:()=>void}){
  const location=useLocation()
  const segment=location.pathname.split('/').filter(Boolean)[0]??'dashboard'
  const pageName=pageNames[segment]??'Dashboard'
  return <header className="app-header">
    <div className="flex min-w-0 items-center gap-3">
      <button ref={menuButtonRef} className="icon-button mobile-menu-trigger" type="button" onClick={onMenu} aria-label="Open navigation" aria-controls="mobile-navigation" aria-expanded={mobileOpen}><Menu size={19}/></button>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-ink sm:text-base">{pageName}</div>
        <div className="hidden truncate text-xs text-muted sm:block">IoT Embedded Water Filtration System</div>
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      <div className="device-chip" aria-label="Representative data only; live device connection is not confirmed" title="Representative data only · live device connection not confirmed"><span className="status-dot bg-slate-400" aria-hidden="true"/><span className="hidden sm:inline">Representative data</span><span className="sm:hidden">Sample data</span></div>
      <Link to="/alerts" className="icon-button relative" aria-label="Open system alerts" title="System alerts"><Bell size={17}/></Link>
      <ThemeToggle theme={theme} onToggle={onThemeToggle}/>
    </div>
  </header>
}
