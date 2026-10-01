import { useCallback,useRef,useState } from 'react'

export function useActionFeedback(){
  const busyRef=useRef(false)
  const [pending,setPending]=useState(false)
  const [actionError,setActionError]=useState<string|null>(null)

  const runAction=useCallback(async(action:()=>Promise<unknown>)=>{
    if(busyRef.current)return
    busyRef.current=true
    setPending(true)
    setActionError(null)
    try{await action()}
    catch(cause){setActionError(cause instanceof Error?cause.message:'The request could not be completed. Please try again.')}
    finally{busyRef.current=false;setPending(false)}
  },[])

  return {actionError,pending,runAction}
}
