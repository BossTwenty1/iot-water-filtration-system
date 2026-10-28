import { useEffect,useState,type FormEvent } from 'react'
import { Link,Navigate,useLocation,useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { signIn } from '../services/apiClient'
import { waitForBackend } from '../services/backendReadiness'
import { AuthPage } from '../components/common/AuthPage'

export function LoginPage(){
  const auth=useAuth()
  const location=useLocation()
  const navigate=useNavigate()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [backend,setBackend]=useState<'checking'|'ready'|'unavailable'>('checking')
  const [backendError,setBackendError]=useState<string|null>(null)
  const [checkAttempt,setCheckAttempt]=useState(0)
  const intended=(location.state as {from?:unknown}|null)?.from
  const destination=typeof intended==='string'&&intended.startsWith('/')&&!intended.startsWith('//')&&intended!=='/login'?intended:'/dashboard'

  useEffect(()=>{
    if(auth.status!=='unauthenticated')return
    const controller=new AbortController()
    void waitForBackend(controller.signal).then(()=>{
      if(!controller.signal.aborted)setBackend('ready')
    }).catch((cause:unknown)=>{
      if(controller.signal.aborted)return
      setBackend('unavailable')
      setBackendError(cause instanceof Error?cause.message:'Server unavailable. Please try again.')
    })
    return()=>controller.abort()
  },[auth.status,checkAttempt])

  if(auth.status==='loading')return <div className="panel mx-auto mt-24 max-w-md p-6" role="status">Checking your sign-in…</div>
  if(auth.status==='authenticated')return <Navigate to={destination} replace/>

  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault()
    if(busy||backend!=='ready')return
    setError(null)
    setBusy(true)
    try{await signIn(email.trim(),password);void navigate(destination,{replace:true})}
    catch(cause){setError(cause instanceof Error?cause.message:'Unable to sign in.')}
    finally{setBusy(false)}
  }

  return <AuthPage title="Sign in" description="Use your project account to access the dashboard.">
    {backend==='checking'&&<div id="backend-status" className="notice mt-5" role="status">Starting the server. This may take about a minute on our free hosting. You can enter your details while you wait.</div>}
    {backend==='unavailable'&&<div id="backend-status" className="notice mt-5 flex-col" role="alert"><p>{backendError}</p><button className="button-secondary" type="button" onClick={()=>{setBackend('checking');setBackendError(null);setError(null);setCheckAttempt((value)=>value+1)}}>Retry connection</button></div>}
    {auth.notice&&<div className="notice mt-5" role="status">{auth.notice}</div>}
    {error&&<div id="login-error" className="notice mt-5 bg-red-50 text-danger" role="alert">{error}</div>}
    <form className="mt-6 space-y-4" onSubmit={(event)=>void submit(event)}>
      <div className="field"><label htmlFor="login-email">Email</label><input id="login-email" name="email" className="control" type="email" autoComplete="username" required value={email} onChange={(event)=>setEmail(event.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="login-password">Password</label><input id="login-password" name="password" className="control" type="password" autoComplete="current-password" required value={password} onChange={(event)=>setPassword(event.target.value)} disabled={busy}/></div>
      <button className="button-primary w-full" type="submit" disabled={busy||backend!=='ready'} aria-describedby={backend!=='ready'?'backend-status':undefined}>{busy?'Signing in…':backend==='checking'?'Starting server…':'Sign in'}</button>
    </form>
    <Link className="button-quiet mt-3 w-full" to="/forgot-password">Forgot password?</Link>
    <p className="mt-5 text-xs leading-relaxed text-muted">Signing in checks your account. It does not confirm that the device is connected or that the saved readings came from the actual device.</p>
  </AuthPage>
}
