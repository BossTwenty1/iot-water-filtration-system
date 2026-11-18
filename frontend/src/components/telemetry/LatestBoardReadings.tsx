import { SectionCard } from '../common/Cards'
import { useBoardTelemetry,type BoardTelemetryResource } from '../../hooks/useBoardTelemetry'
import { formatDateTime,formatOptionalNumber } from '../../utils/formatters'
import type { SensorParameter } from '../../types'

const measurements:Array<{parameter:SensorParameter;label:string;unit:string;decimals:number}>=[
  {parameter:'pH',label:'pH',unit:'',decimals:2},
  {parameter:'turbidity',label:'Turbidity',unit:'NTU',decimals:2},
  {parameter:'TDS',label:'TDS',unit:'ppm',decimals:0},
  {parameter:'temperature',label:'Temperature',unit:'°C',decimals:2},
  {parameter:'flowRate',label:'Flow',unit:'L/min',decimals:1},
]

export function BoardReadingsComparison({resource,className=''}:{resource:BoardTelemetryResource;className?:string}){
  const before=resource.before.records[0]
  const after=resource.after.records[0]
  const gap=before&&after?Math.abs(Date.parse(before.timestamp)-Date.parse(after.timestamp)):null
  const gapLabel=gap!==null&&Number.isFinite(gap)?`${Math.floor(gap/60000)} min ${Math.floor(gap/1000)%60} sec`:null
  return <SectionCard className={className} title="Latest records from both boards"
    description="Each column shows its board's latest saved cycle and recording time."
    action={<button type="button" className="button-secondary" disabled={resource.refreshing} onClick={()=>void resource.refresh()}>Refresh readings</button>}>
    <div className="table-wrap"><table className="data-table">
      <thead><tr><th scope="col">Measurement</th><th scope="col">Before filtering</th><th scope="col">After filtering</th></tr></thead>
      <tbody>
        <tr><th scope="row">Device</th><td>{before?.deviceDisplayId??before?.deviceId??(resource.before.loading?'Loading…':resource.before.error?'Unavailable':'No record')}</td><td>{after?.deviceDisplayId??after?.deviceId??(resource.after.loading?'Loading…':resource.after.error?'Unavailable':'No record')}</td></tr>
        <tr><th scope="row">Recorded at</th><td className="mono">{before?formatDateTime(before.timestamp,true):'—'}</td><td className="mono">{after?formatDateTime(after.timestamp,true):'—'}</td></tr>
        {measurements.map(({parameter,label,unit,decimals})=><tr key={parameter}><th scope="row">{label}{unit?` (${unit})`:''}</th><td className="mono">{formatOptionalNumber(before?.before[parameter],decimals)}</td><td className="mono">{formatOptionalNumber(after?.after[parameter],decimals)}</td></tr>)}
      </tbody>
    </table></div>
    {(['before','after'] as const).map(stage=>resource[stage].error&&<p key={stage} role="alert" className="mt-3 text-sm text-danger">
      {stage==='before'?'Before filtering':'After filtering'} — {resource[stage].error} {resource[stage].records.length>0?'Showing its last saved records.':''}
    </p>)}
    <p className="mt-3 text-sm text-muted" role="status">
      {resource.refreshing?'Checking both boards…':'Checks for new readings every 10 seconds.'} {gapLabel?`Recording times differ by ${gapLabel}.`:'Waiting for a saved cycle from each board.'}
      {' '}These are independently recorded cycles. A dash means no numeric measurement in that cycle.
    </p>
  </SectionCard>
}

export function LatestBoardReadings({className=''}:{className?:string}){
  const resource=useBoardTelemetry()
  return <BoardReadingsComparison resource={resource} className={className}/>
}
