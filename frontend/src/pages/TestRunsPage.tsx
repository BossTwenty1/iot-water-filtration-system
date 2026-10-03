import { Download, FlaskConical, Plus, Square } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { SectionCard, SummaryCard } from '../components/common/Cards'
import { Modal } from '../components/common/Overlay'
import { ResourceState } from '../components/common/ResourceState'
import { StatusBadge } from '../components/common/StatusBadge'
import { TelemetryChart } from '../components/telemetry/TelemetryChart'
import { SensorGrid } from '../components/telemetry/SensorGrid'
import { useActionFeedback } from '../hooks/useActionFeedback'
import { useServiceData } from '../hooks/useServiceData'
import { useRealtimeEvent } from '../hooks/useRealtime'
import { alertsService, testRunsService } from '../services'
import type { SystemAlert, TestRun } from '../types'
import { downloadCsv } from '../utils/csv'
import { formatDateTime } from '../utils/formatters'

export function TestRunsPage() {
  const { actionError, pending, runAction } = useActionFeedback()
  const runsResource = useServiceData(testRunsService.getTestRuns)
  const alertsResource = useServiceData(alertsService.getAlerts)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [sampleInformation, setSampleInformation] = useState('')
  const [newNotes, setNewNotes] = useState('')

  // 1. Reactive Test Run updates (volume accumulation, status transitions)
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

  // 2. Reactive Alerts associated with test runs
  useRealtimeEvent<SystemAlert[]>('alert', (newAlerts) => {
    if (!newAlerts.length) return
    alertsResource.setData((prev) => {
      const existing = prev ? [...prev] : []
      const map = new Map(existing.map((a) => [a.id, a]))
      for (const a of newAlerts) {
        map.set(a.id, a)
      }
      return [...map.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    })
  })

  const runs = runsResource.data ?? []
  const alerts = alertsResource.data ?? []
  const selected = runs.find((run) => run.id === selectedId) ?? runs[0]
  const currentNotes = selectedId ? notes : selected?.notes ?? ''

  const createRun = async () => {
    const run = await testRunsService.createTestRun({ sampleInformation, notes: newNotes })
    runsResource.setData((items) => (items ? [run, ...items] : [run]))
    setSelectedId(run.id)
    setNotes(run.notes)
    setSampleInformation('')
    setNewNotes('')
    setNewOpen(false)
  }

  const endRun = async () => {
    if (!selected) return
    const updated = await testRunsService.completeTestRun(selected.id)
    runsResource.setData((items) => items?.map((run) => (run.id === updated.id ? updated : run)) ?? null)
    setEndOpen(false)
  }

  const saveNotes = async () => {
    if (!selected) return
    const updated = await testRunsService.updateTestRunNotes(selected.id, currentNotes)
    runsResource.setData((items) => items?.map((run) => (run.id === updated.id ? updated : run)) ?? null)
  }

  const exportRows = () =>
    downloadCsv(
      'test-runs.csv',
      runs.map((r) => ({
        run_id: r.id,
        started_at: r.startedAt,
        ended_at: r.endedAt,
        duration: r.duration,
        volume_l: r.processedVolume,
        status: r.status,
        telemetry_records: r.telemetryCount,
        alerts: r.alertCount,
        validation: r.validationStatus,
      }))
    )

  const unavailable = [runsResource, alertsResource].find((resource) => resource.status === 'loading' || resource.status === 'error')
  if (unavailable) {
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
        <PageHeader title="Test Runs" description="Manage API-backed software research records; no hardware is controlled" badge="Live stream active" />
        <ResourceState status={unavailable.status} error={unavailable.error} loadingLabel="Loading test runs…" />
      </div>
    )
  }

  if (!selected) {
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
        <PageHeader title="Test Runs" description="No software test-run records are available in the API yet." badge="Live stream active" />
        <SectionCard title="Create the first software record">
          <div className="field">
            <label htmlFor="first-run-sample">Water source or sample information</label>
            <input id="first-run-sample" className="control" value={sampleInformation} onChange={(event) => setSampleInformation(event.target.value)} />
          </div>
          <div className="field mt-3">
            <label htmlFor="first-run-notes">Research notes</label>
            <textarea id="first-run-notes" className="control min-h-24" value={newNotes} onChange={(event) => setNewNotes(event.target.value)} />
          </div>
          <p className="mt-3 text-xs text-muted">This saves a backend research record only; it does not start a pump, UV-C, relay, or valve.</p>
          <button className="button-primary mt-3" type="button" onClick={() => void runAction(createRun)}>
            Create software record
          </button>
        </SectionCard>
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
        title="Test Runs"
        description="Manage and review experimental filtration sessions with continuous volume and telemetry synchronization."
        badge="Live stream active"
        actions={
          <>
            <button className="button-secondary" type="button" onClick={exportRows}>
              <Download size={16} />
              Export Test Run CSV
            </button>
            <button className="button-primary" type="button" onClick={() => setNewOpen(true)}>
              <Plus size={16} />
              New Test Run
            </button>
          </>
        }
      />
      <div className="summary-grid">
        <SummaryCard label="Loaded test runs" value={runs.length} detail="Session records" icon={FlaskConical} />
        <SummaryCard label="Completed" value={runs.filter((r) => r.status === 'Completed').length} detail="Finished trials" tone="good" />
        <SummaryCard label="In progress" value={runs.filter((r) => r.status === 'In Progress').length} detail="Active recording" />
        <SummaryCard label="Validation pending" value={runs.filter((r) => r.validationStatus === 'Pending').length} detail="Lab analysis awaiting" tone="warn" />
      </div>
      <SectionCard
        title={`Current Test Run · ${selected.id}`}
        description="Live experimental telemetry and volume tracking"
        action={
          selected.status === 'In Progress' ? (
            <button className="button-danger" type="button" onClick={() => setEndOpen(true)}>
              <Square size={15} />
              End Test Run
            </button>
          ) : (
            <StatusBadge>{selected.status}</StatusBadge>
          )
        }
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['Started', formatDateTime(selected.startedAt)],
            ['Elapsed time', selected.duration],
            ['Integrated volume', `${selected.processedVolume.toFixed(2)} L`],
            ['Status', selected.status],
            ['Validation', selected.validationStatus],
          ].map(([label, value]) => (
            <div className="subpanel p-3" key={label}>
              <div className="eyebrow text-muted">{label}</div>
              <div className="mono mt-1 text-xs font-semibold">{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-semibold">Before Filtration Snapshot</h4>
            <SensorGrid stage="before" />
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold">After Filtration Snapshot</h4>
            <SensorGrid stage="after" />
          </div>
        </div>
      </SectionCard>
      <div className="detail-grid">
        <SectionCard title="Test Run Records" description={`${runs.length} records`}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Start Time</th>
                  <th>Duration</th>
                  <th>Volume</th>
                  <th>Status</th>
                  <th>Telemetry</th>
                  <th>Alerts</th>
                  <th>Validation</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} data-selected={selected.id === run.id}>
                    <td className="mono font-semibold text-hydro">{run.id}</td>
                    <td className="mono">{run.startedAt.slice(0, 16).replace('T', ' ')}</td>
                    <td className="mono">{run.duration}</td>
                    <td className="mono">{run.processedVolume.toFixed(2)} L</td>
                    <td>
                      <StatusBadge tone={run.status === 'In Progress' ? 'Good' : 'Pending'}>{run.status}</StatusBadge>
                    </td>
                    <td className="mono">{run.telemetryCount}</td>
                    <td className="mono">{run.alertCount}</td>
                    <td>
                      <StatusBadge>{run.validationStatus}</StatusBadge>
                    </td>
                    <td>
                      <button
                        className="button-quiet"
                        type="button"
                        onClick={() => {
                          setSelectedId(run.id)
                          setNotes(run.notes)
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
        <div className="page-grid">
          <SectionCard title="Test Run Inspector" action={<StatusBadge>{selected.status}</StatusBadge>}>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="subpanel p-3">
                <span className="text-muted">Run ID</span>
                <div className="mono font-semibold">{selected.id}</div>
              </div>
              <div className="subpanel p-3">
                <span className="text-muted">Stored volume</span>
                <div className="mono font-semibold">{selected.processedVolume.toFixed(2)} L</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted">
              Laboratory Validation: <StatusBadge>{selected.validationStatus}</StatusBadge>
            </div>
          </SectionCard>
          <SectionCard title="Recent Sensor Trends">
            <TelemetryChart compact />
          </SectionCard>
          <SectionCard title="Associated Alerts">
            {alerts.filter((a) => a.testRunId === selected.id).slice(0, 2).map((a) => (
              <div className="mb-2 border-b border-slate-200 pb-2 text-xs" key={a.id}>
                <div className="flex justify-between">
                  <strong>{a.title ?? 'Untitled alert'}</strong>
                  <StatusBadge tone={a.severity}>{a.status}</StatusBadge>
                </div>
                <p className="mt-1 text-muted">{a.message ?? 'No message recorded.'}</p>
              </div>
            ))}
            {alerts.filter((a) => a.testRunId === selected.id).length === 0 && (
              <p className="text-xs text-muted">No alerts raised during this test run.</p>
            )}
          </SectionCard>
          <SectionCard title="Research Notes" action={<span className="eyebrow text-muted">Save to API</span>}>
            <label className="sr-only" htmlFor="run-notes">
              Research notes
            </label>
            <textarea
              id="run-notes"
              name="research-notes"
              autoComplete="off"
              className="control min-h-28"
              value={currentNotes}
              onChange={(e) => {
                if (!selectedId && selected) setSelectedId(selected.id)
                setNotes(e.target.value)
              }}
            />
            <button className="button-primary mt-2 w-full" type="button" onClick={() => void runAction(saveNotes)}>
              Save Note
            </button>
          </SectionCard>
        </div>
      </div>
      <Modal
        open={newOpen}
        title="New Test Run"
        onClose={() => setNewOpen(false)}
        footer={
          <>
            <button className="button-secondary" type="button" onClick={() => setNewOpen(false)}>
              Cancel
            </button>
            <button className="button-primary" type="button" onClick={() => void runAction(createRun)}>
              Create software record
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="field">
            <label htmlFor="sample-info">Water source or sample information</label>
            <input
              id="sample-info"
              name="sample-information"
              autoComplete="off"
              className="control"
              placeholder="Enter water source or sample information…"
              value={sampleInformation}
              onChange={(event) => setSampleInformation(event.target.value)}
            />
          </div>
          <div className="field mt-3">
            <label htmlFor="new-run-notes">Research notes</label>
            <textarea
              id="new-run-notes"
              name="new-run-notes"
              autoComplete="off"
              className="control min-h-24"
              placeholder="Optional research notes…"
              value={newNotes}
              onChange={(event) => setNewNotes(event.target.value)}
            />
          </div>
          <div className="notice">Creating a test run starts a software research record only. It does not start the pump, UV-C, relays, or valves.</div>
        </div>
      </Modal>
      <Modal
        open={endOpen}
        title="End Test Run"
        onClose={() => setEndOpen(false)}
        footer={
          <>
            <button className="button-secondary" type="button" onClick={() => setEndOpen(false)}>
              Keep Run Active
            </button>
            <button className="button-danger" type="button" onClick={() => void runAction(endRun)}>
              End software record
            </button>
          </>
        }
      >
        <p className="text-sm">
          End <span className="mono font-semibold">{selected.id}</span>? This updates the backend software record. It does not stop or control hardware.
        </p>
      </Modal>
    </div>
  )
}
