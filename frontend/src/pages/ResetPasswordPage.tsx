import { useEffect,useRef,useState,type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthPage } from '../components/common/AuthPage'
import { ApiClientError,confirmPasswordReset } from '../services/apiClient'

export function ResetPasswordPage(){
  const [token,setToken]=useState<string|null>(()=>{
    const params=new URLSearchParams(window.location.hash.slice(1))
    return params.get('type')==='recovery'&&!params.has('error')?params.get('access_token'):null
  })
  const [password,setPassword]=useState('')
  const [confirmation,setConfirmation]=useState('')
  const [busy,setBusy]=useState(false)
  const [done,setDone]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const busyRef=useRef(false)
  useEffect(()=>{
    // The token stays in page memory; remove it from browser history.
    window.history.replaceState(window.history.state,'',window.location.pathname)
  },[])
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault()
    if(!token||busyRef.current)return
    if(password!==confirmation){setError('The passwords do not match. Please enter the same password in both fields.');return}
    busyRef.current=true;setBusy(true);setError(null)
    try{await confirmPasswordReset(token,password);setToken(null);setPassword('');setConfirmation('');setDone(true)}
    catch(cause){
      if(cause instanceof ApiClientError&&cause.status===401){setToken(null);setPassword('');setConfirmation('')}
      setError(cause instanceof Error?cause.message:'Could not update your password. Please try again.')
    }finally{busyRef.current=false;setBusy(false)}
  }
  return <AuthPage title={done?'Password changed':'Reset password'} description={done?'Your password has been updated. Sign in with your new password.':'Choose a new password for your account.'}>
    {done?<Link className="button-primary mt-6 w-full" to="/login">Go to sign in</Link>:!token?<>
      <div className="notice mt-5 text-danger" role="alert">This reset link has expired or is not valid. Please request a new link.</div>
      <Link className="button-primary mt-4 w-full" to="/forgot-password">Request a new reset link</Link>
    </>:<>
      {error&&<div className="notice mt-5 text-danger" role="alert">{error}</div>}
      <form className="mt-6 space-y-4" onSubmit={(event)=>void submit(event)}>
        <div className="field"><label htmlFor="new-password">New password</label><input id="new-password" name="new-password" className="control" type="password" autoComplete="new-password" minLength={6} required aria-describedby="password-help" value={password} onChange={(event)=>setPassword(event.target.value)} disabled={busy}/><p id="password-help" className="text-xs text-muted">Use at least 6 characters. The account may require a stronger password.</p></div>
        <div className="field"><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" name="confirm-password" className="control" type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={(event)=>setConfirmation(event.target.value)} disabled={busy}/></div>
        <button className="button-primary w-full" type="submit" disabled={busy}>{busy?'Saving…':'Save new password'}</button>
      </form>
    </>}
    {!done&&<Link className="button-quiet mt-4 w-full" to="/login">Back to sign in</Link>}
  </AuthPage>
}
