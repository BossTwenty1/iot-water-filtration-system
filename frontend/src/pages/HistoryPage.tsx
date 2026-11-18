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
import { BOARD_PAIR_TOLERANCE_MS,formatPairGap,pairBoardRecords,type PairedBoardRow } from '../utils/pairBoardRecords'
import type { SensorParameter } from '../types'

const measurementColumns:Array<{parameter:SensorParameter;label:string;decimals?:number}>=[
  {parameter:'pH',label:'pH'},
  {parameter:'turbidity',label:'Turbidity (NTU)'},
  {parameter:'TDS',label:'TDS (ppm)',decimals:0},
  {parameter:'temperature',label:'Temperature (°C)'},
  {parameter:'flowRate',label:'Flow (L/min)',decimals:1},
]

const deviceLabel=(record:PairedBoardRow['before'])=>record?(record.deviceDisplayId??record.deviceId):undefined
const testLabel=(row:PairedBoardRow)=>{
  const record=row.before??row.after
  return record?.testRunId?(record.testRunDisplayId??'Not assigned'):'—'
}
const pairingNote=(row:PairedBoardRow)=>{
  const withinLabel=`${BOARD_PAIR_TOLERANCE_MS/1000} s`
  if(row.pairing==='unpaired')return row.before?`Before only — no after record within ${withinLabel}`:`After only — no before record within ${withinLabel}`
  const gap=formatPairGap(row.gapSeconds)
  return gap?`After recorded ${gap}`:null
}

export function HistoryPage() {
  const canExport=usePermission('research.export')
  const resource=useBoardTelemetry()
  const [detailsOpen,setDetailsOpen]=useState(false)
  const [selectedId,setSelectedId]=useState<string|null>(null)
  // One row per before/after pair so both filtering stages sit side by side.
  const rows=pairBoardRecords(resource.before.records,resource.after.records)
  const selected=rows.find(row=>row.id===selectedId)??rows[0]
  const beforeValues=resource.before.records.map(row=>row.before.turbidity).filter((value):value is number=>typeof value==='number')
  const afterValues=resource.after.records.map(row=>row.after.turbidity).filter((value):value is number=>typeof value==='number')
  const average=(values:number[])=>values.length?(values.reduce((sum,value)=>sum+value,0)/values.length).toFixed(2):'—'
  const range=(values:number[])=>values.length?`${Math.min(...values).toFixed(2)} – ${Math.max(...values).toFixed(2)}`:'—'
  const exportRows=()=>{
    if(!canExport)return
    downloadCsv('telemetry.csv',rows.map(row=>({
      timestamp:row.timestamp,pairing:row.pairing,gap_seconds:row.gapSeconds,
      test_run_id:(row.before??row.after)?.testRunId,
      before_recorded_at:row.before?.timestamp,after_recorded_at:row.after?.timestamp,
      before_device_id:row.before?.deviceId,after_device_id:row.after?.deviceId,
      before_ph:row.before?.before.pH,after_ph:row.after?.after.pH,
      before_turbidity_ntu:row.before?.before.turbidity,after_turbidity_ntu:row.after?.after.turbidity,
      before_tds_ppm:row.before?.before.TDS,after_tds_ppm:row.after?.after.TDS,
      before_temperature_c:row.before?.before.temperature,after_temperature_c:row.after?.after.temperature,
      before_flow_l_min:row.before?.before.flowRate,after_flow_l_min:row.after?.after.flowRate,
      test_number:(row.before??row.after)?.testRunDisplayId,
      before_device_number:row.before?.deviceDisplayId,after_device_number:row.after?.deviceDisplayId,
    })))
  }

  return <div className="page-grid">
    <PageHeader title="Sensor history" description="Compare each board's latest saved readings and browse its recording history." badge="Saved records"
      actions={<button disabled={!canExport||rows.length===0} type="button" className="button-primary" onClick={exportRows}><Download size={16}/>Download CSV</button>}/>
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
      <SectionCard title="Board recording history" description={`${rows.length} rows shown. Each row puts the before-filtering and after-filtering records side by side; values read before / after.`}>
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th scope="col">Time recorded</th><th scope="col">Devices (before / after)</th><th scope="col">Test</th>{measurementColumns.map(({parameter,label})=><th scope="col" key={parameter}>{label}<br/><span className="normal-case">before / after</span></th>)}<th scope="col">Action</th></tr></thead>
          <tbody>{rows.map(row=>{
            const note=pairingNote(row)
            return <tr key={row.id} data-selected={selected?.id===row.id}>
              <td className="mono">{formatDateTime(row.timestamp,true)}{note&&<div className="mt-1 text-xs text-muted">{note}</div>}</td>
              <td className="mono">{deviceLabel(row.before)??'—'} / {deviceLabel(row.after)??'—'}</td>
              <td className="mono">{testLabel(row)}</td>
              {measurementColumns.map(({parameter,decimals})=><td className="mono" key={parameter}>
                <span>{formatOptionalNumber(row.before?.before[parameter],decimals)}</span><span className="text-muted" aria-hidden="true"> / </span><span className="text-hydro">{formatOptionalNumber(row.after?.after[parameter],decimals)}</span>
              </td>)}
              <td><button className="button-quiet" type="button" aria-haspopup="dialog" onClick={()=>{setSelectedId(row.id);setDetailsOpen(true)}}>View details</button></td>
            </tr>})}</tbody>
        </table></div>
        <p className="mt-3 text-sm text-muted">Rows pair each before record with the after record recorded at the same time, or within {BOARD_PAIR_TOLERANCE_MS/1000} seconds. They are time-aligned readings, not matched water samples, and a dash means no numeric value.</p>
      </SectionCard>
    </>}
    {selected&&<Modal open={detailsOpen} title="Reading details" onClose={()=>setDetailsOpen(false)} footer={<button className="button-secondary" type="button" onClick={()=>setDetailsOpen(false)}>Close</button>}>
      <div className="mb-3"><span className="eyebrow rounded bg-blue-100 px-2 py-1 text-hydro">{formatDateTime(selected.timestamp)}</span></div>
      <div className="space-y-3">
        <div className="subpanel p-3"><div className="eyebrow text-muted">Test</div><div className="mono mt-1 break-all text-xs">{testLabel(selected)==='—'?'No linked test':testLabel(selected)}</div><div className="mt-2"><StatusBadge>Saved record</StatusBadge></div></div>
        {(['before','after'] as const).map(sensorStage=>{
          const record=selected[sensorStage]
          return <div className="subpanel p-3" key={sensorStage}>
            <h4 className="text-sm font-semibold text-hydro">{sensorStage==='before'?'Before filtering':'After filtering'}</h4>
            {record?<>
              <div className="mono mt-1 break-all text-xs text-muted">{deviceLabel(record)} · recorded {formatDateTime(record.timestamp,true)}</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-muted">pH</span><div className="mono text-base">{formatOptionalNumber(record[sensorStage].pH)}</div></div>
                <div><span className="text-muted">Turbidity</span><div className="mono text-base">{formatOptionalNumber(record[sensorStage].turbidity)} NTU</div></div>
                <div><span className="text-muted">TDS</span><div className="mono text-base">{formatOptionalNumber(record[sensorStage].TDS,0)} ppm</div></div>
                <div><span className="text-muted">Temperature</span><div className="mono text-base">{formatOptionalNumber(record[sensorStage].temperature)} °C</div></div>
                <div><span className="text-muted">Flow</span><div className="mono text-base">{formatOptionalNumber(record[sensorStage].flowRate,1)} L/min</div></div>
              </div>
            </>:<p className="mt-2 text-xs text-muted">No {sensorStage} record within {BOARD_PAIR_TOLERANCE_MS/1000} seconds of this row.</p>}
          </div>})}
        {pairingNote(selected)&&<div className="text-xs text-muted">{pairingNote(selected)}</div>}
        <div className="notice">Lab records are turned off for now.</div>
      </div>
    </Modal>}
  </div>
}
