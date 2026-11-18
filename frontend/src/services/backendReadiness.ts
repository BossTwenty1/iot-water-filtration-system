import { ApiClientError,apiBaseUrl,checkBackendHealth } from './apiClient'

function pause(signal:AbortSignal):Promise<void>{
  signal.throwIfAborted()
  return new Promise((resolve,reject)=>{
    const cancel=()=>{clearTimeout(timer);reject(signal.reason)}
    const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve()},5_000)
    signal.addEventListener('abort',cancel,{once:true})
  })
}

// Probe only the public health route; never retry a password submission.
export async function waitForBackend(signal:AbortSignal):Promise<void>{
  signal.throwIfAborted()
  if(!apiBaseUrl)throw new ApiClientError('VITE_API_BASE_URL is not configured.')
  const controller=new AbortController()
  const cancel=()=>controller.abort()
  signal.addEventListener('abort',cancel,{once:true})
  const deadline=setTimeout(cancel,90_000)
  try{
    while(true){
      controller.signal.throwIfAborted()
      try{
        await checkBackendHealth(controller.signal)
        controller.signal.throwIfAborted()
        return
      }catch{
        controller.signal.throwIfAborted()
      }
      await pause(controller.signal)
    }
  }catch{
    signal.throwIfAborted()
    throw new ApiClientError('Server unavailable. Check your connection and try again.')
  }finally{
    clearTimeout(deadline)
    signal.removeEventListener('abort',cancel)
  }
}
