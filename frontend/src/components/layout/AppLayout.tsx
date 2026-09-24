import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
export function AppLayout() { const [mobileOpen,setMobileOpen]=useState(false); return <div className="min-h-screen bg-canvas"><a className="skip-link" href="#main-content">Skip to main content</a><Sidebar/>{mobileOpen&&<><Sidebar mobile open onClose={()=>setMobileOpen(false)}/><button type="button" className="fixed inset-0 z-[60] bg-slate-950/30 lg:hidden" aria-label="Close navigation" onClick={()=>setMobileOpen(false)}/></>}<Header onMenu={()=>setMobileOpen(true)}/><main id="main-content" className="min-h-screen overflow-x-hidden px-3 pb-8 pt-20 sm:px-5 lg:ml-64"><div className="mx-auto max-w-[1500px]"><Outlet/></div></main></div> }
