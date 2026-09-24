import { useCallback,useEffect,useState,type Dispatch,type SetStateAction } from 'react'
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
  const [data,setData]=useState<T|null>(null)
  const [error,setError]=useState<string|null>(null)
  const [status,setStatus]=useState<ResourceStatus>('loading')

  const reload=useCallback(async()=>{
    setStatus('loading')
    setError(null)
    try{
      const result=await loader()
      setData(result)
      setStatus(isEmptyValue(result)?'empty':'success')
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Unable to load data.')
      setStatus('error')
    }
  },[loader])

  useEffect(()=>{
    let active=true
    void loader().then((result)=>{
      if(!active)return
      setData(result)
      setError(null)
      setStatus(isEmptyValue(result)?'empty':'success')
    }).catch((cause:unknown)=>{
      if(!active)return
      setError(cause instanceof Error?cause.message:'Unable to load data.')
      setStatus('error')
    })
    return()=>{active=false}
  },[loader])

  return {data,error,status,reload,setData,markStale:()=>setStatus('stale')}
}
