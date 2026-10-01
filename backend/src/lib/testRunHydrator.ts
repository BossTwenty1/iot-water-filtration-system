import { supabaseAdmin } from '../config/supabaseClient'
import { toTestRun } from './mappers'
import type { TestRunRow } from '../types/db'
import type { TestRun } from '../types/domain'

export function formatDuration(startedAt: string, endedAt?: string | null): string {
  const start = new Date(startedAt).getTime()
  const end = new Date(endedAt ?? Date.now()).getTime()
  const totalSeconds = Math.max(0, Math.round((end - start) / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
}

export interface FlowReadingSample {
  value: number | null
  measured_at: string
}

export function computeProcessedVolume(flowReadings?: FlowReadingSample[] | null): number | undefined {
  if (!flowReadings || flowReadings.length < 2) return undefined

  let totalLiters = 0
  let validIntervals = 0

  for (let i = 1; i < flowReadings.length; i++) {
    const prev = flowReadings[i - 1]!
    const curr = flowReadings[i]!
    if (prev.value === null || curr.value === null) continue

    const tPrev = new Date(prev.measured_at).getTime()
    const tCurr = new Date(curr.measured_at).getTime()
    const dtMinutes = (tCurr - tPrev) / 60000

    // Skip backward steps, identical timestamps, or gaps larger than 30 minutes
    if (dtMinutes > 0 && dtMinutes <= 30) {
      const avgFlowRate = (prev.value + curr.value) / 2
      totalLiters += avgFlowRate * dtMinutes
      validIntervals++
    }
  }

  if (validIntervals === 0) return undefined
  return Math.round(totalLiters * 100) / 100
}

// Adds the fields TestRun needs that aren't columns on test_runs itself
// (telemetryCount, alertCount, validationStatus, duration, processedVolume) via count/aggregation queries
// against the related tables.
export async function hydrateTestRun(row: TestRunRow): Promise<TestRun> {
  const [telemetryCount, alertCount, validation, flowReadings] = await Promise.all([
    supabaseAdmin.from('sensor_readings').select('id', { count: 'exact', head: true }).eq('test_run_id', row.id),
    supabaseAdmin.from('alerts').select('id', { count: 'exact', head: true }).eq('test_run_id', row.id),
    supabaseAdmin.from('laboratory_validation_records').select('results,percentage_error').eq('test_run_id', row.id),
    supabaseAdmin
      .from('sensor_readings')
      .select('value, measured_at, sensor:sensors!inner(category, position)')
      .eq('test_run_id', row.id)
      .eq('sensor.category', 'flow_rate')
      .eq('sensor.position', 'post_filtration')
      .order('measured_at', { ascending: true }),
  ])

  const hasAvailableValidation = (validation.data ?? []).some((record) => {
    const results = record.results as { referenceResult?: number } | null
    return record.percentage_error !== null || results?.referenceResult !== undefined
  })

  const processedVolume = computeProcessedVolume(flowReadings.data as FlowReadingSample[] | null)

  return toTestRun({
    ...row,
    duration: formatDuration(row.started_at, row.ended_at),
    telemetryCount: telemetryCount.count ?? 0,
    alertCount: alertCount.count ?? 0,
    validationStatus: hasAvailableValidation ? 'Available' : 'Pending',
    processedVolume,
  })
}
