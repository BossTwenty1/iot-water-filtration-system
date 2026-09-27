import { useEffect,useState } from 'react'

export function usePersistentPreference<T>(key:string,initialValue:T,isValid?:(value:unknown)=>value is T){
  const [value,setValue]=useState<T>(()=>{
    try{
      const stored=window.localStorage.getItem(key)
      if(stored===null)return initialValue
      const parsed:unknown=JSON.parse(stored)
      return isValid?(isValid(parsed)?parsed:initialValue):parsed as T
    }catch{
      return initialValue
    }
  })

  useEffect(()=>{
    try{window.localStorage.setItem(key,JSON.stringify(value))}catch{/* Preferences remain usable for this session. */}
  },[key,value])

  return [value,setValue] as const
}
