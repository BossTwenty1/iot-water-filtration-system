// Purges old sensor_readings once a retention policy is actually set.
// docs/tracker/todo.md: "data_retention_policy is just a config row today —
// nothing reads it or purges old rows." This is the scheduled job that
// reads it; it does nothing until someone sets `retentionDays` via the
// existing PUT /data-retention route (retention_days is null by default),
// since the retention period itself is a policy decision, not something to
// hardcode here.
import { supabaseAdmin } from '../config/supabaseClient'
import env from '../config/env'

export async function runRetentionPurge(): Promise<void> {
  const { data: policy, error } = await supabaseAdmin.from('data_retention_policy').select('retention_days').eq('id', 1).maybeSingle()
  if (error) {
    console.error('Retention job: failed to load policy:', error.message)
    return
  }
  const retentionDays = policy?.retention_days
  if (!retentionDays || retentionDays <= 0) return

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
  const { data: deleted, error: deleteError } = await supabaseAdmin.from('sensor_readings').delete().lt('measured_at', cutoff).select('id')
  if (deleteError) {
    console.error('Retention job: purge failed:', deleteError.message)
    return
  }
  if (deleted && deleted.length > 0) {
    console.log(`Retention job: purged ${deleted.length} sensor_readings row(s) older than ${retentionDays} day(s).`)
  }
}

export function startRetentionJob(): void {
  runRetentionPurge().catch((err) => console.error('Retention job failed:', err instanceof Error ? err.message : err))
  setInterval(() => {
    runRetentionPurge().catch((err) => console.error('Retention job failed:', err instanceof Error ? err.message : err))
  }, env.retentionJobIntervalMs)
}
