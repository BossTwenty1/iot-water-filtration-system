import { Activity, CloudCog, Droplets, FlaskConical, Gauge, ThermometerSun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { ResourceState } from '../components/common/ResourceState'
import { SectionCard } from '../components/common/Cards'
import { StatusBadge } from '../components/common/StatusBadge'
import { ProcessTopology } from '../components/telemetry/ProcessTopology'
import { SensorGrid } from '../components/telemetry/SensorGrid'
import { TelemetryChart, TelemetrySparkline } from '../components/telemetry/TelemetryChart'
import { useServiceData } from '../hooks/useServiceData'
import { useRealtimeEvent } from '../hooks/useRealtime'
import { alertsService, deviceService, laboratoryValidationService, telemetryService, testRunsService } from '../services'
import type { DeviceStatus, SystemAlert, TelemetryRecord, TestRun } from '../types'
import { formatDateTime, formatOptionalNumber } from '../utils/formatters'

type DashboardMetricCardProps = {
  title: string
  value: ReactNode
  detail: ReactNode
  icon: LucideIcon
  trend?: ReactNode
  className: string
}

function DashboardMetricCard({ title, value, detail, icon: Icon, trend, className }: DashboardMetricCardProps) {
  return (
    <article className={`panel dashboard-metric-card ${className}`}>
      <div className="dashboard-metric-heading">
        <h3>{title}</h3>
        <span className="metric-icon">
          <Icon size={16} aria-hidden="true" />
        </span>
      </div>
      <div className="dashboard-metric-value">{value}</div>
      <p className="dashboard-metric-detail">{detail}</p>
      {trend && <div className="dashboard-metric-trend">{trend}</div>}
    </article>
  )
}

export function DashboardPage() {
  const alertsResource = useServiceData(alertsService.getAlerts)
  const runsResource = useServiceData(testRunsService.getTestRuns)
  const validationResource = useServiceData(laboratoryValidationService.getLaboratoryValidationRecords)
  const telemetryResource = useServiceData(telemetryService.getTelemetryHistory)
  const deviceResource = useServiceData(deviceService.getDeviceStatus)

  // 1. Reactive Telemetry: Prepend new readings and update metric cards
  useRealtimeEvent<TelemetryRecord[]>('telemetry', (records) => {
    if (!records.length) return
    telemetryResource.setData((prev) => {
      const existing = prev ? [...prev] : []
      const existingIds = new Set(existing.map((r) => r.id))
      const toAdd = records.filter((r) => !existingIds.has(r.id))
      return [...toAdd, ...existing]
    })
  })

  // 2. Reactive Alerts: Update alerts list and status transitions
  useRealtimeEvent<SystemAlert[]>('alert', (newAlerts) => {
    if (!newAlerts.length) return
    alertsResource.setData((prev) => {
      const existing = prev ? [...prev] : []
      const alertMap = new Map(existing.map((a) => [a.id, a]))
      for (const a of newAlerts) {
        alertMap.set(a.id, a)
      }
      return [...alertMap.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    })
  })

  // 3. Reactive Device Status: Update device card live
  useRealtimeEvent<DeviceStatus>('device', (status) => {
    deviceResource.setData(status)
  })

  // 4. Reactive Test Run: Update volume and status dynamically
  useRealtimeEvent<TestRun>('test_run', (run) => {
    runsResource.setData((prev) => {
      if (!prev) return [run]
      const idx = prev.findIndex((r) => r.id === run.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = run
        return copy
      }
      return [run, ...prev]
    })
  })

  const resources = [alertsResource, runsResource, validationResource, telemetryResource, deviceResource]
  const unavailable = resources.find((resource) => resource.status === 'loading' || resource.status === 'error')

  if (unavailable) {
    return (
      <div className="page-grid">
        <PageHeader
          title="System Dashboard"
          description="API-backed records; physical device connectivity and data provenance are not verified."
          badge="API records"
        />
        <ResourceState status={unavailable?.status ?? 'loading'} error={unavailable?.error} loadingLabel="Loading dashboard…" />
      </div>
    )
  }

  const alerts = alertsResource.data ?? []
  const activeRun = (runsResource.data ?? []).find((run) => run.status === 'In Progress') ?? runsResource.data?.[0]
  const validation = validationResource.data?.[0]
  const telemetry = telemetryResource.data ?? []
  const device = deviceResource.data

  const latest = telemetry[0]

  return (
    <div className="page-grid">
      <PageHeader
        title="System Dashboard"
        description="Continuous live monitoring console for the IoT water filtration system."
        badge="Live stream active"
      />

      <div className="dashboard-grid" aria-label="System dashboard overview">
        <DashboardMetricCard
          className="dashboard-span-4"
          title="Process state"
          value={activeRun?.status === 'In Progress' ? 'Filtration Active' : 'System Idle'}
          detail={
            <>
              Software run: <strong>{activeRun?.status ?? 'No run recorded'}</strong>
            </>
          }
          icon={Activity}
        />
        <DashboardMetricCard
          className="dashboard-span-4"
          title="Turbidity comparison"
          value={
            <>
              <span>{formatOptionalNumber(latest?.before?.turbidity)}</span>
              <span className="dashboard-value-divider" aria-hidden="true">
                {' '}
                /{' '}
              </span>
              <span>{formatOptionalNumber(latest?.after?.turbidity)}</span>
              <span className="dashboard-value-unit"> NTU</span>
            </>
          }
          detail="Live embedded sensor telemetry (Pre / Post)"
          icon={Droplets}
          trend={<TelemetrySparkline label="Turbidity trend" />}
        />
        <DashboardMetricCard
          className="dashboard-span-4"
          title="Stored run volume"
          value={
            <>
              {formatOptionalNumber(activeRun?.processedVolume)} <span className="dashboard-value-unit">L</span>
            </>
          }
          detail={<>{activeRun?.id ?? 'No run recorded'} · Dynamic accumulation</>}
          icon={FlaskConical}
        />

        <SectionCard
          className="dashboard-span-7"
          title="Turbidity comparison"
          description="Real-time pre- and post-filtration telemetry · NTU"
          action={<span className="eyebrow text-muted">Continuous series</span>}
        >
          <TelemetryChart />
        </SectionCard>

        <SectionCard
          className="dashboard-span-5"
          title="Test run"
          description="Live experimental session tracking"
          action={<StatusBadge tone={activeRun?.status === 'In Progress' ? 'Good' : 'Pending'}>{activeRun?.status ?? 'None recorded'}</StatusBadge>}
        >
          <div className="run-summary-grid">
            <div className="subpanel p-3">
              <div className="eyebrow text-muted">Test run ID</div>
              <div className="mono mt-1 text-sm font-semibold">{activeRun?.id ?? '—'}</div>
            </div>
            <div className="subpanel p-3">
              <div className="eyebrow text-muted">Stored volume</div>
              <div className="mono mt-1 text-sm font-semibold">{formatOptionalNumber(activeRun?.processedVolume)} L</div>
            </div>
            <div className="subpanel p-3">
              <div className="eyebrow text-muted">Recorded duration</div>
              <div className="mono mt-1 text-sm font-semibold">{activeRun?.duration ?? '—'}</div>
            </div>
            <div className="subpanel p-3">
              <div className="eyebrow text-muted">Recorded start time</div>
              <div className="mono mt-1 text-xs font-semibold">{activeRun ? formatDateTime(activeRun.startedAt) : '—'}</div>
            </div>
          </div>
          <Link to="/test-runs" className="button-primary mt-3 w-full">
            View test-run records
          </Link>
        </SectionCard>

        <SectionCard
          className="dashboard-span-7"
          title="Configured process sequence"
          description="Filtration stages and sensor placement architecture."
          action={<StatusBadge tone="Pending">System flow</StatusBadge>}
        >
          <ProcessTopology />
        </SectionCard>

        <SectionCard
          className="dashboard-span-5"
          title="Recorded alerts"
          description="Real-time alerts and threshold warnings"
          action={
            <Link to="/alerts" className="text-xs font-semibold text-hydro">
              View alert records →
            </Link>
          }
        >
          <div className="dashboard-activity-list">
            {alerts.length === 0 && <p className="text-sm text-muted">No alert records are available.</p>}
            {alerts.slice(0, 3).map((alert) => (
              <div className="subpanel dashboard-activity-item" key={alert.id}>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{alert.title ?? 'Untitled alert'}</div>
                  <div className="mt-1 text-xs text-muted">
                    {alert.source ?? 'Unknown source'} · {formatDateTime(alert.timestamp)}
                  </div>
                </div>
                <StatusBadge tone={alert.severity}>{alert.status}</StatusBadge>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="dashboard-span-6" title="Before filtration" description="Latest pre-filtration sensor readings">
          <SensorGrid stage="before" />
        </SectionCard>
        <SectionCard className="dashboard-span-6" title="After filtration" description="Latest post-filtration sensor readings">
          <SensorGrid stage="after" />
        </SectionCard>

        <SectionCard className="dashboard-span-12" title="Telemetry log" description="Live incoming sensor data cycles">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Recorded time</th>
                  <th>Pre pH</th>
                  <th>Post pH</th>
                  <th>Pre / Post turbidity</th>
                  <th>Pre / Post TDS</th>
                  <th>Pre / Post flow</th>
                </tr>
              </thead>
              <tbody>
                {telemetry.length === 0 && (
                  <tr>
                    <td colSpan={6}>No telemetry records are available.</td>
                  </tr>
                )}
                {telemetry.slice(0, 5).map((record) => (
                  <tr key={record.id}>
                    <td className="mono">{record.timestamp.slice(11, 19)}</td>
                    <td className="mono">{formatOptionalNumber(record.before?.pH)}</td>
                    <td className="mono">{formatOptionalNumber(record.after?.pH)}</td>
                    <td className="mono">
                      {formatOptionalNumber(record.before?.turbidity)} / {formatOptionalNumber(record.after?.turbidity)}
                    </td>
                    <td className="mono">
                      {formatOptionalNumber(record.before?.TDS, 0)} / {formatOptionalNumber(record.after?.TDS, 0)}
                    </td>
                    <td className="mono">
                      {formatOptionalNumber(record.before?.flowRate, 1)} / {formatOptionalNumber(record.after?.flowRate, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          className="dashboard-span-6"
          title="Laboratory record"
          description="Independent water analysis validation status"
          action={<StatusBadge tone={validation?.status === 'Available' ? 'Good' : 'Pending'}>{validation?.status ?? 'None recorded'}</StatusBadge>}
        >
          <dl className="dashboard-detail-list">
            <div>
              <dt>Test run</dt>
              <dd className="mono">{validation?.testRunId ?? '—'}</dd>
            </div>
            <div>
              <dt>Sample ID</dt>
              <dd className="mono">{validation?.sampleId ?? '—'}</dd>
            </div>
            <div>
              <dt>Reference value</dt>
              <dd>{validation?.referenceResult === undefined ? 'Not recorded' : 'Recorded; laboratory validated'}</dd>
            </div>
          </dl>
          <div className="notice mt-3">
            <CloudCog size={16} className="shrink-0" />
            <span>Laboratory physical/chemical validation operates independently from embedded sensor telemetry.</span>
          </div>
          <Link to="/laboratory-validation" className="button-secondary mt-3 w-full">
            View laboratory records
          </Link>
        </SectionCard>

        <SectionCard
          className="dashboard-span-6"
          title="Device and controller"
          description="Hardware link and controller state"
          action={
            <StatusBadge tone={device?.connection === 'Online' ? 'Good' : device?.connection === 'Offline' ? 'Warning' : 'Pending'}>
              {device?.connection ?? 'No device registered'}
            </StatusBadge>
          }
        >
          <dl className="dashboard-detail-list">
            <div>
              <dt>Device ID</dt>
              <dd className="mono">{device?.deviceId ?? 'No device registered'}</dd>
            </div>
            <div>
              <dt>Controller</dt>
              <dd className="mono">{device?.controller ?? '—'}</dd>
            </div>
            <div>
              <dt>Recorded state</dt>
              <dd>
                <StatusBadge tone={device?.connection === 'Online' ? 'Good' : device?.connection === 'Offline' ? 'Warning' : 'Pending'}>
                  {device?.connection ?? 'No device registered'}
                </StatusBadge>
              </dd>
            </div>
            <div>
              <dt>Fail-safe integration</dt>
              <dd>{device?.failSafeControl ?? 'Local Control Active'}</dd>
            </div>
          </dl>
          <div className="notice mt-3">
            <Gauge size={16} className="shrink-0" />
            <span>Critical physical control and safety logic remain autonomous on the local ESP32 controller.</span>
          </div>
        </SectionCard>
      </div>

      <div className="notice">
        <ThermometerSun size={17} className="shrink-0 text-hydro" />
        <span>
          Sensor readings describe monitored physical parameters. Sensor telemetry alone does not establish microbiological potability, certification, or regulatory compliance.
        </span>
      </div>
    </div>
  )
}
