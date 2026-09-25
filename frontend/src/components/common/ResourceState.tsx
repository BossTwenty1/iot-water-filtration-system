import type { ResourceStatus } from '../../types'

export function ResourceState({status,error,loadingLabel='Loading records…',emptyLabel='No records available.'}:{status:ResourceStatus;error?:string|null;loadingLabel?:string;emptyLabel?:string}){
  if(status==='loading')return <div className="panel p-4 text-sm text-muted" role="status">{loadingLabel}</div>
  if(status==='empty')return <div className="panel p-4 text-sm text-muted">{emptyLabel}</div>
  if(status==='error')return <div className="panel p-4 text-sm text-danger" role="alert">{error||'Unable to load records.'}</div>
  if(status==='stale')return <div className="text-xs text-warn" role="status">Latest saved readings shown. Device updates are currently unavailable.</div>
  return null
}
