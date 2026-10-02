#!/usr/bin/env ts-node

/**
 * Interactive Alert Trigger Script
 * 
 * Allows choosing and triggering water quality alerts, sensor faults,
 * or custom alerts directly from the command line.
 * 
 * Usage:
 *   npm run alert
 *   or: npx ts-node scripts/sendAlert.ts
 */

import readline from 'readline/promises'
import { stdin as input, stdout as output } from 'process'
import env from '../src/config/env'
import { supabaseAdmin } from '../src/config/supabaseClient'
import type { DeviceRow, SensorRow } from '../src/types/db'

const DEVICE_IDENTIFIER = process.env.TARGET_DEVICE_ID || 'SIM-DEV-001'
const API_BASE = `http://localhost:${env.port}/api/v1`

// ANSI colors for clean CLI styling
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
}

interface AlertPreset {
  name: string
  description: string
  category: 'ph' | 'turbidity' | 'tds' | 'temperature' | 'flow_rate'
  position: 'pre_filtration' | 'post_filtration'
  value: number | null
  status: 'valid' | 'unavailable'
  sourceLabel: string
}

const PRESETS: AlertPreset[] = [
  {
    name: 'High Turbidity Breach (Post-Filtration)',
    description: 'Post-Filtration Turbidity = 4.20 NTU (PNSDW safe limit is ≤ 1.0 NTU)',
    category: 'turbidity',
    position: 'post_filtration',
    value: 4.2,
    status: 'valid',
    sourceLabel: 'Post-Filtration Turbidity Sensor',
  },
  {
    name: 'Acidic pH Breach (Post-Filtration)',
    description: 'Post-Filtration pH = 5.20 (PNSDW safe range is 6.5 – 8.5)',
    category: 'ph',
    position: 'post_filtration',
    value: 5.2,
    status: 'valid',
    sourceLabel: 'Post-Filtration pH Sensor',
  },
  {
    name: 'Alkaline pH Breach (Post-Filtration)',
    description: 'Post-Filtration pH = 9.80 (PNSDW safe range is 6.5 – 8.5)',
    category: 'ph',
    position: 'post_filtration',
    value: 9.8,
    status: 'valid',
    sourceLabel: 'Post-Filtration pH Sensor',
  },
  {
    name: 'High TDS Breach (Post-Filtration)',
    description: 'Post-Filtration TDS = 450 ppm (PNSDW safe limit is ≤ 300 ppm)',
    category: 'tds',
    position: 'post_filtration',
    value: 450,
    status: 'valid',
    sourceLabel: 'Post-Filtration TDS Sensor',
  },
  {
    name: 'High Temperature Warning (Post-Filtration)',
    description: 'Post-Filtration Temp = 39.5 °C (PNSDW safe range is 15.0 – 35.0 °C)',
    category: 'temperature',
    position: 'post_filtration',
    value: 39.5,
    status: 'valid',
    sourceLabel: 'Post-Filtration Temperature Sensor',
  },
  {
    name: 'Sensor Fault: Disconnected Turbidity Probe',
    description: 'Post-Filtration Turbidity Sensor reporting "unavailable" status',
    category: 'turbidity',
    position: 'post_filtration',
    value: null,
    status: 'unavailable',
    sourceLabel: 'Post-Filtration Turbidity Sensor',
  },
  {
    name: 'Sensor Fault: Disconnected pH Probe',
    description: 'Post-Filtration pH Sensor reporting "unavailable" status',
    category: 'ph',
    position: 'post_filtration',
    value: null,
    status: 'unavailable',
    sourceLabel: 'Post-Filtration pH Sensor',
  },
  {
    name: 'Pre-Filtration High Turbidity (Raw Water Dirty)',
    description: 'Pre-Filtration Turbidity = 14.50 NTU (High influent turbidity)',
    category: 'turbidity',
    position: 'pre_filtration',
    value: 14.5,
    status: 'valid',
    sourceLabel: 'Pre-Filtration Turbidity Sensor',
  },
]

async function ensureDevice(): Promise<DeviceRow> {
  const { data, error } = await supabaseAdmin
    .from('devices')
    .select('*')
    .eq('device_identifier', DEVICE_IDENTIFIER)
    .maybeSingle()

  if (error) throw new Error(`Failed to load device: ${error.message}`)
  if (data) return data

  const created = await supabaseAdmin
    .from('devices')
    .insert({
      device_identifier: DEVICE_IDENTIFIER,
      name: 'Simulated Filtration Unit',
      is_simulated: true,
      controller_name: 'ESP32 DevKit V1',
      connection_state: 'Online',
      wifi_state: 'Connected',
    })
    .select('*')
    .single()

  if (created.error || !created.data) throw new Error(`Create device failed: ${created.error?.message}`)
  return created.data
}

async function ensureThresholds(): Promise<void> {
  const { data: rows } = await supabaseAdmin.from('thresholds').select('parameter, stage')
  const existing = new Set((rows ?? []).map((r) => `${r.parameter}|${r.stage}`))

  const defaults = [
    { parameter: 'pH', stage: 'after', config: { min: 6.5, max: 8.5, severity: 'Warning', provisional: true } },
    { parameter: 'turbidity', stage: 'after', config: { max: 1.0, severity: 'Warning', provisional: true } },
    { parameter: 'turbidity', stage: 'before', config: { max: 10.0, severity: 'Warning', provisional: true } },
    { parameter: 'TDS', stage: 'after', config: { max: 300, severity: 'Warning', provisional: true } },
    { parameter: 'temperature', stage: 'after', config: { min: 15.0, max: 35.0, severity: 'Information', provisional: true } },
  ]

  const missing = defaults.filter((d) => !existing.has(`${d.parameter}|${d.stage}`))
  if (missing.length > 0) {
    await supabaseAdmin.from('thresholds').upsert(missing, { onConflict: 'parameter,stage' })
  }
}

async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(1500) })
    return res.ok
  } catch {
    return false
  }
}

async function checkActiveAlert(deviceId: string, source: string) {
  const { data } = await supabaseAdmin
    .from('alerts')
    .select('id, title, status, severity, triggered_at')
    .eq('device_id', deviceId)
    .eq('source', source)
    .eq('status', 'Active')
    .maybeSingle()
  return data
}

async function resolveAlert(alertId: string) {
  await supabaseAdmin
    .from('alerts')
    .update({ status: 'Resolved' })
    .eq('id', alertId)

  await supabaseAdmin
    .from('alert_state_changes')
    .insert({
      alert_id: alertId,
      from_status: 'Active',
      to_status: 'Resolved',
      changed_by: null,
    })
}

async function resolveAllActiveAlerts(deviceId: string): Promise<number> {
  const { data: alerts } = await supabaseAdmin
    .from('alerts')
    .select('id, status')
    .eq('device_id', deviceId)
    .eq('status', 'Active')

  if (!alerts || alerts.length === 0) return 0

  for (const alert of alerts) {
    await resolveAlert(alert.id)
  }
  return alerts.length
}

async function sendTelemetryBatch(deviceId: string, reading: AlertPreset) {
  const payload = {
    measuredAt: new Date().toISOString(),
    readings: [
      {
        category: reading.category,
        position: reading.position,
        value: reading.value,
        status: reading.status,
      },
    ],
  }

  const serverOnline = await isServerRunning()

  if (serverOnline) {
    console.log(`${c.dim}Sending telemetry through API server (POST /devices/${DEVICE_IDENTIFIER}/telemetry)...${c.reset}`)
    const res = await fetch(`${API_BASE}/devices/${DEVICE_IDENTIFIER}/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Key': env.deviceIngestKey,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`API responded with ${res.status}: ${err}`)
    }
  } else {
    console.log(`${c.yellow}⚠️  API server is not running on port ${env.port}. Inserting directly into Supabase...${c.reset}`)
    // Find sensor ID
    const { data: sensor } = await supabaseAdmin
      .from('sensors')
      .select('id')
      .eq('device_id', deviceId)
      .eq('category', reading.category)
      .eq('position', reading.position)
      .maybeSingle()

    if (sensor) {
      await supabaseAdmin.from('sensor_readings').insert({
        device_id: deviceId,
        sensor_id: sensor.id,
        value: reading.value,
        reading_status: reading.status,
        measured_at: payload.measuredAt,
      })
    }

    // Direct alert insert
    const isFault = reading.status === 'unavailable'
    await supabaseAdmin.from('alerts').insert({
      device_id: deviceId,
      category: isFault ? 'Sensor Fault' : 'Water Quality',
      source: reading.sourceLabel,
      title: isFault ? 'Sensor Connection Warning' : `Abnormal ${reading.category.toUpperCase()}`,
      message: isFault
        ? `${reading.sourceLabel} reading temporarily unavailable.`
        : `${reading.sourceLabel} reading of ${reading.value} breached threshold.`,
      severity: 'Warning',
      status: 'Active',
    })
  }
}

async function sendCustomDirectAlert(deviceId: string, rl: readline.Interface) {
  console.log(`\n${c.bold}${c.cyan}--- Create Custom Direct Alert ---${c.reset}`)
  const title = (await rl.question(`Alert Title [e.g. Filter Clogging Detected]: `)).trim() || 'Filter Clogging Warning'
  const message = (await rl.question(`Alert Message [e.g. Post-filtration flow rate dropped below 0.5 L/min]: `)).trim() || 'Abnormal pressure drop detected across filtration membrane.'
  
  console.log(`Select Category: [1] Water Quality  [2] Sensor Fault  [3] Hardware / Actuator  [4] System Warning`)
  const catChoice = (await rl.question(`Choice [3]: `)).trim() || '3'
  const catMap: Record<string, string> = {
    '1': 'Water Quality',
    '2': 'Sensor Fault',
    '3': 'Hardware / Actuator',
    '4': 'System Warning',
  }
  const category = catMap[catChoice] || 'Hardware / Actuator'

  console.log(`Select Severity: [1] Information  [2] Warning  [3] Critical`)
  const sevChoice = (await rl.question(`Choice [2]: `)).trim() || '2'
  const sevMap: Record<string, string> = {
    '1': 'Information',
    '2': 'Warning',
    '3': 'Critical',
  }
  const severity = sevMap[sevChoice] || 'Warning'

  const source = (await rl.question(`Source [e.g. Ultrafiltration Membrane]: `)).trim() || 'Ultrafiltration Membrane'

  const { data, error } = await supabaseAdmin
    .from('alerts')
    .insert({
      device_id: deviceId,
      title,
      message,
      category,
      severity,
      source,
      status: 'Active',
    })
    .select('*')
    .single()

  if (error) {
    console.error(`${c.red}Failed to insert alert: ${error.message}${c.reset}`)
  } else {
    console.log(`\n${c.green}✅ Custom alert created successfully!${c.reset}`)
    console.log(`${c.bold}ID:${c.reset} ${data.id}`)
    console.log(`${c.bold}Title:${c.reset} [${data.severity}] ${data.title}`)
    console.log(`${c.bold}Message:${c.reset} ${data.message}`)
    console.log(`${c.bold}Source:${c.reset} ${data.source}`)
  }
}

async function showMenu(device: DeviceRow, rl: readline.Interface) {
  // Check active alerts count
  const { count } = await supabaseAdmin
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('device_id', device.id)
    .eq('status', 'Active')

  const serverOnline = await isServerRunning()

  console.log(`\n${c.bold}====================================================${c.reset}`)
  console.log(`${c.bold}${c.cyan}     IoT Water Filtration - Alert Trigger CLI       ${c.reset}`)
  console.log(`${c.bold}====================================================${c.reset}`)
  console.log(`Target Device : ${c.bold}${device.name}${c.reset} (${device.device_identifier})`)
  console.log(`API Server    : ${serverOnline ? `${c.green}● Online (port ${env.port})${c.reset}` : `${c.yellow}○ Offline (will write directly to DB)${c.reset}`}`)
  console.log(`Active Alerts : ${count && count > 0 ? `${c.yellow}${count} active alert(s)${c.reset}` : `${c.green}0 active alerts${c.reset}`}`)
  console.log(`----------------------------------------------------`)
  console.log(`${c.bold}Preset Breach & Fault Triggers:${c.reset}`)

  PRESETS.forEach((preset, idx) => {
    console.log(`  ${c.cyan}[${idx + 1}]${c.reset} ${preset.name}`)
    console.log(`      ${c.dim}${preset.description}${c.reset}`)
  })

  console.log(`\n${c.bold}Custom & Maintenance Options:${c.reset}`)
  console.log(`  ${c.cyan}[9]${c.reset} Custom Water Quality Reading (choose param, stage, value)`)
  console.log(`  ${c.cyan}[10]${c.reset} Custom Direct Alert (any category, title, message, severity)`)
  console.log(`  ${c.yellow}[11] Resolve All Active Alerts for this Device${c.reset}`)
  console.log(`  ${c.dim}[0] Exit${c.reset}`)
  console.log(`----------------------------------------------------`)

  const answer = (await rl.question(`${c.bold}Enter selection (0-${11}): ${c.reset}`)).trim()

  if (answer === '0' || answer.toLowerCase() === 'exit' || answer.toLowerCase() === 'q') {
    console.log(`${c.dim}Exiting.${c.reset}`)
    rl.close()
    process.exit(0)
  }

  if (answer === '11') {
    const resolvedCount = await resolveAllActiveAlerts(device.id)
    console.log(`\n${c.green}✅ Resolved ${resolvedCount} active alert(s).${c.reset}`)
    return
  }

  if (answer === '10') {
    await sendCustomDirectAlert(device.id, rl)
    return
  }

  if (answer === '9') {
    console.log(`\n${c.cyan}--- Custom Reading Breach ---${c.reset}`)
    console.log(`Select Parameter: [1] pH  [2] Turbidity  [3] TDS  [4] Temperature  [5] Flow Rate`)
    const pChoice = (await rl.question(`Parameter [1]: `)).trim() || '1'
    const pMap: Record<string, 'ph' | 'turbidity' | 'tds' | 'temperature' | 'flow_rate'> = {
      '1': 'ph',
      '2': 'turbidity',
      '3': 'tds',
      '4': 'temperature',
      '5': 'flow_rate',
    }
    const cat = pMap[pChoice] || 'ph'

    console.log(`Select Stage: [1] Post-Filtration  [2] Pre-Filtration`)
    const sChoice = (await rl.question(`Stage [1]: `)).trim() || '1'
    const pos = sChoice === '2' ? 'pre_filtration' : 'post_filtration'

    const valStr = await rl.question(`Sensor Value to inject: `)
    const val = parseFloat(valStr)
    if (isNaN(val)) {
      console.log(`${c.red}Invalid number entered.${c.reset}`)
      return
    }

    const stageName = pos === 'pre_filtration' ? 'Pre-Filtration' : 'Post-Filtration'
    const label = `${stageName} ${cat.toUpperCase()} Sensor`

    const customPreset: AlertPreset = {
      name: `Custom ${cat.toUpperCase()} reading`,
      description: `${label} = ${val}`,
      category: cat,
      position: pos,
      value: val,
      status: 'valid',
      sourceLabel: label,
    }

    await triggerPreset(device, customPreset, rl)
    return
  }

  const selectedIdx = parseInt(answer, 10) - 1
  if (isNaN(selectedIdx) || selectedIdx < 0 || selectedIdx >= PRESETS.length) {
    console.log(`${c.red}Invalid option.${c.reset}`)
    return
  }

  const preset = PRESETS[selectedIdx]!
  await triggerPreset(device, preset, rl)
}

async function triggerPreset(device: DeviceRow, preset: AlertPreset, rl: readline.Interface) {
  console.log(`\n${c.bold}Selected:${c.reset} ${preset.name}`)
  console.log(`${c.dim}${preset.description}${c.reset}`)

  // Deduplication check: Check if an alert is already active for this source
  const existingActive = await checkActiveAlert(device.id, preset.sourceLabel)
  if (existingActive) {
    console.log(`\n${c.yellow}⚠️  An active alert already exists for "${preset.sourceLabel}":${c.reset}`)
    console.log(`   [${existingActive.severity}] ${existingActive.title} (Active since ${new Date(existingActive.triggered_at).toLocaleTimeString()})`)
    console.log(`   ${c.dim}Due to deduplication, a new alert will be suppressed unless the active one is resolved.${c.reset}`)
    
    const resolveFirst = (await rl.question(`\nResolve the existing alert first so the new alert triggers cleanly? [Y/n]: `)).trim().toLowerCase()
    if (resolveFirst !== 'n') {
      await resolveAlert(existingActive.id)
      console.log(`${c.green}✅ Previous active alert resolved.${c.reset}`)
    }
  }

  try {
    await sendTelemetryBatch(device.id, preset)
    console.log(`\n${c.green}🚀 Telemetry dispatched!${c.reset}`)

    // Wait a brief moment for asynchronous alertEngine to write
    await new Promise((r) => setTimeout(r, 600))

    // Query and display the newly created/current alert
    const { data: latestAlert } = await supabaseAdmin
      .from('alerts')
      .select('*')
      .eq('device_id', device.id)
      .eq('source', preset.sourceLabel)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestAlert && latestAlert.status === 'Active') {
      console.log(`\n${c.bold}${c.green}=== Alert Successfully Active in Database ===${c.reset}`)
      console.log(`${c.bold}Alert ID  :${c.reset} ${latestAlert.id}`)
      console.log(`${c.bold}Category  :${c.reset} ${latestAlert.category}`)
      console.log(`${c.bold}Severity  :${c.reset} [${latestAlert.severity}]`)
      console.log(`${c.bold}Title     :${c.reset} ${latestAlert.title}`)
      console.log(`${c.bold}Message   :${c.reset} ${latestAlert.message}`)
      console.log(`${c.bold}Timestamp :${c.reset} ${latestAlert.triggered_at}`)
      console.log(`\n${c.cyan}Check your dashboard at http://localhost:5173/alerts to view it live!${c.reset}`)
    } else {
      console.log(`${c.dim}(No new alert row was generated. Reading may be within threshold limits or already active.)${c.reset}`)
    }
  } catch (err) {
    console.error(`\n${c.red}❌ Error triggering alert:${c.reset}`, err instanceof Error ? err.message : err)
  }
}

async function main() {
  const device = await ensureDevice()
  await ensureThresholds()
  const arg = process.argv[2]?.trim()

  if (arg) {
    if (arg === 'help' || arg === '--help' || arg === '-h') {
      console.log(`\n${c.bold}IoT Water Filtration Alert CLI${c.reset}`)
      console.log(`Usage: npm run alert [-- <option>]\n`)
      console.log(`Options:`)
      console.log(`  1-8       Trigger preset alert:`)
      PRESETS.forEach((p, i) => console.log(`              ${i + 1} - ${p.name}`))
      console.log(`  11        Resolve all active alerts for ${device.device_identifier}`)
      console.log(`  (empty)   Launch interactive menu\n`)
      process.exit(0)
    }

    if (arg === '11' || arg === 'resolve') {
      const resolvedCount = await resolveAllActiveAlerts(device.id)
      console.log(`\n${c.green}✅ Resolved ${resolvedCount} active alert(s) for ${device.device_identifier}.${c.reset}\n`)
      process.exit(0)
    }

    const idx = parseInt(arg, 10) - 1
    if (!isNaN(idx) && idx >= 0 && idx < PRESETS.length) {
      const preset = PRESETS[idx]!
      console.log(`\n${c.bold}Triggering:${c.reset} ${preset.name}`)
      console.log(`${c.dim}${preset.description}${c.reset}`)

      // Auto-resolve previous active alert on this source so it fires cleanly
      const existing = await checkActiveAlert(device.id, preset.sourceLabel)
      if (existing) {
        await resolveAlert(existing.id)
        console.log(`${c.dim}Auto-resolved previous active alert on ${preset.sourceLabel}.${c.reset}`)
      }

      await sendTelemetryBatch(device.id, preset)
      console.log(`${c.green}🚀 Telemetry dispatched!${c.reset}`)

      await new Promise((r) => setTimeout(r, 600))
      const { data: latest } = await supabaseAdmin
        .from('alerts')
        .select('*')
        .eq('device_id', device.id)
        .eq('source', preset.sourceLabel)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latest && latest.status === 'Active') {
        console.log(`\n${c.green}=== Alert Created in Database ===${c.reset}`)
        console.log(`${c.bold}ID      :${c.reset} ${latest.id}`)
        console.log(`${c.bold}Severity:${c.reset} [${latest.severity}] ${latest.title}`)
        console.log(`${c.bold}Message :${c.reset} ${latest.message}`)
        console.log(`${c.bold}Source  :${c.reset} ${latest.source}\n`)
      }
      process.exit(0)
    }

    console.log(`${c.red}Unknown argument: ${arg}. Use 'npm run alert -- --help' for usage.${c.reset}`)
    process.exit(1)
  }

  // Interactive mode
  const rl = readline.createInterface({ input, output })
  try {
    while (true) {
      await showMenu(device, rl)
      if (!process.stdin.isTTY) break
      const cont = (await rl.question(`\n${c.dim}Press Enter to return to menu (or 'q' to quit): ${c.reset}`)).trim()
      if (cont.toLowerCase() === 'q') {
        rl.close()
        process.exit(0)
      }
    }
  } catch (err: any) {
    if (err?.code === 'ERR_USE_AFTER_CLOSE' || err?.name === 'AbortError') {
      process.exit(0)
    }
    throw err
  } finally {
    rl.close()
  }
}

main().catch((err) => {
  if (err?.code !== 'ERR_USE_AFTER_CLOSE') {
    console.error(`${c.red}Fatal error:${c.reset}`, err)
  }
  process.exit(0)
})
