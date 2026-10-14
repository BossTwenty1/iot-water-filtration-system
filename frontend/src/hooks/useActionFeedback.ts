import { useCallback,useRef,useState } from 'react'
import { usePermission } from './usePermission'
import type { Permission } from '../utils/permissions'

export function useActionFeedback(permission:Permission='research.write'){
  const canAct=usePermission(permission)
  const busyRef=useRef(false)
  const [pending,setPending]=useState(false)
  const [actionError,setActionError]=useState<string|null>(null)

  const runAction=useCallback(async(action:()=>Promise<unknown>)=>{
    if(!canAct){setActionError('Your role does not permit this action.');return}
    if(busyRef.current)return
    busyRef.current=true
    setPending(true)
    setActionError(null)
    try{await action()}
    catch(cause){setActionError(cause instanceof Error?cause.message:'The request could not be completed. Please try again.')}
    finally{busyRef.current=false;setPending(false)}
  },[canAct])

  return {actionError,pending,runAction,canAct,clearActionError:()=>setActionError(null)}
}
