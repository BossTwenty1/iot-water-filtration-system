import type { ReactNode } from 'react'
import { useTheme } from '../../hooks/useTheme'
import { ThemeToggle } from './ThemeToggle'

export function AuthPage({title,description,children}:{title:string;description:string;children:ReactNode}){
  const {theme,toggleTheme}=useTheme()
  return <><a className="skip-link" href="#main-content">Skip to form</a><main id="main-content" className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10"><div className="panel w-full max-w-md p-6 sm:p-8">
    <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="brand-mark" aria-hidden="true"><img src="/safe-logo.png" alt="" width="1254" height="1254"/></span><div><div className="text-sm font-semibold text-ink">S.A.F.E</div><div className="text-xs text-muted">Research dashboard</div></div></div><ThemeToggle theme={theme} onToggle={toggleTheme}/></div>
    <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
    <p className="mt-2 text-sm text-muted">{description}</p>
    {children}
  </div></main></>
}
