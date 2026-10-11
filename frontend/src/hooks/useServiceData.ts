import { useCallback,useEffect,useRef,useState,type Dispatch,type SetStateAction } from 'react'
import type { ResourceStatus } from '../types'

export interface ServiceData<T> {
  data:T|null
  error:string|null
  status:ResourceStatus
  reload:()=>Promise<void>
  setData:Dispatch<SetStateAction<T|null>>
  markStale:()=>void
}

const isEmptyValue=(value:unknown)=>Array.isArray(value)&&value.length===0

export function useServiceData<T>(loader:()=>Promise<T>):ServiceData<T>{
  const requestRef=useRef({version:0,active:true})
  const [data,setData]=useState<T|null>(null)
  const [error,setError]=useState<string|null>(null)
  const [status,setStatus]=useState<ResourceStatus>('loading')

  const reload=useCallback(async()=>{
    const requests=requestRef.current
    const version=++requests.version
    if(!requests.active)return
    setStatus('loading')
    setError(null)
    try{
      const result=await loader()
      if(!requests.active||version!==requests.version)return
      setData(result)
      setStatus(isEmptyValue(result)?'empty':'success')
    }catch(cause){
      if(!requests.active||version!==requests.version)return
      setError(cause instanceof Error?cause.message:'Unable to load data.')
      setStatus('error')
    }
  },[loader])

  useEffect(()=>{
    const requests=requestRef.current
    requests.active=true
    // Reset loading when the external API query changes (e.g. user filters).
    // eslint-disable-next-line react/set-state-in-effect
    void reload()
    return()=>{requests.active=false;requests.version++}
  },[reload])

  const updateData:Dispatch<SetStateAction<T|null>>=(next)=>{
    requestRef.current.version++
    setData(next)
    setStatus('success')
    setError(null)
  }

  return {data,error,status,reload,setData:updateData,markStale:()=>setStatus('stale')}
}
