import type { User } from '../types'
import { userRoles } from '../utils/permissions'

const configuredBaseUrl=import.meta.env.VITE_API_BASE_URL?.trim()
const refreshStorageKey='iot-water-filtration.refresh-token'
const expiryLeewayMs=30_000

export const apiBaseUrl=configuredBaseUrl?.replace(/\/+$/,'')??''

export class ApiClientError extends Error {
  readonly status?:number
  constructor(message:string,status?:number){super(message);this.name='ApiClientError';this.status=status}
}

export interface ApiRequestOptions extends Omit<RequestInit,'body'> { body?:unknown }

interface AuthSession { token:string; refreshToken:string; expiresIn:number; user:User }
interface ActiveSession extends AuthSession { expiresAt:number }
export type AuthState=
  | { status:'loading' }
  | { status:'authenticated'; user:User }
  | { status:'unauthenticated'; notice?:string }

let session:ActiveSession|null=null
let authState:AuthState={status:'loading'}
let restorePromise:Promise<void>|null=null
let refreshPromise:Promise<string>|null=null
let refreshTimer:ReturnType<typeof setTimeout>|null=null
let sessionRevision=0
const listeners=new Set<()=>void>()
// Brief, memory-only reuse removes repeat reads during navigation. Account
// management stays uncached; sign-out, role changes and writes clear all reads.
const readCache=new Map<string,{expiresAt:number;value:unknown}>()
const pendingReads=new Map<string,Promise<unknown>>()
let readRevision=0
export function invalidateApiCache(){readRevision++;readCache.clear();pendingReads.clear()}

export function subscribeAuth(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}
export function getAuthState(){return authState}

function publish(next:AuthState){authState=next;listeners.forEach((listener)=>listener())}

// Only the refresh token survives a reload, and only for this browser tab.
// The access token and user profile remain in memory. This is still readable
// by JavaScript; an HttpOnly-cookie approach requires a backend contract change.
function storedRefreshToken(){try{return window.sessionStorage.getItem(refreshStorageKey)}catch{return null}}
function persistRefreshToken(token:string|null){
  try{if(token)window.sessionStorage.setItem(refreshStorageKey,token);else window.sessionStorage.removeItem(refreshStorageKey)}catch{/* Memory-only session if storage is unavailable. */}
}

function clearSession(notice?:string){
  invalidateApiCache()
  sessionRevision++
  if(refreshTimer)clearTimeout(refreshTimer)
  refreshTimer=null
  session=null
  persistRefreshToken(null)
  publish({status:'unauthenticated',...(notice?{notice}:{})})
}

function acceptSession(value:AuthSession){
  if(!value||typeof value.token!=='string'||!value.token||typeof value.refreshToken!=='string'||!value.refreshToken||!Number.isFinite(value.expiresIn)||value.expiresIn<=0||!value.user||typeof value.user.id!=='string'||value.user.status!=='Active'||!userRoles.includes(value.user.role)){
    throw new ApiClientError('Could not confirm your sign-in. Please sign in again.')
  }
  if(session?.user.id!==value.user.id||session?.user.role!==value.user.role)invalidateApiCache()
  sessionRevision++
  session={...value,expiresAt:Date.now()+value.expiresIn*1000}
  if(refreshTimer)clearTimeout(refreshTimer)
  refreshTimer=setTimeout(()=>{void refreshSession().catch(()=>undefined)},Math.min(2_147_483_647,Math.max(1_000,value.expiresIn*1000-expiryLeewayMs)))
  persistRefreshToken(value.refreshToken)
  publish({status:'authenticated',user:value.user})
}

async function send<T>(path:string,options:ApiRequestOptions={},token?:string):Promise<T>{
  if(!apiBaseUrl)throw new ApiClientError('The server connection is not set up. Ask the project team for help.')
  const headers=new Headers(options.headers)
  headers.set('Accept','application/json')
  if(options.body!==undefined)headers.set('Content-Type','application/json')
  if(token)headers.set('Authorization',`Bearer ${token}`)
  try{
    const response=await fetch(`${apiBaseUrl}/${path.replace(/^\/+/, '')}`,{
      ...options,credentials:'omit',headers,
      body:options.body===undefined?undefined:JSON.stringify(options.body),
    })
    if(!response.ok){
      const payload:unknown=await response.json().catch(()=>null)
      const message=payload&&typeof payload==='object'&&'error' in payload&&typeof payload.error==='string'?payload.error:`The server could not complete the request (code ${response.status}). Please try again.`
      throw new ApiClientError(message,response.status)
    }
    if(response.status===204)return undefined as T
    return await response.json() as T
  }catch(cause){
    if(cause instanceof ApiClientError)throw cause
    if(cause instanceof DOMException&&cause.name==='AbortError')throw cause
    throw new ApiClientError('Could not connect to the server. Please try again.')
  }
}

async function refreshSession():Promise<string>{
  if(refreshPromise)return refreshPromise
  const refreshToken=session?.refreshToken??storedRefreshToken()
  if(!refreshToken){clearSession();throw new ApiClientError('Please sign in to continue.',401)}
  const revision=sessionRevision
  refreshPromise=(async()=>{
    try{
      const next=await send<AuthSession>('auth/refresh',{method:'POST',body:{refreshToken}})
      if(revision!==sessionRevision)throw new ApiClientError('Your sign-in has changed. Please sign in again.',401)
      acceptSession(next)
      return next.token
    }catch(cause){
      if(revision===sessionRevision)clearSession(cause instanceof ApiClientError&&cause.status===401?'Your sign-in has expired. Please sign in again.':'We could not restore your sign-in. Please sign in again.')
      throw cause
    }finally{refreshPromise=null}
  })()
  return refreshPromise
}

async function accessToken():Promise<string>{
  if(session&&session.expiresAt>Date.now()+expiryLeewayMs)return session.token
  return refreshSession()
}

export function restoreSession():Promise<void>{
  if(restorePromise)return restorePromise
  restorePromise=(async()=>{
    if(!storedRefreshToken()){publish({status:'unauthenticated'});return}
    try{await refreshSession()}catch{/* refreshSession clears invalid/unavailable sessions. */}
  })()
  return restorePromise
}

export async function signIn(email:string,password:string):Promise<void>{
  const result=await send<AuthSession>('auth/login',{method:'POST',body:{email,password}})
  acceptSession(result)
}

export function requestPasswordReset(email:string):Promise<void>{
  return send<void>('auth/password-reset/request',{method:'POST',body:{email:email.trim()}})
}

export async function confirmPasswordReset(accessToken:string,newPassword:string):Promise<void>{
  await send<void>('auth/password-reset/confirm',{method:'POST',body:{accessToken,newPassword}})
  clearSession('Password changed. Please sign in with your new password.')
}

export async function checkBackendHealth(signal:AbortSignal):Promise<void>{
  const result=await send<{status?:string}>('health',{signal,cache:'no-store'})
  if(result?.status!=='ok')throw new ApiClientError('The API is not ready.')
}

export async function signOut():Promise<void>{
  // Clear local credentials even when the server is unavailable.
  try{
    const token=await accessToken()
    await send<void>('auth/logout',{method:'POST'},token)
    clearSession()
  }catch{
    clearSession('Signed out on this browser. We could not confirm that the server also ended your sign-in.')
  }
}

async function authenticatedRequest<T>(path:string,options:ApiRequestOptions={}):Promise<T>{
  const token=await accessToken()
  try{return await send<T>(path,options,token)}
  catch(cause){
    if(cause instanceof ApiClientError&&cause.status===403){
      try{
        const user=await send<User>('auth/me',{},token)
        if(session?.token===token&&user.status==='Active'&&userRoles.includes(user.role)){
          invalidateApiCache()
          session.user=user
          publish({status:'authenticated',user})
        }
      }catch(error){if(session?.token===token&&error instanceof ApiClientError&&error.status===401)clearSession('This account is unavailable. Please sign in again.')}
      throw cause
    }
    if(!(cause instanceof ApiClientError)||cause.status!==401)throw cause
    try{
      const nextToken=session?.token&&session.token!==token?session.token:await refreshSession()
      return await send<T>(path,options,nextToken)
    }catch(retryError){
      if(retryError instanceof ApiClientError&&retryError.status===401)clearSession('Your sign-in has expired. Please sign in again.')
      throw retryError
    }
  }
}

export async function apiRequest<T>(path:string,options:ApiRequestOptions={}):Promise<T>{
  const method=(options.method??'GET').toUpperCase()
  if(method!=='GET'){
    invalidateApiCache()
    try{return await authenticatedRequest<T>(path,options)}finally{invalidateApiCache()}
  }
  const cacheable=Object.keys(options).length===0&&!/^(auth|users)(\/|\?|$)/.test(path)
  if(!cacheable)return authenticatedRequest<T>(path,options)
  const cached=readCache.get(path)
  if(session&&session.expiresAt>Date.now()+expiryLeewayMs&&cached&&cached.expiresAt>Date.now())return cached.value as T
  const pending=pendingReads.get(path)
  if(pending)return pending as Promise<T>
  const revision=readRevision
  const request=authenticatedRequest<T>(path,options).then(value=>{
    if(revision===readRevision){
      if(readCache.size>=100)readCache.clear()
      readCache.set(path,{value,expiresAt:Date.now()+10_000})
    }
    return value
  }).finally(()=>{if(pendingReads.get(path)===request)pendingReads.delete(path)})
  pendingReads.set(path,request)
  return request
}
