import { ResourceState } from '../common/ResourceState'
import { useServiceData } from '../../hooks/useServiceData'
import { useRealtimeEvent } from '../../hooks/useRealtime'
import { telemetryService } from '../../services'
import type { SensorStage, TelemetryRecord } from '../../types'
import { formatSensorValue } from '../../utils/formatters'
import { StatusBadge } from '../common/StatusBadge'

export function SensorGrid({ stage }: { stage: SensorStage }) {
  const resource = useServiceData(telemetryService.getLatestTelemetry)

  // React to incoming live telemetry without full page reload
  useRealtimeEvent<TelemetryRecord[]>('telemetry', (records) => {
    if (!records.length) return
    const newest = records[records.length - 1]
    if (!newest) return
    const stageData = newest[stage]
    if (!stageData) return

    resource.setData((prev) => {
      const current = prev ? [...prev] : []
      for (const [param, val] of Object.entries(stageData)) {
        if (typeof val === 'number') {
          const idx = current.findIndex((r) => r.stage === stage && r.parameter === param)
          if (idx >= 0) {
            current[idx] = { ...current[idx]!, value: val }
          } else {
            const unit =
              param === 'pH'
                ? 'pH'
                : param === 'turbidity'
                  ? 'NTU'
                  : param === 'TDS'
                    ? 'ppm'
                    : param === 'temperature'
                      ? '°C'
                      : param === 'flowRate'
                        ? 'L/min'
                        : ''
            current.push({
              parameter: param as any,
              stage,
              value: val,
              unit,
              label: `${stage === 'before' ? 'Pre' : 'Post'} ${param}`,
            })
          }
        }
      }
      return current
    })
  })

  if (resource.status !== 'success' || !resource.data) {
    return (
      <ResourceState
        status={resource.status}
        error={resource.error}
        loadingLabel="Loading readings…"
        emptyLabel="No API readings are available."
      />
    )
  }

  const readings = resource.data.filter((reading) => reading.stage === stage)
  if (!readings.length) {
    return <ResourceState status="empty" emptyLabel="No readings are recorded for this filtration stage." />
  }

  return (
    <div className="sensor-grid">
      {readings.map((reading) => (
        <div className="sensor-card transition-all duration-300" key={`${stage}-${reading.parameter}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="eyebrow text-muted">{reading.parameter}</div>
              <div className="mt-2">
                <span className="metric-value font-mono tracking-tight">{formatSensorValue(reading.parameter, reading.value)}</span>{' '}
                <span className="mono text-[10px] text-muted">{reading.unit}</span>
              </div>
            </div>
            <StatusBadge tone="Pending">Live value</StatusBadge>
          </div>
          <div className="mt-2 text-[11px] text-muted">
            Continuous embedded telemetry · stage: {stage}
          </div>
        </div>
      ))}
    </div>
  )
}
