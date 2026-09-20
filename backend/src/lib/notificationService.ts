// Provider-neutral notification dispatch — R-08 in the risk register ("SMS
// provider not chosen" / "Build provider-neutral notification service
// first"). This layer exists so alert generation never has to change again
// once a provider is picked: it dispatches through whatever
// `notification_providers` rows are enabled (src/routes/settings.routes.ts),
// looked up by name in the registry below.
//
// Only a `log` provider is implemented today. Actually sending an SMS is not
// built here — the provider itself is still `TBD`
// (docs/PENDING_DECISIONS.md "SMS provider"), and guessing one (Twilio,
// Vonage, ...) would pre-empt that decision. Enabling a provider name with no
// matching implementation logs a warning instead of silently doing nothing,
// so a misconfigured demo shows up in the logs rather than as a mystery.
import { supabaseAdmin } from '../config/supabaseClient'
import type { AppSettingsRow, NotificationProviderRow } from '../types/db'
import type { NotificationPreferences } from '../types/domain'

export interface NotificationEvent {
  deviceId: string
  category: string
  source: string
  title: string
  message: string
  severity: string
}

export interface NotificationProvider {
  name: string
  send(event: NotificationEvent, config: Record<string, unknown>): Promise<void>
}

// Maps an alert's `category` (src/lib/alertEngine.ts, src/lib/deviceWatchdog.ts)
// to the matching toggle in AppSettings.notifications. Categories not raised
// yet (noFlow, pump, uvc, maintenance) have no mapping — add one when
// something actually raises that category.
const CATEGORY_TO_PREFERENCE: Record<string, keyof NotificationPreferences> = {
  'Device Offline': 'offline',
  'Sensor Fault': 'sensor',
  'Water Quality': 'waterQuality',
}

const logProvider: NotificationProvider = {
  name: 'log',
  async send(event) {
    console.log(`[notify] ${event.severity} ${event.category} — ${event.title}: ${event.message} (device ${event.deviceId})`)
  },
}

// Real providers (twilio, etc.) register here once one is chosen and built.
const registry = new Map<string, NotificationProvider>([[logProvider.name, logProvider]])

const warnedUnimplemented = new Set<string>()

async function loadNotificationPreferences(): Promise<Partial<NotificationPreferences>> {
  const { data } = await supabaseAdmin.from('app_settings').select('notifications').eq('id', 1).maybeSingle()
  return ((data as Pick<AppSettingsRow, 'notifications'> | null)?.notifications as Partial<NotificationPreferences>) ?? {}
}

// Called from src/lib/alertEngine.ts / src/lib/deviceWatchdog.ts right after
// a new alert is inserted (not on dedupe — see raiseAlertIfNotActive). Never
// throws: a notification failure must not block alert creation.
export async function dispatchNotification(event: NotificationEvent): Promise<void> {
  try {
    const preferenceKey = CATEGORY_TO_PREFERENCE[event.category]
    const preferences = await loadNotificationPreferences()
    // Missing preference = fail open (notify). Explicit `false` = skip.
    if (preferenceKey && preferences[preferenceKey] === false) return

    await logProvider.send(event, {})

    const { data: providerRows } = await supabaseAdmin.from('notification_providers').select('*').eq('enabled', true)
    for (const row of (providerRows ?? []) as NotificationProviderRow[]) {
      if (row.provider === logProvider.name) continue
      const provider = registry.get(row.provider)
      if (!provider) {
        if (!warnedUnimplemented.has(row.provider)) {
          warnedUnimplemented.add(row.provider)
          console.warn(`[notify] provider "${row.provider}" is enabled but not implemented — see docs/PENDING_DECISIONS.md "SMS provider"`)
        }
        continue
      }
      await provider.send(event, (row.config as Record<string, unknown>) ?? {})
    }
  } catch (err) {
    console.error('Notification dispatch failed:', err instanceof Error ? err.message : err)
  }
}
