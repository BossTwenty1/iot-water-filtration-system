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

// Adds the fields TestRun needs that aren't columns on test_runs itself
// (telemetryCount, alertCount, validationStatus, duration) via count queries
// against the related tables.
export async function hydrateTestRun(row: TestRunRow): Promise<TestRun> {
  const [telemetryCount, alertCount, validation] = await Promise.all([
    supabaseAdmin.from('sensor_readings').select('id', { count: 'exact', head: true }).eq('test_run_id', row.id),
    supabaseAdmin.from('alerts').select('id', { count: 'exact', head: true }).eq('test_run_id', row.id),
    supabaseAdmin.from('laboratory_validation_records').select('results,percentage_error').eq('test_run_id', row.id),
  ])

  const hasAvailableValidation = (validation.data ?? []).some((record) => {
    const results = record.results as { referenceResult?: number } | null
    return record.percentage_error !== null || results?.referenceResult !== undefined
  })

  return toTestRun({
    ...row,
    duration: formatDuration(row.started_at, row.ended_at),
    telemetryCount: telemetryCount.count ?? 0,
    alertCount: alertCount.count ?? 0,
    validationStatus: hasAvailableValidation ? 'Available' : 'Pending',
  })
}
