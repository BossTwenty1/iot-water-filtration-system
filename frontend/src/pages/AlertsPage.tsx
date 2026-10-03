import { AlertTriangle, Bell, CheckCircle2, Download } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { SectionCard, SummaryCard } from '../components/common/Cards'
import { FilterToolbar, SelectField } from '../components/common/Filters'
import { ResourceState } from '../components/common/ResourceState'
import { StatusBadge } from '../components/common/StatusBadge'
import { useActionFeedback } from '../hooks/useActionFeedback'
import { useServiceData } from '../hooks/useServiceData'
import { useRealtimeEvent } from '../hooks/useRealtime'
import { alertsService } from '../services'
import type { AlertStatus, SystemAlert } from '../types'
import { downloadCsv } from '../utils/csv'
import { formatDateTime } from '../utils/formatters'

export function AlertsPage() {
  const { actionError, pending, runAction } = useActionFeedback()
  const resource = useServiceData(alertsService.getAlerts)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [severity, setSeverity] = useState('All Severities')
  const [status, setStatus] = useState('All Statuses')

  // Real-time synchronization for new alerts and state transitions (Acknowledge/Resolve)
  useRealtimeEvent<SystemAlert[]>('alert', (newAlerts) => {
    if (!newAlerts.length) return
    resource.setData((prev) => {
      const existing = prev ? [...prev] : []
      const map = new Map(existing.map((a) => [a.id, a]))
      for (const a of newAlerts) {
        map.set(a.id, a)
      }
      return [...map.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    })
  })

  const alerts = resource.data ?? []
  const selected = alerts.find((alert) => alert.id === selectedId) ?? alerts[0]
  const visible = alerts.filter(
    (alert) => (severity === 'All Severities' || alert.severity === severity) && (status === 'All Statuses' || alert.status === status)
  )

  const update = async (next: AlertStatus) => {
    if (!selected) return
    const updated = next === 'Acknowledged' ? await alertsService.acknowledgeAlert(selected.id) : await alertsService.resolveAlert(selected.id)
    resource.setData((items) => items?.map((item) => (item.id === updated.id ? updated : item)) ?? null)
  }

  const exportRows = () =>
    downloadCsv(
      'alerts.csv',
      visible.map((a) => ({
        timestamp: a.timestamp,
        severity: a.severity,
        source: a.source ?? '',
        alert: a.title ?? '',
        test_run: a.testRunId,
        status: a.status,
      }))
    )

  if (resource.status !== 'success' || !selected) {
    return (
      <div className="page-grid">
        {actionError && (
          <div className="notice text-danger" role="alert">
            {actionError}
          </div>
        )}
        {pending && (
          <div className="notice" role="status">
            Saving to the API…
          </div>
        )}
        <PageHeader
          title="System Alerts"
          description="Review API-backed warnings and events; source and hardware state require verification"
          badge="Live stream active"
        />
        <ResourceState status={resource.status} error={resource.error} loadingLabel="Loading alerts…" emptyLabel="No alerts available." />
      </div>
    )
  }

  return (
    <div className="page-grid">
      {actionError && (
        <div className="notice text-danger" role="alert">
          {actionError}
        </div>
      )}
      {pending && (
        <div className="notice" role="status">
          Saving to the API…
        </div>
      )}
      <PageHeader
        title="System Alerts"
        description="Real-time warning notifications, sensor faults, and hardware status alerts."
        badge="Live stream active"
        actions={
          <button className="button-secondary" type="button" onClick={exportRows}>
            <Download size={16} />
            Export CSV
          </button>
        }
      />
      <div className="summary-grid">
        <SummaryCard label="Active alerts" value={alerts.filter((a) => a.status === 'Active').length} detail="Active monitoring events" icon={Bell} />
        <SummaryCard
          label="Critical alerts"
          value={alerts.filter((a) => a.severity === 'Critical' && a.status !== 'Resolved').length}
          detail="Requires immediate action"
          icon={AlertTriangle}
          tone="danger"
        />
        <SummaryCard
          label="Warnings"
          value={alerts.filter((a) => a.severity === 'Warning' && a.status !== 'Resolved').length}
          detail="Cautionary alerts"
          icon={AlertTriangle}
          tone="warn"
        />
        <SummaryCard label="Resolved alerts" value={alerts.filter((a) => a.status === 'Resolved').length} detail="Historical records" icon={CheckCircle2} tone="good" />
      </div>
      <FilterToolbar
        onReset={() => {
          setSeverity('All Severities')
          setStatus('All Statuses')
        }}
      >
        <SelectField label="Severity" value={severity} onChange={setSeverity} options={['All Severities', 'Information', 'Warning', 'Critical']} />
        <SelectField label="Status" value={status} onChange={setStatus} options={['All Statuses', 'Active', 'Acknowledged', 'Resolved']} />
      </FilterToolbar>
      <div className="detail-grid">
        <div className="page-grid">
          <SectionCard title="Open Alerts" description="Active and acknowledged alerts awaiting resolution">
            <div className="space-y-2">
              {alerts.filter((alert) => alert.status !== 'Resolved').length === 0 && (
                <p className="text-xs text-muted">No open alerts at this time. All conditions normal.</p>
              )}
              {alerts
                .filter((alert) => alert.status !== 'Resolved')
                .map((alert) => (
                  <button
                    type="button"
                    key={alert.id}
                    className="w-full rounded-md border border-slate-200 bg-white p-3 text-left hover:border-sky-300"
                    onClick={() => setSelectedId(alert.id)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{alert.title ?? 'Untitled alert'}</div>
                        <div className="mono mt-1 text-[10px] text-muted">
                          {alert.source ?? 'Unknown source'} · {alert.timestamp.slice(11, 19)} UTC
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <StatusBadge tone={alert.severity}>{alert.severity}</StatusBadge>
                        <StatusBadge>{alert.status}</StatusBadge>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted">{alert.message}</p>
                  </button>
                ))}
            </div>
          </SectionCard>
          <SectionCard title="Alert History" description={`${visible.length} filtered records`}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Severity</th>
                    <th>Source</th>
                    <th>Alert</th>
                    <th>Test Run</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((alert) => (
                    <tr key={alert.id} data-selected={selected.id === alert.id}>
                      <td className="mono">{alert.timestamp.slice(11, 19)}</td>
                      <td>
                        <StatusBadge tone={alert.severity}>{alert.severity}</StatusBadge>
                      </td>
                      <td>{alert.source ?? 'Unknown source'}</td>
                      <td>{alert.title ?? 'Untitled alert'}</td>
                      <td className="mono">{alert.testRunId ?? '—'}</td>
                      <td>
                        <StatusBadge>{alert.status}</StatusBadge>
                      </td>
                      <td>
                        <button className="button-quiet" type="button" onClick={() => setSelectedId(alert.id)}>
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
        <SectionCard title="Alert Inspector" action={<StatusBadge>{selected.status}</StatusBadge>}>
          <div className="space-y-3">
            <div>
              <div className="eyebrow text-muted">Alert ID</div>
              <div className="mono mt-1 font-semibold">{selected.id}</div>
            </div>
            <div className="subpanel p-3 text-xs">
              <div className="grid gap-3">
                <div>
                  <span className="text-muted">Time recorded</span>
                  <div className="mono">{formatDateTime(selected.timestamp)}</div>
                </div>
                <div>
                  <span className="text-muted">Source</span>
                  <div>{selected.source}</div>
                </div>
                <div>
                  <span className="text-muted">Test Run</span>
                  <div className="mono">{selected.testRunId ?? 'None'}</div>
                </div>
              </div>
            </div>
            <div>
              <div className="eyebrow text-muted">Diagnostic summary</div>
              <p className="mt-1 text-sm leading-relaxed">{selected.message ?? 'No diagnostic message recorded.'}</p>
            </div>
            <div className="grid gap-2">
              <button
                type="button"
                className="button-primary"
                onClick={() => void runAction(() => update('Acknowledged'))}
                disabled={selected.status !== 'Active'}
              >
                Acknowledge Alert
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => void runAction(() => update('Resolved'))}
                disabled={selected.status === 'Resolved'}
              >
                Mark Resolved
              </button>
            </div>
            <p className="text-xs text-muted">Alert acknowledgements sync immediately across all connected clients.</p>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
