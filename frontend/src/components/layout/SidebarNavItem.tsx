import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export function SidebarNavItem({to,label,icon:Icon,expanded,onNavigate}:{to:string;label:string;icon:LucideIcon;expanded:boolean;onNavigate?:()=>void}){
  return <NavLink to={to} onClick={onNavigate} title={expanded?undefined:label} className={({isActive})=>`sidebar-link ${isActive?'sidebar-link-active':''}`}>
    <span className="sidebar-link-icon"><Icon size={18} strokeWidth={1.8} aria-hidden="true"/></span>
    <span className={`sidebar-label ${expanded?'opacity-100':'lg:w-0 lg:opacity-0'}`}>{label}</span>
  </NavLink>
}
