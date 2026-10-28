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
import { alertsService,deviceService,telemetryService,testRunsService } from '../services'
import { formatDateTime,formatTime,formatOptionalNumber,formatStatusLabel } from '../utils/formatters'

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
  const telemetryResource=useServiceData(telemetryService.getTelemetryHistory)
  const deviceResource=useServiceData(deviceService.getDeviceStatus)
  const resources=[alertsResource,runsResource,telemetryResource,deviceResource]
  const unavailable=resources.find((resource)=>resource.status==='loading'||resource.status==='error')

  if(unavailable){
    return <div className="page-grid">
      <PageHeader title="System Dashboard" description="View saved records. The device connection and where the readings came from have not been confirmed." badge="Saved records"/>
      <ResourceState status={unavailable?.status??'loading'} error={unavailable?.error} loadingLabel="Loading dashboard…"/>
    </div>
  }

  const alerts=alertsResource.data??[]
  const activeRun=(runsResource.data??[]).find((run)=>run.status==='In Progress')??runsResource.data?.[0]
  const telemetry=telemetryResource.data??[]
  const device=deviceResource.data

  const latest=telemetry[0]

  return <div className="page-grid">
    <PageHeader title="System Dashboard" description="View saved records. The device connection and where the readings came from have not been confirmed." badge="Saved records"/>

    <div className="dashboard-grid" aria-label="System dashboard overview">
      <DashboardMetricCard className="dashboard-span-4" title="Filtering status" value="Not confirmed" detail={<>Saved test: <strong>{activeRun?.status??'No run recorded'}</strong></>} icon={Activity}/>
      <DashboardMetricCard className="dashboard-span-4" title="Turbidity: before and after" value={<><span>{formatOptionalNumber(latest?.before.turbidity)}</span><span className="dashboard-value-divider" aria-hidden="true"> / </span><span>{formatOptionalNumber(latest?.after.turbidity)}</span><span className="dashboard-value-unit"> NTU</span></>} detail="Saved readings; their device source is not confirmed" icon={Droplets} trend={<TelemetrySparkline label="Saved turbidity readings over time. Their device source is not confirmed."/>}/>
      <DashboardMetricCard className="dashboard-span-4" title="Saved water volume" value={<>{formatOptionalNumber(activeRun?.processedVolume)} <span className="dashboard-value-unit">L</span></>} detail={<>{activeRun?.displayId??'No run recorded'} · Saved record</>} icon={FlaskConical}/>

      <SectionCard className="dashboard-span-7" title="Turbidity: before and after" description="Saved readings before and after filtering · NTU" action={<span className="eyebrow text-muted">Saved readings</span>}>
        <TelemetryChart/>
      </SectionCard>

      <SectionCard className="dashboard-span-5" title="Test" description="Saved test record. The saved water volume is not a measured amount of filtered water." action={<StatusBadge tone="Pending">{activeRun?.status??'None recorded'}</StatusBadge>}>
        <div className="run-summary-grid">
          <div className="subpanel p-3"><div className="eyebrow text-muted">Test ID</div><div className="mono mt-1 text-sm font-semibold">{activeRun?.displayId??'—'}</div></div>
          <div className="subpanel p-3"><div className="eyebrow text-muted">Saved water volume</div><div className="mono mt-1 text-sm font-semibold">{formatOptionalNumber(activeRun?.processedVolume)} L</div></div>
          <div className="subpanel p-3"><div className="eyebrow text-muted">Saved duration</div><div className="mono mt-1 text-sm font-semibold">{activeRun?.duration??'—'}</div></div>
          <div className="subpanel p-3"><div className="eyebrow text-muted">Saved start time</div><div className="mono mt-1 text-xs font-semibold">{activeRun?formatDateTime(activeRun.startedAt):'—'}</div></div>
        </div>
        <Link to="/test-runs" className="button-primary mt-3 w-full">View test records</Link>
      </SectionCard>

      <SectionCard className="dashboard-span-7" title="Planned filtering steps" description="These steps show how filtering is planned to work. The current equipment status is not confirmed." action={<StatusBadge tone="Pending">Example steps</StatusBadge>}>
        <ProcessTopology/>
      </SectionCard>

      <SectionCard className="dashboard-span-5" title="Recorded alerts" description="Saved alerts" action={<Link to="/alerts" className="text-xs font-semibold text-hydro">View alert records →</Link>}>
        <div className="dashboard-activity-list">{alerts.length===0&&<p className="text-sm text-muted">No alert records are available.</p>}{alerts.slice(0,3).map((alert)=><div className="subpanel dashboard-activity-item" key={alert.id}>
          <div className="min-w-0"><div className="text-sm font-semibold">{alert.title??'Untitled alert'}</div><div className="mt-1 text-xs text-muted">{alert.source??'Unknown source'} · {formatDateTime(alert.timestamp)}</div></div>
          <StatusBadge tone={alert.severity}>{alert.status}</StatusBadge>
        </div>)}</div>
      </SectionCard>

      <SectionCard className="dashboard-span-6" title="Before filtering" description="Latest saved readings; accuracy is not confirmed">
        <SensorGrid stage="before"/>
      </SectionCard>
      <SectionCard className="dashboard-span-6" title="After filtering" description="Latest saved readings; accuracy is not confirmed">
        <SensorGrid stage="after"/>
      </SectionCard>

      <SectionCard className="dashboard-span-12" title="Sensor reading log" description="Saved readings · these do not confirm that the device is connected now">
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Time recorded</th><th>Before pH</th><th>After pH</th><th>Before / After turbidity</th><th>Before / After TDS</th><th>Before / After flow</th></tr></thead>
          <tbody>{telemetry.length===0&&<tr><td colSpan={6}>No sensor readings are available.</td></tr>}{telemetry.slice(0,5).map((record)=><tr key={record.id}>
            <td className="mono">{formatTime(record.timestamp,true)}</td>
            <td className="mono">{formatOptionalNumber(record.before.pH)}</td>
            <td className="mono">{formatOptionalNumber(record.after.pH)}</td>
            <td className="mono">{formatOptionalNumber(record.before.turbidity)} / {formatOptionalNumber(record.after.turbidity)}</td>
            <td className="mono">{formatOptionalNumber(record.before.TDS,0)} / {formatOptionalNumber(record.after.TDS,0)}</td>
            <td className="mono">{formatOptionalNumber(record.before.flowRate,1)} / {formatOptionalNumber(record.after.flowRate,1)}</td>
          </tr>)}</tbody>
        </table></div>
      </SectionCard>

      <SectionCard className="dashboard-span-6" title="Lab records" description="This page is turned off for now." action={<StatusBadge tone="Pending">Not available</StatusBadge>}>
        <div className="notice"><CloudCog size={16} className="shrink-0"/><span>Sensor readings alone do not prove that water is safe to drink. Existing lab records have been kept.</span></div>
      </SectionCard>

      <SectionCard className="dashboard-span-6" title="Device and controller" description="Saved device status. The current device connection is not confirmed." action={<StatusBadge tone="Pending">{device?.isSimulated?'Simulated device':'Connection not confirmed'}</StatusBadge>}>
        <dl className="dashboard-detail-list">
          <div><dt>Device ID</dt><dd className="mono">{device?.displayId??'No device registered'}</dd></div>
          <div><dt>Controller</dt><dd className="mono">{device?.controller??'—'}</dd></div>
          <div><dt>Saved connection status</dt><dd><StatusBadge tone="Pending">{device?.connection??'No device registered'}</StatusBadge></dd></div>
          <div><dt>Saved safety control status</dt><dd>{formatStatusLabel(device?.failSafeControl??'Not confirmed')}</dd></div>
        </dl>
        <div className="notice mt-3"><Gauge size={16} className="shrink-0"/><span>The ESP32 must handle essential device control and safety, even without internet access.</span></div>
      </SectionCard>
    </div>

    <div className="notice"><ThermometerSun size={17} className="shrink-0 text-hydro"/><span>Sensor readings alone cannot prove that water is free of harmful germs, safe to drink, certified, or meets required standards.</span></div>
  </div>
}
