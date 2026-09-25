const configuredBaseUrl=import.meta.env.VITE_API_BASE_URL?.trim()

export const apiBaseUrl=configuredBaseUrl?.replace(/\/+$/,'')??''

export class ApiClientError extends Error {
  readonly status?:number
  constructor(message:string,status?:number){super(message);this.name='ApiClientError';this.status=status}
}

export interface ApiRequestOptions extends Omit<RequestInit,'body'> { body?:unknown }

export async function apiRequest<T>(path:string,options:ApiRequestOptions={}):Promise<T>{
  if(!apiBaseUrl)throw new ApiClientError('VITE_API_BASE_URL is not configured.')
  const response=await fetch(`${apiBaseUrl}/${path.replace(/^\/+/, '')}`,{
    ...options,
    headers:{Accept:'application/json',...(options.body===undefined?{}:{'Content-Type':'application/json'}),...options.headers},
    body:options.body===undefined?undefined:JSON.stringify(options.body),
  })
  if(!response.ok)throw new ApiClientError(`API request failed with status ${response.status}.`,response.status)
  if(response.status===204)return undefined as T
  return response.json() as Promise<T>
}
