import { Activity,Clock,CloudCog,Droplets,Gauge,Power,Radio,ThermometerSun } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { ResourceState } from '../components/common/ResourceState'
import { SectionCard,SummaryCard } from '../components/common/Cards'
import { StatusBadge } from '../components/common/StatusBadge'
import { ProcessTopology } from '../components/telemetry/ProcessTopology'
import { SensorGrid } from '../components/telemetry/SensorGrid'
import { TelemetryChart } from '../components/telemetry/TelemetryChart'
import { useServiceData } from '../hooks/useServiceData'
import { alertsService,deviceService,laboratoryValidationService,telemetryService,testRunsService } from '../services'
import { formatDateTime } from '../utils/formatters'

export function DashboardPage() {
  const alertsResource=useServiceData(alertsService.getAlerts)
  const runsResource=useServiceData(testRunsService.getTestRuns)
  const validationResource=useServiceData(laboratoryValidationService.getLaboratoryValidationRecords)
  const telemetryResource=useServiceData(telemetryService.getTelemetryHistory)
  const deviceResource=useServiceData(deviceService.getDeviceStatus)
  const unavailable=[alertsResource,runsResource,validationResource,telemetryResource,deviceResource].find((resource)=>resource.status!=='success')
  if(unavailable||!alertsResource.data||!runsResource.data||!validationResource.data||!telemetryResource.data||!deviceResource.data)return <div className="page-grid"><PageHeader title="System Dashboard" description="Live monitoring across the approved filtration process" badge="Live telemetry"/><ResourceState status={unavailable?.status??'loading'} error={unavailable?.error} loadingLabel="Loading dashboard…"/></div>
  const alerts=alertsResource.data
  const activeRun=runsResource.data[0]
  const validation=validationResource.data[0]
  const telemetry=telemetryResource.data
  const device=deviceResource.data
  return <div className="page-grid">
    <PageHeader title="System Dashboard" description="Live monitoring across the approved filtration process" badge="Live telemetry" />
    <div className="summary-grid"><SummaryCard label="Filtration status" value="Running" detail="Status: Active" icon={Activity}/><SummaryCard label="Booster pump" value="On" detail="Pump status: On" icon={Power}/><SummaryCard label="UV-C status" value="Active" detail="Pending hardware integration" icon={ThermometerSun}/><SummaryCard label="MCU hardware" value={device.connection} detail="ESP32 connected" icon={Radio} tone="good"/><SummaryCard label="Processed volume" value={`${activeRun.processedVolume.toFixed(2)} L`} detail="Measured during the current run" icon={Droplets}/><SummaryCard label="Cycle time" value="00:18:42" detail="No final cycle limit configured" icon={Clock}/></div>
    <SectionCard title="Live Process Topology" description="Confirmed seven-stage physical sequence" action={<StatusBadge tone="Online">Live telemetry</StatusBadge>}><ProcessTopology/></SectionCard>
    <div><div className="mb-3 flex items-end justify-between"><div><h3 className="text-xl font-semibold">Differential Quality Telemetry</h3><p className="text-xs text-muted">Dual-stage sensor measurements captured synchronously</p></div><span className="eyebrow text-hydro">Before / After</span></div><div className="grid gap-3 xl:grid-cols-2"><SectionCard title="Before Filtration" description="Inlet sampling stage"><SensorGrid stage="before"/></SectionCard><SectionCard title="After Filtration" description="Post-filtration stage"><SensorGrid stage="after"/></SectionCard></div></div>
    <div className="notice"><CloudCog size={17} className="shrink-0 text-hydro"/><span>Sensor readings describe monitored physical parameters. Sensor telemetry alone does not establish microbiological potability, certification, or regulatory compliance.</span></div>
    <SectionCard title="Before vs After Filtration" description="Turbidity trend for the current test run" action={<span className="eyebrow text-muted">Turbidity · NTU</span>}><TelemetryChart/></SectionCard>
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionCard title="Recent System Alerts" action={<Link to="/alerts" className="text-xs font-semibold text-hydro">View all alerts →</Link>}><div className="space-y-2">{alerts.slice(0,3).map((alert)=><div key={alert.id} className="subpanel flex items-start justify-between gap-3 p-3"><div><div className="text-sm font-semibold">{alert.title}</div><div className="mt-1 text-xs text-muted">{alert.source} · {formatDateTime(alert.timestamp)}</div></div><StatusBadge tone={alert.severity}>{alert.status}</StatusBadge></div>)}</div></SectionCard>
      <SectionCard title="Current Test Run" action={<StatusBadge>{activeRun.status}</StatusBadge>}><div className="grid grid-cols-2 gap-2">{[['Test Run ID',activeRun.id],['Start time','14:05 UTC'],['Duration',activeRun.duration],['Processed volume',`${activeRun.processedVolume} L`]].map(([label,value])=><div className="subpanel p-3" key={label}><div className="eyebrow text-muted">{label}</div><div className="mono mt-1 text-sm font-semibold">{value}</div></div>)}</div><Link to="/test-runs" className="button-primary mt-3 w-full">View test run</Link></SectionCard>
    </div>
    <SectionCard title="Recent Sensor Telemetry Readings Log" description="Live telemetry"><div className="table-wrap"><table className="data-table"><thead><tr><th>Time</th><th>Pre pH</th><th>Post pH</th><th>Pre / Post Turbidity</th><th>Pre / Post TDS</th><th>Pre / Post Flow</th></tr></thead><tbody>{telemetry.slice(0,5).map((record)=><tr key={record.id}><td className="mono">{record.timestamp.slice(11,19)}</td><td className="mono">{record.before.pH.toFixed(2)}</td><td className="mono text-hydro">{record.after.pH.toFixed(2)}</td><td className="mono">{record.before.turbidity.toFixed(2)} / <span className="text-hydro">{record.after.turbidity.toFixed(2)}</span></td><td className="mono">{record.before.TDS} / <span className="text-hydro">{record.after.TDS}</span></td><td className="mono">{record.before.flowRate.toFixed(1)} / <span className="text-hydro">{record.after.flowRate.toFixed(1)}</span></td></tr>)}</tbody></table></div></SectionCard>
    <div className="grid gap-4 xl:grid-cols-2"><SectionCard title="Laboratory Validation" action={<StatusBadge>{validation.status}</StatusBadge>}><div className="space-y-2 text-sm">{[['Test Run ID',validation.testRunId],['Sample ID',validation.sampleId],['Reference result',validation.referenceResult===undefined?'Pending':'External comparison recorded'],['Validation status',`Laboratory Validation ${validation.status}`]].map(([label,value])=><div className="flex justify-between gap-3 border-b border-slate-200 pb-2" key={label}><span className="text-muted">{label}</span><span className="mono text-right text-xs">{value}</span></div>)}</div><Link to="/laboratory-validation" className="button-secondary mt-3 w-full">View laboratory records</Link></SectionCard><SectionCard title="ESP32 Device Status" action={<StatusBadge>{device.connection}</StatusBadge>}><div className="grid grid-cols-2 gap-2"><div className="subpanel p-3"><div className="eyebrow text-muted">Device ID</div><div className="mono mt-1 text-sm">{device.deviceId}</div></div><div className="subpanel p-3"><div className="eyebrow text-muted">Controller</div><div className="mono mt-1 text-sm">{device.controller}</div></div><div className="subpanel p-3"><div className="eyebrow text-muted">Connection</div><div className="mt-1 text-sm text-good">{device.connection}</div></div><div className="subpanel p-3"><div className="eyebrow text-muted">Fail-safe control</div><div className="mt-1 text-xs">{device.failSafeControl}</div></div></div><div className="notice mt-3"><Gauge size={17}/><span>Critical hardware fail-safe behavior remains local to the ESP32.</span></div></SectionCard></div>
  </div>
}
