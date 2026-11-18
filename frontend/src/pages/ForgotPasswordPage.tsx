import { useRef,useState,type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthPage } from '../components/common/AuthPage'
import { requestPasswordReset } from '../services/apiClient'

export function ForgotPasswordPage(){
  const [email,setEmail]=useState('')
  const [busy,setBusy]=useState(false)
  const [sent,setSent]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const busyRef=useRef(false)
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault()
    if(busyRef.current)return
    busyRef.current=true;setBusy(true);setError(null)
    try{await requestPasswordReset(email);setSent(true)}
    catch(cause){setError(cause instanceof Error?cause.message:'We could not send a reset email. Please try again.')}
    finally{busyRef.current=false;setBusy(false)}
  }
  return <AuthPage title="Forgot password" description="Enter your account email. We will send you a link to choose a new password.">
    {sent?<div className="notice mt-5" role="status">If an account uses this email address, a reset link will be sent. Check your inbox and spam folder.</div>:<>
      {error&&<div className="notice mt-5 text-danger" role="alert">{error}</div>}
      <form className="mt-6 space-y-4" onSubmit={(event)=>void submit(event)}>
        <div className="field"><label htmlFor="reset-email">Email</label><input id="reset-email" name="email" className="control" type="email" autoComplete="email" required value={email} onChange={(event)=>setEmail(event.target.value)} disabled={busy}/></div>
        <button className="button-primary w-full" type="submit" disabled={busy}>{busy?'Sending…':'Send reset link'}</button>
      </form>
    </>}
    {sent&&<button className="button-secondary mt-4 w-full" type="button" onClick={()=>{setSent(false);setError(null)}}>Use a different email</button>}
    <Link className="button-quiet mt-4 w-full" to="/login">Back to sign in</Link>
  </AuthPage>
}
