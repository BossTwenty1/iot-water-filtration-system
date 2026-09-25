// Flags devices that have gone quiet as offline and raises an "ESP32
// Offline" alert (client-confirmed alert type — tracker "Client
// Requirements"). There is no per-reading signal for this (a device going
// silent produces no readings at all), so this polls on an interval rather
// than reacting to an event, unlike src/lib/alertEngine.ts.
//
// `deviceOfflineTimeoutMs` is an implementation-detail timing, not one of
// the client-facing timing decisions still open in PENDING_DECISIONS.md
// (sampling interval, save interval, cycle logic) — see src/config/env.ts.
import { supabaseAdmin } from '../config/supabaseClient'
import env from '../config/env'
import { raiseAlertIfNotActive, resolveActiveAlertBySource } from './alertEngine'
import type { DeviceRow } from '../types/db'

const OFFLINE_ALERT_TITLE = 'ESP32 Offline'

function sourceFor(device: Pick<DeviceRow, 'name' | 'device_identifier'>): string {
  return device.name ?? device.device_identifier
}

async function checkDevices(): Promise<void> {
  const cutoff = new Date(Date.now() - env.deviceOfflineTimeoutMs).toISOString()
  const { data: staleDevices } = await supabaseAdmin
    .from('devices')
    .select('id, name, device_identifier, last_seen_at')
    .neq('connection_state', 'Offline')
    .not('last_seen_at', 'is', null)
    .lt('last_seen_at', cutoff)

  for (const device of staleDevices ?? []) {
    await supabaseAdmin.from('devices').update({ connection_state: 'Offline' }).eq('id', device.id)
    await raiseAlertIfNotActive({
      deviceId: device.id,
      testRunId: null,
      sensorReadingId: null,
      category: 'Device Offline',
      source: sourceFor(device),
      title: OFFLINE_ALERT_TITLE,
      message: `${sourceFor(device)} has not reported since ${device.last_seen_at}.`,
      severity: 'Warning',
    })
  }
}

// Called from src/routes/devices.routes.ts right after a successful
// ingestion sets connection_state back to 'Online', so a device coming back
// closes its own "ESP32 Offline" alert instead of waiting for an operator.
export async function resolveOfflineAlertIfActive(device: Pick<DeviceRow, 'id' | 'name' | 'device_identifier'>): Promise<void> {
  await resolveActiveAlertBySource(device.id, sourceFor(device))
}

export function startDeviceWatchdog(): void {
  setInterval(() => {
    checkDevices().catch((err) => console.error('Device watchdog failed:', err instanceof Error ? err.message : err))
  }, env.deviceWatchdogIntervalMs)
}
