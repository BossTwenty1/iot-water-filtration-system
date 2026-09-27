import { useEffect,useRef,useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppLayout(){
  const [mobileOpen,setMobileOpen]=useState(false)
  const [sidebarExpanded,setSidebarExpanded]=useState(false)
  const {theme,toggleTheme}=useTheme()
  const mobileDrawerRef=useRef<HTMLElement>(null)
  const menuButtonRef=useRef<HTMLButtonElement>(null)

  useEffect(()=>{
    if(!mobileOpen)return
    const previousOverflow=document.body.style.overflow
    const menuButton=menuButtonRef.current
    document.body.style.overflow='hidden'
    const focusable=()=>Array.from(mobileDrawerRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')??[])
    focusable()[0]?.focus()
    const handleKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){setMobileOpen(false);return}
      if(event.key!=='Tab')return
      const items=focusable()
      if(items.length===0)return
      const first=items[0]
      const last=items[items.length-1]
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
    window.addEventListener('keydown',handleKey)
    return()=>{window.removeEventListener('keydown',handleKey);document.body.style.overflow=previousOverflow;menuButton?.focus()}
  },[mobileOpen])

  return <div className="app-shell min-h-screen bg-canvas">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <Sidebar expanded={sidebarExpanded} onToggle={()=>setSidebarExpanded((value)=>!value)}/>
    {mobileOpen&&<>
      <Sidebar mobile open expanded drawerRef={mobileDrawerRef} onClose={()=>setMobileOpen(false)}/>
      <button type="button" className="sidebar-backdrop" aria-label="Close navigation" onClick={()=>setMobileOpen(false)}/>
    </>}
    <div className={`app-main ${sidebarExpanded?'lg:ml-64':'lg:ml-20'}`}>
      <Header menuButtonRef={menuButtonRef} mobileOpen={mobileOpen} theme={theme} onMenu={()=>setMobileOpen(true)} onThemeToggle={toggleTheme}/>
      <main id="main-content" className="app-content"><Outlet/></main>
    </div>
  </div>
}
