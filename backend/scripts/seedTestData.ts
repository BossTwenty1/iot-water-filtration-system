// Populates the local Supabase database with fixture data covering every
// route in docs/API_REFERENCE.md, then prints a ready-to-use auth token and
// curl examples so the routes can be exercised immediately.
//
// Safe to re-run: the test user is deleted and recreated each time (so the
// password/token are always known); the device/sensors are reused if they
// already exist (from supabase/seed.sql); everything else (test runs,
// alerts, calibration, etc.) is inserted fresh on every run. Run
// `npx supabase db reset` first for a fully clean slate.
//
// Usage: `npm run seed` (from backend/), after `npx supabase start`.

import type { PostgrestError } from '@supabase/supabase-js'
import { supabaseAdmin, supabaseAnon } from '../src/config/supabaseClient'
import env from '../src/config/env'
import type { DeviceRow, SensorRow, TestRunRow } from '../src/types/db'

const TEST_USER = { email: 'seed-admin@aquasense.test', password: 'SeedTest123!', fullName: 'Seed Admin', role: 'Administrator' }
const DEVICE_IDENTIFIER = 'SIM-DEV-001'

const SENSOR_DEFS: Array<[string, string, string]> = [
  ['ph', 'pre_filtration', 'pH'],
  ['ph', 'post_filtration', 'pH'],
  ['turbidity', 'pre_filtration', 'NTU'],
  ['turbidity', 'post_filtration', 'NTU'],
  ['tds', 'pre_filtration', 'ppm'],
  ['tds', 'post_filtration', 'ppm'],
  ['temperature', 'pre_filtration', '°C'],
  ['temperature', 'post_filtration', '°C'],
  ['flow_rate', 'pre_filtration', 'L/min'],
  ['flow_rate', 'post_filtration', 'L/min'],
]

function check<T>(label: string, result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(`${label} failed: ${result.error.message}`)
  return result.data as T
}

async function recreateTestUser(): Promise<string> {
  const existing = await supabaseAdmin.from('profiles').select('id').eq('email', TEST_USER.email).maybeSingle()
  if (existing.data) {
    await supabaseAdmin.auth.admin.deleteUser(existing.data.id)
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: TEST_USER.email,
    password: TEST_USER.password,
    email_confirm: true,
    user_metadata: { full_name: TEST_USER.fullName, role: TEST_USER.role },
  })
  if (error) throw new Error(`Creating test user failed: ${error.message}`)
  return data.user.id
}

async function ensureDevice(): Promise<DeviceRow> {
  const existing = check('Load device', await supabaseAdmin.from('devices').select('*').eq('device_identifier', DEVICE_IDENTIFIER).maybeSingle())
  if (existing) return existing

  return check(
    'Create device',
    await supabaseAdmin
      .from('devices')
      .insert({
        device_identifier: DEVICE_IDENTIFIER,
        name: 'Simulated Filtration Unit',
        is_simulated: true,
        controller_name: 'ESP32 DevKit V1',
        connection_state: 'Online',
        wifi_state: 'Connected',
        fail_safe_state: 'Local Control Active',
        last_seen_at: new Date().toISOString(),
      })
      .select('*')
      .single()
  )
}

async function ensureSensors(deviceId: string): Promise<SensorRow[]> {
  const existing = check('Load sensors', await supabaseAdmin.from('sensors').select('*').eq('device_id', deviceId))
  if (existing.length >= SENSOR_DEFS.length) return existing

  const rows = SENSOR_DEFS.map(([category, position, unit]) => ({ device_id: deviceId, category, position, unit }))
  return check('Create sensors', await supabaseAdmin.from('sensors').insert(rows).select('*'))
}

type SensorLookup = (category: string, position: string) => SensorRow | undefined

function sensorLookup(sensors: SensorRow[]): SensorLookup {
  const byKey = new Map(sensors.map((s) => [`${s.category}|${s.position}`, s]))
  return (category, position) => byKey.get(`${category}|${position}`)
}

interface ReadingCycle {
  minutesAgo: number
  ph: [number, number]
  turbidity: [number, number]
  tds: [number, number]
  temp: [number, number]
  flow: [number, number]
}

interface SensorReadingInsert {
  sensor_id: string
  device_id: string
  value: number
  measured_at: string
  test_run_id: string
}

// A few plausible reading cycles: turbidity/TDS trending down post-filtration,
// pH normalizing, temperature/flow roughly stable — enough variation for
// chart/history endpoints to return something visually meaningful.
function buildReadingCycles(deviceId: string, testRunId: string, findSensor: SensorLookup): SensorReadingInsert[] {
  const cycles: ReadingCycle[] = [
    { minutesAgo: 12, ph: [6.7, 7.0], turbidity: [9.4, 0.82], tds: [302, 181], temp: [26.3, 26.5], flow: [2.4, 2.1] },
    { minutesAgo: 9, ph: [6.71, 7.0], turbidity: [9.38, 0.78], tds: [303, 180], temp: [26.3, 26.5], flow: [2.4, 2.1] },
    { minutesAgo: 6, ph: [6.72, 7.01], turbidity: [9.26, 0.69], tds: [302, 181], temp: [26.4, 26.5], flow: [2.3, 2.1] },
    { minutesAgo: 3, ph: [6.72, 7.01], turbidity: [9.41, 0.75], tds: [301, 180], temp: [26.4, 26.6], flow: [2.4, 2.2] },
    { minutesAgo: 0, ph: [6.73, 7.02], turbidity: [9.36, 0.71], tds: [302, 180], temp: [26.5, 26.6], flow: [2.4, 2.1] },
  ]

  const rows: SensorReadingInsert[] = []
  for (const cycle of cycles) {
    const measuredAt = new Date(Date.now() - cycle.minutesAgo * 60_000).toISOString()
    const push = (category: string, [before, after]: [number, number]) => {
      const preSensor = findSensor(category, 'pre_filtration')
      const postSensor = findSensor(category, 'post_filtration')
      if (preSensor) rows.push({ sensor_id: preSensor.id, device_id: deviceId, value: before, measured_at: measuredAt, test_run_id: testRunId })
      if (postSensor) rows.push({ sensor_id: postSensor.id, device_id: deviceId, value: after, measured_at: measuredAt, test_run_id: testRunId })
    }
    push('ph', cycle.ph)
    push('turbidity', cycle.turbidity)
    push('tds', cycle.tds)
    push('temperature', cycle.temp)
    push('flow_rate', cycle.flow)
  }
  return rows
}

async function seedTestRuns(deviceId: string): Promise<{ activeRun: TestRunRow; completedRun: TestRunRow }> {
  const activeRun = check<TestRunRow>(
    'Create active test run',
    await supabaseAdmin
      .from('test_runs')
      .insert({
        device_id: deviceId,
        status: 'In Progress',
        started_at: new Date(Date.now() - 12 * 60_000).toISOString(),
        notes: 'Seeded active research session.',
      })
      .select('*')
      .single()
  )

  const completedRun = check<TestRunRow>(
    'Create completed test run',
    await supabaseAdmin
      .from('test_runs')
      .insert({
        device_id: deviceId,
        status: 'Completed',
        started_at: new Date(Date.now() - 90 * 60_000).toISOString(),
        ended_at: new Date(Date.now() - 45 * 60_000).toISOString(),
        target_volume_liters: 1.8,
        notes: 'Seeded completed research session.',
      })
      .select('*')
      .single()
  )

  return { activeRun, completedRun }
}

async function seedAlerts(deviceId: string, testRunId: string) {
  return check(
    'Create alerts',
    await supabaseAdmin
      .from('alerts')
      .insert([
        {
          device_id: deviceId,
          test_run_id: testRunId,
          source: 'Post-Filtration Turbidity Sensor',
          title: 'Sensor Connection Warning',
          message: 'Sensor reading temporarily unavailable. Waiting for the next valid reading.',
          severity: 'Warning',
          status: 'Active',
        },
        {
          device_id: deviceId,
          test_run_id: testRunId,
          source: 'Pre-Filtration Flow Sensor',
          title: 'No Flow Detected',
          message: 'No water flow was recorded during the active test run.',
          severity: 'Warning',
          status: 'Acknowledged',
        },
        {
          device_id: deviceId,
          source: 'Filtration System',
          title: 'Filter Maintenance Reminder',
          message: 'Maintenance reminder recorded for operator review.',
          severity: 'Information',
          status: 'Resolved',
        },
      ])
      .select('*')
  )
}

async function seedCalibrationRecords(profileId: string, findSensor: SensorLookup) {
  const specs = [
    { category: 'ph', position: 'pre_filtration', model: 'PH-4502C', referenceValue: 7, sensorReading: 7.15 },
    { category: 'tds', position: 'post_filtration', model: 'DFRobot TDS', referenceValue: 180, sensorReading: 181 },
    { category: 'turbidity', position: 'pre_filtration', model: 'Pending Confirmation', referenceValue: 10, sensorReading: 11.45 },
  ]
  const rows = specs
    .map((spec) => {
      const sensor = findSensor(spec.category, spec.position)
      if (!sensor) return null
      return {
        sensor_id: sensor.id,
        performed_by: profileId,
        parameters: { model: spec.model, referenceValue: spec.referenceValue, sensorReading: spec.sensorReading, status: 'Record Available' },
        notes: 'Seeded calibration record.',
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  return check('Create calibration records', await supabaseAdmin.from('calibration_records').insert(rows).select('*'))
}

async function seedLabValidation(testRunId: string) {
  return check(
    'Create laboratory validation records',
    await supabaseAdmin
      .from('laboratory_validation_records')
      .insert([
        {
          test_run_id: testRunId,
          sample_reference: 'SMP-SEED-001',
          results: { stage: 'after', parameter: 'turbidity', referenceResult: 0.7, sensorReading: 0.72, unit: 'NTU', notes: 'External reference comparison recorded.' },
          percentage_error: Math.abs((0.72 - 0.7) / 0.7) * 100,
        },
        {
          test_run_id: testRunId,
          sample_reference: 'SMP-SEED-002',
          results: { stage: 'before', parameter: 'TDS', sensorReading: 302, unit: 'ppm', notes: 'External reference result is pending.' },
          percentage_error: null,
        },
      ])
      .select('*')
  )
}

async function seedMaintenance(profileId: string) {
  const records = check(
    'Create maintenance records',
    await supabaseAdmin
      .from('maintenance_records')
      .insert([
        { component: 'Booster Pump', type: 'Inspection', description: 'Booster pump inspection recorded after a warning.', status: 'Review Needed', performed_by: profileId, notes: 'Seeded record.' },
        { component: 'UV-C Unit', type: 'Inspection', description: 'UV-C unit inspection record created.', status: 'Completed', performed_by: profileId, notes: 'Runtime integration remains pending.' },
      ])
      .select('*')
  )

  const reminders = check(
    'Create maintenance reminders',
    await supabaseAdmin
      .from('maintenance_reminders')
      .insert([
        { component: 'Booster Pump', label: 'Pump Inspection', due_date: new Date().toISOString().slice(0, 10), status: 'Due' },
        { component: 'Ultrafiltration Unit', label: 'Filter Maintenance Review', due_date: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10), status: 'Upcoming' },
      ])
      .select('*')
  )

  return { records, reminders }
}

async function seedThresholdsAndNotifications(): Promise<void> {
  await supabaseAdmin
    .from('thresholds')
    .upsert(
      [
        { parameter: 'turbidity', stage: 'after', config: { max: 1 } },
        { parameter: 'pH', stage: '', config: { min: 6.5, max: 8.5 } },
      ],
      { onConflict: 'parameter,stage' }
    )
  await supabaseAdmin.from('notification_providers').upsert({ provider: 'twilio', enabled: false, config: {} }, { onConflict: 'provider' })
}

async function main(): Promise<void> {
  console.log('Seeding test data...\n')

  const profileId = await recreateTestUser()
  console.log(`✓ Test user: ${TEST_USER.email} / ${TEST_USER.password}`)

  const device = await ensureDevice()
  console.log(`✓ Device: ${device.id} (${device.device_identifier})`)

  const sensors = await ensureSensors(device.id)
  const findSensor = sensorLookup(sensors)
  console.log(`✓ Sensors: ${sensors.length}`)

  const { activeRun, completedRun } = await seedTestRuns(device.id)
  console.log(`✓ Test runs: active=${activeRun.id} completed=${completedRun.id}`)

  const readingRows = [...buildReadingCycles(device.id, activeRun.id, findSensor), ...buildReadingCycles(device.id, completedRun.id, findSensor)]
  check('Create sensor readings', await supabaseAdmin.from('sensor_readings').insert(readingRows).select('id'))
  console.log(`✓ Sensor readings: ${readingRows.length}`)

  const alerts = await seedAlerts(device.id, activeRun.id)
  console.log(`✓ Alerts: ${alerts.length}`)

  const calibrationRecords = await seedCalibrationRecords(profileId, findSensor)
  console.log(`✓ Calibration records: ${calibrationRecords.length}`)

  const labRecords = await seedLabValidation(completedRun.id)
  console.log(`✓ Laboratory validation records: ${labRecords.length}`)

  const { records: maintenanceRecords, reminders } = await seedMaintenance(profileId)
  console.log(`✓ Maintenance records: ${maintenanceRecords.length}, reminders: ${reminders.length}`)

  await seedThresholdsAndNotifications()
  console.log('✓ Thresholds + notification provider config')

  const { data: session, error: loginError } = await supabaseAnon.auth.signInWithPassword({
    email: TEST_USER.email,
    password: TEST_USER.password,
  })
  if (loginError || !session.session) throw new Error(`Login smoke-test failed: ${loginError?.message}`)

  const base = `http://localhost:${env.port}/api/v1`
  console.log('\nDone. Try it out:\n')
  console.log(`  export TOKEN="${session.session.access_token}"`)
  console.log(`  curl ${base}/dashboard/summary -H "Authorization: Bearer $TOKEN"`)
  console.log(`  curl ${base}/test-runs -H "Authorization: Bearer $TOKEN"`)
  console.log(`  curl ${base}/telemetry/current -H "Authorization: Bearer $TOKEN"`)
  console.log(`  curl ${base}/alerts -H "Authorization: Bearer $TOKEN"`)
  console.log(`  curl -N ${base}/alerts/stream -H "Authorization: Bearer $TOKEN"   # SSE`)
  console.log(`\n  activeTestRunId=${activeRun.id}`)
  console.log(`  completedTestRunId=${completedRun.id}`)
  console.log(`  deviceId=${device.id}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nSeed failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
