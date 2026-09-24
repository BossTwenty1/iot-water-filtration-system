import express, { type Request, type Response, type NextFunction } from 'express'
import { supabaseAdmin } from '../config/supabaseClient'
import { requireAuth } from '../middleware/auth'
import { ApiError } from '../lib/apiError'
import { orThrow } from '../lib/queryHelpers'
import { toAppSettings } from '../lib/mappers'
import type { AppSettingsRow, DataRetentionPolicyRow, NotificationProviderRow, ThresholdRow } from '../types/db'
import type { Json } from '../types/database.types'

const router = express.Router()

// GET /settings — fetch AppSettings.
router.get('/settings', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = orThrow<AppSettingsRow | null>(
      await supabaseAdmin.from('app_settings').select('*').eq('id', 1).maybeSingle(),
      'Failed to load settings.'
    )
    res.json(toAppSettings(row ?? {}))
  } catch (err) {
    next(err)
  }
})

// PUT /settings — update general/notification settings.
router.put('/settings', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { systemName, deviceDisplayName, timezone, dateFormat, timeFormat, notifications } = req.body ?? {}
    const row = orThrow<AppSettingsRow | null>(
      await supabaseAdmin
        .from('app_settings')
        .upsert({
          id: 1,
          system_name: systemName,
          device_display_name: deviceDisplayName,
          timezone,
          date_format: dateFormat,
          time_format: timeFormat,
          notifications: (notifications ?? {}) as Json,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single(),
      'Failed to update settings.'
    )
    if (!row) throw ApiError.badRequest('Failed to update settings.')
    res.json(toAppSettings(row))
  } catch (err) {
    next(err)
  }
})

// GET /thresholds — alert threshold configuration. Content shape is TBD
// (docs/PENDING_DECISIONS.md "approved thresholds") — returned as opaque
// per-parameter config blobs, whatever the caller last stored.
router.get('/thresholds', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = orThrow<ThresholdRow[]>(await supabaseAdmin.from('thresholds').select('*'), 'Failed to load thresholds.')
    res.json(rows.map((row) => ({ parameter: row.parameter, stage: row.stage || undefined, config: row.config })))
  } catch (err) {
    next(err)
  }
})

// PUT /thresholds — replace the full threshold set. Body: array of
// { parameter, stage?, config }.
router.put('/thresholds', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entries: Array<{ parameter: string; stage?: string; config?: unknown }> = Array.isArray(req.body) ? req.body : []
    const rows = orThrow<ThresholdRow[]>(
      await supabaseAdmin
        .from('thresholds')
        .upsert(
          entries.map((entry) => ({
            parameter: entry.parameter,
            stage: entry.stage ?? '',
            config: (entry.config ?? {}) as Json,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'parameter,stage' }
        )
        .select('*'),
      'Failed to update thresholds.'
    )
    res.json(rows.map((row) => ({ parameter: row.parameter, stage: row.stage || undefined, config: row.config })))
  } catch (err) {
    next(err)
  }
})

// GET /notifications/providers — SMS/notification provider config. Provider
// choice is TBD (docs/PENDING_DECISIONS.md "SMS provider").
router.get('/notifications/providers', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = orThrow<NotificationProviderRow[]>(
      await supabaseAdmin.from('notification_providers').select('*'),
      'Failed to load notification providers.'
    )
    res.json(rows.map((row) => ({ provider: row.provider, enabled: row.enabled, config: row.config })))
  } catch (err) {
    next(err)
  }
})

// PUT /notifications/providers — upsert one provider's config. Body:
// { provider, enabled, config }.
router.put('/notifications/providers', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, enabled, config } = req.body ?? {}
    if (!provider) throw ApiError.badRequest('provider is required.')

    const row = orThrow<NotificationProviderRow | null>(
      await supabaseAdmin
        .from('notification_providers')
        .upsert(
          { provider, enabled: enabled ?? false, config: (config ?? {}) as Json, updated_at: new Date().toISOString() },
          { onConflict: 'provider' }
        )
        .select('*')
        .single(),
      'Failed to update notification provider.'
    )
    if (!row) throw ApiError.badRequest('Failed to update notification provider.')
    res.json({ provider: row.provider, enabled: row.enabled, config: row.config })
  } catch (err) {
    next(err)
  }
})

// GET /data-retention — retention policy config.
router.get('/data-retention', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = orThrow<DataRetentionPolicyRow | null>(
      await supabaseAdmin.from('data_retention_policy').select('*').eq('id', 1).maybeSingle(),
      'Failed to load data retention policy.'
    )
    res.json({ retentionDays: row?.retention_days ?? null, config: row?.config ?? {} })
  } catch (err) {
    next(err)
  }
})

// PUT /data-retention — update retention policy config.
router.put('/data-retention', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { retentionDays, config } = req.body ?? {}
    const row = orThrow<DataRetentionPolicyRow | null>(
      await supabaseAdmin
        .from('data_retention_policy')
        .upsert({ id: 1, retention_days: retentionDays ?? null, config: (config ?? {}) as Json, updated_at: new Date().toISOString() })
        .select('*')
        .single(),
      'Failed to update data retention policy.'
    )
    if (!row) throw ApiError.badRequest('Failed to update data retention policy.')
    res.json({ retentionDays: row.retention_days, config: row.config })
  } catch (err) {
    next(err)
  }
})

export default router
