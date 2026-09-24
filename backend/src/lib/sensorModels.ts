import type { CalibrationRecord } from '../types/domain'

// Mirrors the sensor model/unit metadata the frontend's mock
// calibrationService already displays (frontend/src/services/calibrationService.ts
// on feature/frontend-foundation) — kept here only so the API returns the
// same labels, not as a new hardware decision. Turbidity intentionally has
// no confirmed model per docs/PENDING_DECISIONS.md.
export const SENSOR_MODELS: Record<CalibrationRecord['parameter'], { model: string; unit: string }> = {
  pH: { model: 'PH-4502C', unit: 'pH' },
  turbidity: { model: 'Pending Confirmation', unit: 'NTU' },
  TDS: { model: 'DFRobot TDS', unit: 'ppm' },
  temperature: { model: 'DS18B20', unit: '°C' },
  flowRate: { model: 'ZJ-S201C', unit: 'L/min' },
}
