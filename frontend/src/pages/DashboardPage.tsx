import { Activity,CloudCog,Droplets,FlaskConical,Gauge,ThermometerSun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { ResourceState } from '../components/common/ResourceState'
import { SectionCard } from '../components/common/Cards'
import { StatusBadge } from '../components/common/StatusBadge'
import { ProcessTopology } from '../components/telemetry/ProcessTopology'
import { SensorGrid } from '../components/telemetry/SensorGrid'
import { TelemetryChart,TelemetrySparkline } from '../components/telemetry/TelemetryChart'
import { useServiceData } from '../hooks/useServiceData'
import { alertsService,deviceService,laboratoryValidationService,telemetryService,testRunsService } from '../services'
import { formatDateTime } from '../utils/formatters'

type DashboardMetricCardProps={title:string;value:ReactNode;detail:ReactNode;icon:LucideIcon;trend?:ReactNode;className:string}

function DashboardMetricCard({title,value,detail,icon:Icon,trend,className}:DashboardMetricCardProps){
  return <article className={`panel dashboard-metric-card ${className}`}>
    <div className="dashboard-metric-heading"><h3>{title}</h3><span className="metric-icon"><Icon size={16} aria-hidden="true"/></span></div>
    <div className="dashboard-metric-value">{value}</div>
    <p className="dashboard-metric-detail">{detail}</p>
    {trend&&<div className="dashboard-metric-trend">{trend}</div>}
  </article>
}

export function DashboardPage() {
  const alertsResource=useServiceData(alertsService.getAlerts)
  const runsResource=useServiceData(testRunsService.getTestRuns)
  const validationResource=useServiceData(laboratoryValidationService.getLaboratoryValidationRecords)
  const telemetryResource=useServiceData(telemetryService.getTelemetryHistory)
  const deviceResource=useServiceData(deviceService.getDeviceStatus)
  const resources=[alertsResource,runsResource,validationResource,telemetryResource,deviceResource]
  const unavailable=resources.find((resource)=>resource.status!=='success')

  if(unavailable||!alertsResource.data||!runsResource.data||!validationResource.data||!telemetryResource.data||!deviceResource.data){
    return <div className="page-grid">
      <PageHeader title="System Dashboard" description="Representative filtration records; live device state is not confirmed." badge="Representative data"/>
      <ResourceState status={unavailable?.status??'loading'} error={unavailable?.error} loadingLabel="Loading dashboard…"/>
    </div>
  }

  const alerts=alertsResource.data
  const activeRun=runsResource.data[0]
  const validation=validationResource.data[0]
  const telemetry=telemetryResource.data
  const device=deviceResource.data

  if(!activeRun||!validation||telemetry.length===0){
    return <div className="page-grid">
      <PageHeader title="System Dashboard" description="Representative filtration records; live device state is not confirmed." badge="Representative data"/>
      <ResourceState status="empty" loadingLabel="Loading dashboard…" emptyLabel="No representative dashboard records are available."/>
    </div>
  }

  const latest=telemetry[0]

  return <div className="page-grid">
    <PageHeader title="System Dashboard" description="Representative records only · live device state and telemetry are not confirmed." badge="Representative data"/>

    <div className="dashboard-grid" aria-label="System dashboard overview">
      <DashboardMetricCard className="dashboard-span-4" title="Process state" value="Not confirmed" detail={<>Sample run record: <strong>{activeRun.status}</strong></>} icon={Activity}/>
      <DashboardMetricCard className="dashboard-span-4" title="Turbidity comparison" value={<><span>{latest.before.turbidity.toFixed(2)}</span><span className="dashboard-value-divider" aria-hidden="true"> / </span><span>{latest.after.turbidity.toFixed(2)}</span><span className="dashboard-value-unit"> NTU</span></>} detail="Representative before / after sensor values" icon={Droplets} trend={<TelemetrySparkline label="Representative before- and after-filtration turbidity trend"/>}/>
      <DashboardMetricCard className="dashboard-span-4" title="Sample run volume" value={<>{activeRun.processedVolume.toFixed(2)} <span className="dashboard-value-unit">L</span></>} detail={<>{activeRun.id} · representative record</>} icon={FlaskConical}/>

      <SectionCard className="dashboard-span-7" title="Turbidity comparison" description="Representative pre- and post-filtration telemetry · NTU" action={<span className="eyebrow text-muted">Sample series</span>}>
        <TelemetryChart/>
      </SectionCard>

      <SectionCard className="dashboard-span-5" title="Sample test run" description="Software research record · no hardware control" action={<StatusBadge tone="Pending">Sample · {activeRun.status}</StatusBadge>}>
        <div className="run-summary-grid">
          <div className="subpanel p-3"><div className="eyebrow text-muted">Test run ID</div><div className="mono mt-1 text-sm font-semibold">{activeRun.id}</div></div>
          <div className="subpanel p-3"><div className="eyebrow text-muted">Sample volume</div><div className="mono mt-1 text-sm font-semibold">{activeRun.processedVolume.toFixed(2)} L</div></div>
          <div className="subpanel p-3"><div className="eyebrow text-muted">Recorded duration</div><div className="mono mt-1 text-sm font-semibold">{activeRun.duration}</div></div>
          <div className="subpanel p-3"><div className="eyebrow text-muted">Sample start time</div><div className="mono mt-1 text-xs font-semibold">{formatDateTime(activeRun.startedAt)}</div></div>
        </div>
        <Link to="/test-runs" className="button-primary mt-3 w-full">View test-run records</Link>
      </SectionCard>

      <SectionCard className="dashboard-span-7" title="Configured process sequence" description="Stage labels and example states are representative, not live-confirmed." action={<StatusBadge tone="Pending">Sample sequence</StatusBadge>}>
        <ProcessTopology/>
      </SectionCard>

      <SectionCard className="dashboard-span-5" title="Representative alerts" description="Sample alert records for operator-flow review" action={<Link to="/alerts" className="text-xs font-semibold text-hydro">View alert records →</Link>}>
        <div className="dashboard-activity-list">{alerts.slice(0,3).map((alert)=><div className="subpanel dashboard-activity-item" key={alert.id}>
          <div className="min-w-0"><div className="text-sm font-semibold">{alert.title}</div><div className="mt-1 text-xs text-muted">{alert.source} · {formatDateTime(alert.timestamp)}</div></div>
          <StatusBadge tone={alert.severity}>{alert.status}</StatusBadge>
        </div>)}</div>
      </SectionCard>

      <SectionCard className="dashboard-span-6" title="Before filtration" description="Representative inlet sensor values">
        <SensorGrid stage="before"/>
      </SectionCard>
      <SectionCard className="dashboard-span-6" title="After filtration" description="Representative outlet sensor values">
        <SensorGrid stage="after"/>
      </SectionCard>

      <SectionCard className="dashboard-span-12" title="Representative telemetry log" description="Sample record timestamps and values · not a live feed">
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Sample time</th><th>Pre pH</th><th>Post pH</th><th>Pre / Post turbidity</th><th>Pre / Post TDS</th><th>Pre / Post flow</th></tr></thead>
          <tbody>{telemetry.slice(0,5).map((record)=><tr key={record.id}>
            <td className="mono">{record.timestamp.slice(11,19)}</td>
            <td className="mono">{record.before.pH.toFixed(2)}</td>
            <td className="mono">{record.after.pH.toFixed(2)}</td>
            <td className="mono">{record.before.turbidity.toFixed(2)} / {record.after.turbidity.toFixed(2)}</td>
            <td className="mono">{record.before.TDS} / {record.after.TDS}</td>
            <td className="mono">{record.before.flowRate.toFixed(1)} / {record.after.flowRate.toFixed(1)}</td>
          </tr>)}</tbody>
        </table></div>
      </SectionCard>

      <SectionCard className="dashboard-span-6" title="Sample laboratory record" description="Representative validation metadata" action={<StatusBadge tone="Pending">Sample · {validation.status}</StatusBadge>}>
        <dl className="dashboard-detail-list">
          <div><dt>Sample test run</dt><dd className="mono">{validation.testRunId}</dd></div>
          <div><dt>Sample ID</dt><dd className="mono">{validation.sampleId}</dd></div>
          <div><dt>Reference value</dt><dd>{validation.referenceResult===undefined?'Pending in sample record':'Present in sample record'}</dd></div>
        </dl>
        <div className="notice mt-3"><CloudCog size={16} className="shrink-0"/><span>This is representative UI data, not a verified laboratory report or evidence of potability.</span></div>
        <Link to="/laboratory-validation" className="button-secondary mt-3 w-full">View laboratory records</Link>
      </SectionCard>

      <SectionCard className="dashboard-span-6" title="Device and controller" description="Representative device record · connection not confirmed" action={<StatusBadge tone="Pending">Connection not confirmed</StatusBadge>}>
        <dl className="dashboard-detail-list">
          <div><dt>Sample device ID</dt><dd className="mono">{device.deviceId}</dd></div>
          <div><dt>Controller</dt><dd className="mono">{device.controller}</dd></div>
          <div><dt>Recorded sample state</dt><dd><StatusBadge tone="Pending">Sample · {device.connection}</StatusBadge></dd></div>
          <div><dt>Fail-safe integration</dt><dd>{device.failSafeControl}</dd></div>
        </dl>
        <div className="notice mt-3"><Gauge size={16} className="shrink-0"/><span>Critical hardware control and fail-safe behavior must remain local to the ESP32.</span></div>
      </SectionCard>
    </div>

    <div className="notice"><ThermometerSun size={17} className="shrink-0 text-hydro"/><span>Sensor readings describe monitored physical parameters. Sensor telemetry alone does not establish microbiological potability, certification, or regulatory compliance.</span></div>
  </div>
}
