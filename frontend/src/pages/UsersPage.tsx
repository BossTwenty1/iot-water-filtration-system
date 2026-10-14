import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { SectionCard } from '../components/common/Cards'
import { Modal } from '../components/common/Overlay'
import { ResourceState } from '../components/common/ResourceState'
import { SelectField } from '../components/common/Filters'
import { StatusBadge } from '../components/common/StatusBadge'
import { useAuth } from '../hooks/useAuth'
import { useActionFeedback } from '../hooks/useActionFeedback'
import { useServiceData } from '../hooks/useServiceData'
import { usersService, type ManagedUser } from '../services/usersService'
import { canManageAccount, hasPermission, manageableRoles, userRoles } from '../utils/permissions'

export function UsersPage() {
  const auth = useAuth()
  if (auth.status !== 'authenticated' || !hasPermission(auth.user, 'users.manage')) return <Navigate to="/settings#users" replace/>
  return <UsersManager currentUser={auth.user}/>
}

function UsersManager({ currentUser }: { currentUser: ManagedUser }) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('All roles')
  const [status, setStatus] = useState('All statuses')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<ManagedUser | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newRole, setNewRole] = useState('Viewer')
  const [change, setChange] = useState<{ target:ManagedUser;action:'role'|'status'|'delete';value:string } | null>(null)
  const [notice, setNotice] = useState('')
  const { pending, actionError, runAction, clearActionError } = useActionFeedback('users.manage')
  const openChange = (next:NonNullable<typeof change>) => { clearActionError(); setChange(next) }
  const permittedRoles = manageableRoles(currentUser)
  const loader = useCallback(() => usersService.getUsers({ search:query, role:role === 'All roles' ? undefined : role, status:status === 'All statuses' ? undefined : status, offset }), [query,role,status,offset])
  const resource = useServiceData(loader)
  const users = resource.data ?? []
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setOffset(0); setSelected(null) }, 300)
    return () => clearTimeout(timer)
  }, [search])
  const details = async (id:string) => { setSelected(await usersService.getUser(id)) }
  const create = (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void runAction(async () => {
      await usersService.createUser({ name,email,password,role:newRole })
      setPassword(''); setName(''); setEmail(''); setAdding(false)
      setNotice('Account created. Share the temporary password privately; no invitation email was sent.')
      await resource.reload()
    })
  }
  const confirm = () => { void runAction(async () => {
    if (!change) return
    if (change.action === 'role') await usersService.updateRole(change.target.id,change.value)
    else if (change.action === 'status') await usersService.updateStatus(change.target.id,change.value as 'Active'|'Inactive')
    else await usersService.deleteUser(change.target.id)
    setNotice('Account change confirmed. Server-side permissions apply on the next request.')
    setChange(null); setSelected(null)
    await resource.reload()
  }) }
  return <div className="page-grid">
    <PageHeader title="Users & Access Management" description="Manage permitted S.A.F.E accounts and software access. Hardware controls and scientific approval are not granted by these roles." actions={<><button className="button-secondary" type="button" disabled={pending} onClick={()=>{setSelected(null);void resource.reload()}}><RefreshCw size={16}/>Refresh</button><button className="button-primary" type="button" disabled={pending} onClick={()=>{setAdding(!adding);setPassword('')}}><Plus size={16}/>{adding?'Close account form':'Add user'}</button></>}/>
    {actionError && <div className="notice text-danger" role="alert">{actionError} Refresh the directory before retrying.</div>}
    {notice && <div className="notice" role="status">{notice}</div>}
    {adding && <SectionCard title="Add permitted account" description="Administrator-provisioned account, not a public signup or email invitation."><form className="grid gap-4 sm:grid-cols-2" onSubmit={create}>
      <div className="field"><label htmlFor="account-name">Name</label><input id="account-name" className="control" disabled={pending} required maxLength={120} autoComplete="name" value={name} onChange={event=>setName(event.target.value)}/></div>
      <div className="field"><label htmlFor="account-email">Email</label><input id="account-email" className="control" disabled={pending} type="email" required maxLength={254} autoComplete="off" value={email} onChange={event=>setEmail(event.target.value)}/></div>
      <div className="field"><label htmlFor="account-password">Temporary password</label><input id="account-password" className="control" disabled={pending} type="password" required minLength={12} maxLength={128} autoComplete="new-password" aria-describedby="password-help" value={password} onChange={event=>setPassword(event.target.value)}/><p id="password-help" className="mt-1 text-xs text-muted">At least 12 characters. Share privately with the intended recipient.</p></div>
      <SelectField label="New account role" disabled={pending} value={newRole} onChange={setNewRole} options={permittedRoles}/>
      <div className="flex flex-wrap gap-2 sm:col-span-2"><button className="button-primary" type="submit" disabled={pending}>{pending?'Creating account…':'Create account'}</button><button className="button-secondary" type="button" disabled={pending} onClick={()=>{setAdding(false);setPassword('')}}>Cancel</button></div>
    </form></SectionCard>}
    <section className="panel grid gap-3 p-4 sm:grid-cols-3" aria-label="User filters">
      <div className="field"><label htmlFor="user-search">Search email</label><input id="user-search" type="search" className="control" value={search} onChange={event=>setSearch(event.target.value)} maxLength={120}/></div>
      <SelectField label="Role filter" value={role} onChange={value=>{setRole(value);setOffset(0);setSelected(null)}} options={['All roles',...(currentUser.role==='Super Administrator'?userRoles:permittedRoles)]}/>
      <SelectField label="Status filter" value={status} onChange={value=>{setStatus(value);setOffset(0);setSelected(null)}} options={['All statuses','Active','Inactive']}/>
    </section>
    <ResourceState status={resource.status} error={resource.error} emptyLabel="No permitted accounts match these filters. Change the filters or add a user." loadingLabel="Loading permitted accounts…"/>
    {resource.status==='success' && <SectionCard title="Account directory" description={`${users.length} accounts on this page. Your current account remains available in Settings.`}><p id="users-scroll-help" className="mb-3 text-xs text-muted lg:hidden">Scroll sideways to view roles, statuses, and actions.</p><div className="table-wrap" role="region" aria-label="Account directory table" aria-describedby="users-scroll-help" tabIndex={0}><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td className="font-semibold">{user.name}</td><td>{user.email}</td><td>{user.role}</td><td><StatusBadge>{user.deletionPending?'Deletion pending':user.status}</StatusBadge></td><td><div className="flex flex-nowrap gap-2 whitespace-nowrap"><button type="button" className="button-quiet" disabled={pending} onClick={()=>void runAction(()=>details(user.id))}>Details</button>{canManageAccount(currentUser,user) && <><button type="button" className="button-quiet" disabled={pending||user.deletionPending} onClick={()=>openChange({target:user,action:'role',value:user.role})}>Change role</button><button type="button" className="button-quiet" disabled={pending||user.deletionPending} onClick={()=>openChange({target:user,action:'status',value:user.status==='Active'?'Inactive':'Active'})}>{user.status==='Active'?'Deactivate':'Activate'}</button><button type="button" className="button-quiet text-danger" disabled={pending} onClick={()=>openChange({target:user,action:'delete',value:''})}>{user.deletionPending?'Retry deletion':'Delete'}</button></>}</div></td></tr>)}</tbody></table></div></SectionCard>}
    <div className="flex items-center justify-between gap-3"><button className="button-secondary" type="button" disabled={offset===0||pending||resource.status==='loading'} onClick={()=>{setOffset(Math.max(0,offset-25));setSelected(null)}}>Previous</button><span className="text-xs text-muted">Page {Math.floor(offset/25)+1}</span><button className="button-secondary" type="button" disabled={users.length<25||pending||resource.status!=='success'} onClick={()=>{setOffset(offset+25);setSelected(null)}}>Next</button></div>
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{selected?`Account details loaded for ${selected.name}. Find them below the directory.`:''}</div>
    {selected && <SectionCard title="Account details"><dl className="grid gap-3 text-sm sm:grid-cols-2">{[['Name',selected.name],['Email',selected.email],['Role',selected.role],['Status',selected.status],['Account ID',selected.id]].map(([label,value])=><div className="min-w-0" key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl><button className="button-quiet mt-3" type="button" onClick={()=>setSelected(null)}>Close details</button></SectionCard>}
    {hasPermission(currentUser,'audit.read') && <AuditHistory/>}
    <Modal open={Boolean(change)} title="Confirm account change" onClose={()=>{if(!pending)setChange(null)}} footer={<><button className="button-secondary" type="button" disabled={pending} onClick={()=>setChange(null)}>Cancel</button>{actionError&&<button className="button-secondary" type="button" disabled={pending} onClick={()=>{setChange(null);setSelected(null);clearActionError();void resource.reload()}}>Close and refresh directory</button>}<button className={change?.action==='delete'?'button-danger':'button-primary'} type="button" disabled={pending||Boolean(actionError)||!change||(change.action==='role'&&change.value===change.target.role)} onClick={confirm}>{pending?'Updating…':'Confirm change'}</button></>}>
      {change && <div className="space-y-4"><p className="break-words text-sm">{change.target.email}</p>{change.action==='role'?<SelectField label="Assign role" disabled={pending} value={change.value} onChange={value=>setChange({...change,value})} options={permittedRoles}/>:<p className="text-sm">{change.action==='delete'?'Delete this Auth account? Sign-in will be blocked first. Research records will not be deleted. If Auth deletion fails, use Retry deletion.':`Set this account to ${change.value}? Inactive accounts lose API access, including existing sessions.`}</p>}{actionError&&<p className="text-sm text-danger" role="alert">{actionError} Close and refresh the directory before retrying.</p>}</div>}
    </Modal>
  </div>
}

function AuditHistory() {
  const [offset,setOffset]=useState(0)
  const loader=useCallback(()=>usersService.getAudit(offset),[offset])
  const resource=useServiceData(loader)
  const rows=resource.data??[]
  return <SectionCard title="Account audit history" description="Super Administrator only. IDs remain available after account deletion." action={<button className="button-quiet" type="button" onClick={()=>void resource.reload()}>Refresh audit</button>}>
    <ResourceState status={resource.status} error={resource.error} emptyLabel="No account-management events recorded yet."/>
    {resource.status==='success'&&<div className="table-wrap"><table className="data-table"><thead><tr><th>Time</th><th>Action</th><th>Actor ID</th><th>Target ID</th><th>Change / reason</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{new Date(row.created_at).toLocaleString()}</td><td>{row.action}</td><td>{row.actor_id??'Private provisioning / Auth trigger'}</td><td>{row.target_id}</td><td>{[row.old_role,row.new_role].filter(Boolean).join(' → ')} { [row.old_status,row.new_status].filter(Boolean).join(' → ')} {row.reason}</td></tr>)}</tbody></table></div>}
    <div className="mt-3 flex justify-between gap-3"><button className="button-secondary" type="button" disabled={offset===0||resource.status==='loading'} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous audit page</button><button className="button-secondary" type="button" disabled={rows.length<25||resource.status!=='success'} onClick={()=>setOffset(offset+25)}>Next audit page</button></div>
  </SectionCard>
}
