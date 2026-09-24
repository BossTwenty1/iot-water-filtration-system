import { useState,type FormEvent } from 'react'
import { Navigate,useLocation,useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { signIn } from '../services/apiClient'

export function LoginPage(){
  const auth=useAuth()
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

  return <main id="main-content" className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10"><div className="panel w-full max-w-md p-6 sm:p-8">
    <div className="eyebrow text-hydro">AquaSense research console</div>
    <h1 className="mt-3 text-2xl font-semibold">Sign in</h1>
    <p className="mt-2 text-sm text-muted">Use your project account to access the dashboard.</p>
    {auth.notice&&<div className="notice mt-5" role="status">{auth.notice}</div>}
    {error&&<div className="notice mt-5 border-l-red-600 bg-red-50 text-danger" role="alert">{error}</div>}
    <form className="mt-6 space-y-4" onSubmit={(event)=>void submit(event)}>
      <div className="field"><label htmlFor="login-email">Email</label><input id="login-email" name="email" className="control" type="email" autoComplete="username" required value={email} onChange={(event)=>setEmail(event.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="login-password">Password</label><input id="login-password" name="password" className="control" type="password" autoComplete="current-password" required value={password} onChange={(event)=>setPassword(event.target.value)} disabled={busy}/></div>
      <button className="button-primary w-full" type="submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
    </form>
  </div></main>
}
