import { Download,Info } from 'lucide-react'
import { useState } from 'react'
import { usePermission } from '../hooks/usePermission'
import { useBoardTelemetry } from '../hooks/useBoardTelemetry'
import { PageHeader } from '../components/common/PageHeader'
import { ResourceState } from '../components/common/ResourceState'
import { SectionCard,SummaryCard } from '../components/common/Cards'
import { StatusBadge } from '../components/common/StatusBadge'
import { Modal } from '../components/common/Overlay'
import { BoardReadingsComparison } from '../components/telemetry/LatestBoardReadings'
import { TelemetryChart } from '../components/telemetry/TelemetryChart'
import { downloadCsv } from '../utils/csv'
import { formatDateTime,formatOptionalNumber } from '../utils/formatters'

export function HistoryPage() {
  const canExport=usePermission('research.export')
  const resource=useBoardTelemetry()
  const [detailsOpen,setDetailsOpen]=useState(false)
  const [selectedId,setSelectedId]=useState<string|null>(null)
  const rows=(['before','after'] as const)
    .flatMap(stage=>resource[stage].records.map(record=>({record,stage})))
    .sort((a,b)=>Date.parse(b.record.timestamp)-Date.parse(a.record.timestamp))
  const records=[...new Map(rows.map(({record})=>[record.id,record])).values()]
  const selected=records.find(record=>record.id===selectedId)??records[0]
  const beforeValues=resource.before.records.map(row=>row.before.turbidity).filter((value):value is number=>typeof value==='number')
  const afterValues=resource.after.records.map(row=>row.after.turbidity).filter((value):value is number=>typeof value==='number')
  const average=(values:number[])=>values.length?(values.reduce((sum,value)=>sum+value,0)/values.length).toFixed(2):'—'
  const range=(values:number[])=>values.length?`${Math.min(...values).toFixed(2)} – ${Math.max(...values).toFixed(2)}`:'—'
  const exportRows=()=>{
    if(!canExport)return
    downloadCsv('telemetry.csv',records.map(row=>({
      timestamp:row.timestamp,test_run_id:row.testRunId,device_id:row.deviceId,
      before_ph:row.before.pH,after_ph:row.after.pH,
      before_turbidity_ntu:row.before.turbidity,after_turbidity_ntu:row.after.turbidity,
      before_tds_ppm:row.before.TDS,after_tds_ppm:row.after.TDS,
      before_temperature_c:row.before.temperature,after_temperature_c:row.after.temperature,
      before_flow_l_min:row.before.flowRate,after_flow_l_min:row.after.flowRate,
      test_number:row.testRunDisplayId,device_number:row.deviceDisplayId,
    })))
  }

  return <div className="page-grid">
    <PageHeader title="Sensor history" description="Compare each board's latest saved readings and browse its recording history." badge="Saved records"
      actions={<button disabled={!canExport||records.length===0} type="button" className="button-primary" onClick={exportRows}><Download size={16}/>Download CSV</button>}/>
    <BoardReadingsComparison resource={resource}/>
    {rows.length===0?<ResourceState
      status={resource.before.loading||resource.after.loading?'loading':resource.before.error&&resource.after.error?'error':'empty'}
      error="Unable to load either board's history. Use Refresh readings to try again."
      loadingLabel="Loading sensor history…" emptyLabel="No saved readings are available for either filtering stage."/>:<>
      <div className="summary-grid">
        <SummaryCard label="Before filtering average" value={`${average(beforeValues)} NTU`} detail="Average of the readings shown"/>
        <SummaryCard label="After filtering average" value={`${average(afterValues)} NTU`} detail="Compares readings only; does not prove water safety" tone="good"/>
        <SummaryCard label="Before: lowest / highest" value={range(beforeValues)} detail="Lowest and highest readings, NTU"/>
        <SummaryCard label="After: lowest / highest" value={range(afterValues)} detail="Lowest and highest readings, NTU" tone="good"/>
      </div>
      <div className="notice"><Info size={17}/><span>Lab results are kept separate from sensor readings.</span></div>
      <SectionCard title="Sensor readings over time" description="Saved readings before and after filtering" action={<span className="eyebrow text-hydro">Turbidity</span>}><TelemetryChart/></SectionCard>
      <SectionCard title="Board recording history" description={`${rows.length} stage records shown. Each row shows the measurements from that board and filtering stage.`}>
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th scope="col">Time recorded</th><th scope="col">Device</th><th scope="col">Stage</th><th scope="col">Test</th><th scope="col">pH</th><th scope="col">Turbidity (NTU)</th><th scope="col">TDS (ppm)</th><th scope="col">Temperature (°C)</th><th scope="col">Flow (L/min)</th><th scope="col">Action</th></tr></thead>
          <tbody>{rows.map(({record,stage})=><tr key={`${record.id}|${stage}`} data-selected={selected?.id===record.id}>
            <td className="mono">{formatDateTime(record.timestamp,true)}</td>
            <td className="mono">{record.deviceDisplayId??record.deviceId}</td>
            <td>{stage==='before'?'Before filtering':'After filtering'}</td>
            <td className="mono">{record.testRunId?(record.testRunDisplayId??'Not assigned'):'—'}</td>
            <td className="mono">{formatOptionalNumber(record[stage].pH)}</td>
            <td className="mono">{formatOptionalNumber(record[stage].turbidity)}</td>
            <td className="mono">{formatOptionalNumber(record[stage].TDS,0)}</td>
            <td className="mono">{formatOptionalNumber(record[stage].temperature)}</td>
            <td className="mono">{formatOptionalNumber(record[stage].flowRate,1)}</td>
            <td><button className="button-quiet" type="button" aria-haspopup="dialog" onClick={()=>{setSelectedId(record.id);setDetailsOpen(true)}}>View details</button></td>
          </tr>)}</tbody>
        </table></div>
      </SectionCard>
    </>}
    {selected&&<Modal open={detailsOpen} title="Reading details" onClose={()=>setDetailsOpen(false)} footer={<button className="button-secondary" type="button" onClick={()=>setDetailsOpen(false)}>Close</button>}>
      <div className="mb-3"><span className="eyebrow rounded bg-blue-100 px-2 py-1 text-hydro">{formatDateTime(selected.timestamp)}</span></div>
      <div className="space-y-3">
        <div className="subpanel p-3"><div className="eyebrow text-muted">Test / Device</div><div className="mono mt-1 break-all text-xs">{selected.testRunId?(selected.testRunDisplayId??'Not assigned'):'No linked test'} · {selected.deviceDisplayId??selected.deviceId}</div><div className="mt-2"><StatusBadge>Saved record</StatusBadge></div></div>
        {(['before','after'] as const).map(sensorStage=><div className="subpanel p-3" key={sensorStage}>
          <h4 className="text-sm font-semibold text-hydro">{sensorStage==='before'?'Before filtering':'After filtering'}</h4>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-muted">pH</span><div className="mono text-base">{formatOptionalNumber(selected[sensorStage].pH)}</div></div>
            <div><span className="text-muted">Turbidity</span><div className="mono text-base">{formatOptionalNumber(selected[sensorStage].turbidity)} NTU</div></div>
            <div><span className="text-muted">TDS</span><div className="mono text-base">{formatOptionalNumber(selected[sensorStage].TDS,0)} ppm</div></div>
            <div><span className="text-muted">Temperature</span><div className="mono text-base">{formatOptionalNumber(selected[sensorStage].temperature)} °C</div></div>
            <div><span className="text-muted">Flow</span><div className="mono text-base">{formatOptionalNumber(selected[sensorStage].flowRate,1)} L/min</div></div>
          </div>
        </div>)}
        <div className="text-xs text-muted">Recorded {formatDateTime(selected.timestamp)}</div>
        <div className="notice">Lab records are turned off for now.</div>
      </div>
    </Modal>}
  </div>
}
