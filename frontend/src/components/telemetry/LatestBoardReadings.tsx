import { SectionCard } from '../common/Cards'
import { ResourceState } from '../common/ResourceState'
import { useServiceData } from '../../hooks/useServiceData'
import { getLatestBoardRecords } from '../../services/telemetryService'
import { formatDateTime,formatOptionalNumber } from '../../utils/formatters'
import type { SensorParameter } from '../../types'

const measurements:Array<{parameter:SensorParameter;label:string;unit:string;decimals:number}>=[
  {parameter:'pH',label:'pH',unit:'',decimals:2},
  {parameter:'turbidity',label:'Turbidity',unit:'NTU',decimals:2},
  {parameter:'TDS',label:'TDS',unit:'ppm',decimals:0},
  {parameter:'temperature',label:'Temperature',unit:'°C',decimals:2},
  {parameter:'flowRate',label:'Flow',unit:'L/min',decimals:1},
]

export function LatestBoardReadings({className=''}:{className?:string}){
  const resource=useServiceData(getLatestBoardRecords)
  const records=resource.data
  const before=records?.before
  const after=records?.after
  const gap=before&&after?Math.abs(Date.parse(before.timestamp)-Date.parse(after.timestamp)):null
  const gapLabel=gap!==null&&Number.isFinite(gap)?`${Math.floor(gap/60000)} min ${Math.floor(gap/1000)%60} sec`:null
  return <SectionCard className={className} title="Latest records from both boards" description="Shown together for reference. Each board records independently; these are not a synchronized before/after sample." action={<button type="button" className="button-secondary" disabled={resource.status==='loading'} onClick={()=>void resource.reload()}>Refresh readings</button>}>
    {resource.status!=='success'||!records?<ResourceState status={resource.status} error={resource.error} loadingLabel="Loading both boards…" emptyLabel="No board readings available."/>:<>
      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Measurement</th><th>Before filtering</th><th>After filtering</th></tr></thead>
        <tbody>
          <tr><th scope="row">Device</th><td>{before?.deviceDisplayId??(before?'Label unavailable':'No record')}</td><td>{after?.deviceDisplayId??(after?'Label unavailable':'No record')}</td></tr>
          <tr><th scope="row">Recorded at</th><td className="mono">{before?formatDateTime(before.timestamp,true):'—'}</td><td className="mono">{after?formatDateTime(after.timestamp,true):'—'}</td></tr>
          {measurements.map(({parameter,label,unit,decimals})=><tr key={parameter}><th scope="row">{label}{unit?` (${unit})`:''}</th><td className="mono">{formatOptionalNumber(before?.before[parameter],decimals)}</td><td className="mono">{formatOptionalNumber(after?.after[parameter],decimals)}</td></tr>)}
        </tbody>
      </table></div>
      <p className="mt-3 text-sm text-muted" role="status">{gapLabel?`Recording times differ by ${gapLabel}.`:'No timestamp comparison available until both boards have a record.'} Refresh to check for newer records. A dash means no numeric measurement in that board’s latest cycle; older values are not carried forward.</p>
    </>}
  </SectionCard>
}
