import { Bell,ChartNoAxesCombined,ChevronLeft,FlaskConical,Gauge,History,PanelLeftOpen,Settings,SlidersHorizontal,Wrench,X } from 'lucide-react'
import type { RefObject } from 'react'
import { SidebarNavItem } from './SidebarNavItem'
const navigation=[{to:'/dashboard',label:'Dashboard',icon:Gauge},{to:'/history',label:'History',icon:History},{to:'/alerts',label:'Alerts',icon:Bell},{to:'/test-runs',label:'Test Runs',icon:FlaskConical},{to:'/calibration',label:'Calibration',icon:SlidersHorizontal},{to:'/laboratory-validation',label:'Laboratory Validation',icon:ChartNoAxesCombined},{to:'/maintenance',label:'Maintenance',icon:Wrench},{to:'/settings',label:'Settings',icon:Settings}]

export function Sidebar({mobile=false,open=false,expanded,drawerRef,onClose,onToggle}:{mobile?:boolean;open?:boolean;expanded:boolean;drawerRef?:RefObject<HTMLElement|null>;onClose?:()=>void;onToggle?:()=>void}){
  const visibleExpanded=mobile||expanded
  return <aside ref={drawerRef} id={mobile?'mobile-navigation':undefined} role={mobile?'dialog':undefined} aria-modal={mobile?true:undefined} className={`${mobile?`mobile-sidebar ${open?'translate-x-0':'-translate-x-full'}`:`desktop-sidebar ${expanded?'w-64':'w-20'}`} sidebar`} aria-label="Primary navigation">
    <div className="sidebar-brand">
      <div className="flex min-w-0 items-center gap-3">
        <span className="brand-mark" aria-hidden="true"><img src="/safe-logo.png" alt="" width="1254" height="1254"/></span>
        <div className={`min-w-0 transition-opacity ${visibleExpanded?'opacity-100':'lg:w-0 lg:opacity-0'}`}>
          <div className="truncate text-sm font-bold tracking-tight text-ink">S.A.F.E</div>
          <div className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-muted">Research console</div>
        </div>
      </div>
      {mobile&&<button type="button" className="icon-button" onClick={onClose} aria-label="Close navigation"><X size={18}/></button>}
    </div>
    <div className={`sidebar-section-label ${visibleExpanded?'':'lg:justify-center'}`}><span className={visibleExpanded?'':'sr-only'}>Monitoring workspace</span>{!visibleExpanded&&<span aria-hidden="true">•••</span>}</div>
    <nav className="flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-3" aria-label="Application pages">
      {navigation.map((item)=><SidebarNavItem key={item.to} {...item} expanded={visibleExpanded} onNavigate={onClose}/>) }
    </nav>
    <div className="sidebar-footer">
      <div className={`controller-card ${visibleExpanded?'':'items-center px-2'}`}>
        <div className="flex items-center gap-2"><span className="status-dot bg-slate-400"/><span className={`text-[10px] font-semibold uppercase tracking-[0.08em] text-muted ${visibleExpanded?'':'sr-only'}`}>Device profile</span></div>
        <div className={`mono mt-2 text-xs font-semibold text-ink ${visibleExpanded?'':'sr-only'}`}>ESP32-WROOM-32 · planned</div>
        <div className={`mt-1 text-xs text-muted ${visibleExpanded?'':'sr-only'}`}>Connection not confirmed</div>
      </div>
      {!mobile&&<button type="button" className="sidebar-toggle" onClick={onToggle} aria-label={expanded?'Collapse navigation':'Expand navigation'} aria-expanded={expanded}>
        {expanded?<ChevronLeft size={17}/>:<PanelLeftOpen size={17}/>}<span className={expanded?'':'sr-only'}>Collapse navigation</span>
      </button>}
    </div>
  </aside>
}
