import { useState,type FormEvent } from 'react'
import { Navigate,useLocation,useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { signIn } from '../services/apiClient'
import { useTheme } from '../hooks/useTheme'
import { ThemeToggle } from '../components/common/ThemeToggle'

export function LoginPage(){
  const auth=useAuth()
  const {theme,toggleTheme}=useTheme()
  const location=useLocation()
  const navigate=useNavigate()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const intended=(location.state as {from?:unknown}|null)?.from
  const destination=typeof intended==='string'&&intended.startsWith('/')&&!intended.startsWith('//')&&intended!=='/login'?intended:'/dashboard'

  if(auth.status==='loading')return <div className="panel mx-auto mt-24 max-w-md p-6" role="status">Restoring session…</div>
  if(auth.status==='authenticated')return <Navigate to={destination} replace/>

  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault()
    setError(null)
    setBusy(true)
    try{await signIn(email.trim(),password);void navigate(destination,{replace:true})}
    catch(cause){setError(cause instanceof Error?cause.message:'Unable to sign in.')}
    finally{setBusy(false)}
  }

  return <><a className="skip-link" href="#main-content">Skip to sign in</a><main id="main-content" className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10"><div className="panel w-full max-w-md p-6 sm:p-8">
    <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="brand-mark" aria-hidden="true"><img src="/safe-logo.png" alt="" width="1254" height="1254"/></span><div><div className="text-sm font-semibold text-ink">S.A.F.E</div><div className="text-xs text-muted">Research console</div></div></div><ThemeToggle theme={theme} onToggle={toggleTheme}/></div>
    <h1 className="mt-3 text-2xl font-semibold">Sign in</h1>
    <p className="mt-2 text-sm text-muted">Use your project account to access the dashboard.</p>
    {auth.notice&&<div className="notice mt-5" role="status">{auth.notice}</div>}
    {error&&<div id="login-error" className="notice mt-5 bg-red-50 text-danger" role="alert">{error}</div>}
    <form className="mt-6 space-y-4" onSubmit={(event)=>void submit(event)}>
      <div className="field"><label htmlFor="login-email">Email</label><input id="login-email" name="email" className="control" type="email" autoComplete="username" required value={email} onChange={(event)=>setEmail(event.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="login-password">Password</label><input id="login-password" name="password" className="control" type="password" autoComplete="current-password" required value={password} onChange={(event)=>setPassword(event.target.value)} disabled={busy}/></div>
      <button className="button-primary w-full" type="submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
    </form>
    <p className="mt-5 text-xs leading-relaxed text-muted">Signing in verifies your account, not device connectivity. Dashboard readings remain representative until live telemetry is integrated.</p>
  </div></main></>
}
