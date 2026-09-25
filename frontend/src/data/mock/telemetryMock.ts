import type { SensorParameter, SensorReading, TelemetryRecord } from '../../types'

export const parameterMeta: Record<SensorParameter, { label: string; unit: string }> = {
  pH: { label: 'pH', unit: 'pH' },
  turbidity: { label: 'Turbidity', unit: 'NTU' },
  TDS: { label: 'TDS', unit: 'ppm' },
  temperature: { label: 'Temperature', unit: '°C' },
  flowRate: { label: 'Flow Rate', unit: 'L/min' },
  totalVolume: { label: 'Total Volume', unit: 'L' },
}

const beforeValues = { pH: 6.72, turbidity: 9.4, TDS: 302, temperature: 26.3, flowRate: 2.4, totalVolume: 0.72 }
const afterValues = { pH: 7.01, turbidity: 0.72, TDS: 181, temperature: 26.5, flowRate: 2.1, totalVolume: 0.72 }

export const currentReadings: SensorReading[] = (['pH', 'turbidity', 'TDS', 'temperature', 'flowRate'] as SensorParameter[]).flatMap((parameter) => [
  { parameter, ...parameterMeta[parameter], value: beforeValues[parameter], stage: 'before' as const },
  { parameter, ...parameterMeta[parameter], value: afterValues[parameter], stage: 'after' as const },
])

const samples = [
  ['14:15:00', 9.42, 0.82], ['14:17:30', 9.38, 0.78], ['14:20:00', 9.26, 0.69],
  ['14:22:30', 9.43, 0.8], ['14:25:00', 9.35, 0.72], ['14:27:30', 9.41, 0.75],
  ['14:30:00', 9.36, 0.71], ['14:33:40', 9.4, 0.72],
] as const

export const historyChartData = samples.map(([time, before, after]) => ({ time, before, after }))

export const telemetryRecords: TelemetryRecord[] = samples.slice().reverse().map(([time, turbidityBefore, turbidityAfter], index) => ({
  id: `TEL-2026-${String(index + 1).padStart(3, '0')}`,
  timestamp: `2026-09-30T${time}+08:00`,
  testRunId: 'RUN-2026-001',
  deviceId: 'ESP32-001',
  before: { ...beforeValues, pH: +(6.69 + (index % 4) * 0.01).toFixed(2), turbidity: turbidityBefore, TDS: 302 + (index % 3) },
  after: { ...afterValues, pH: +(6.99 + (index % 4) * 0.01).toFixed(2), turbidity: turbidityAfter, TDS: 180 + (index % 3) },
}))
