import { describe, expect, it, vi, beforeEach } from 'vitest'
import { chainable, ok } from '../__tests__/helpers/supabaseMock'
import type { ThresholdRow } from '../types/db'
import { evaluateReadingsForAlerts, raiseAlertIfNotActive } from './alertEngine'

// vi.mock factories can only reference variables declared via vi.hoisted —
// Vitest hoists both above every import, including the static import of
// alertEngine above, so it picks up these mocked modules.
const { supabaseMock, dispatchNotification } = vi.hoisted(() => ({
  supabaseMock: { from: vi.fn() },
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../config/supabaseClient', () => ({ supabaseAdmin: supabaseMock }))
vi.mock('./notificationService', () => ({ dispatchNotification }))

beforeEach(() => {
  supabaseMock.from.mockReset()
  dispatchNotification.mockClear()
})

describe('raiseAlertIfNotActive (dedupe)', () => {
  it('does not insert or notify when an Active alert already exists for (device, source)', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable(ok({ id: 'existing-alert' }))) // hasActiveAlert -> found

    await raiseAlertIfNotActive({
      deviceId: 'device-1',
      testRunId: null,
      sensorReadingId: 'reading-1',
      category: 'Water Quality',
      source: 'Pre-Filtration pH Sensor',
      title: 'Abnormal pH',
      message: 'too high',
      severity: 'Warning',
    })

    expect(supabaseMock.from).toHaveBeenCalledTimes(1) // only the existence check, no insert
    expect(dispatchNotification).not.toHaveBeenCalled()
  })

  it('inserts and dispatches a notification when no Active alert exists', async () => {
    supabaseMock.from
      .mockReturnValueOnce(chainable(ok(null))) // hasActiveAlert -> none
      .mockReturnValueOnce(chainable(ok(null))) // insert

    const input = {
      deviceId: 'device-1',
      testRunId: null,
      sensorReadingId: 'reading-1',
      category: 'Water Quality',
      source: 'Pre-Filtration pH Sensor',
      title: 'Abnormal pH',
      message: 'too high',
      severity: 'Warning',
    }
    await raiseAlertIfNotActive(input)

    expect(supabaseMock.from).toHaveBeenCalledTimes(2)
    expect(dispatchNotification).toHaveBeenCalledWith(input)
  })
})

describe('evaluateReadingsForAlerts', () => {
  it('raises a Sensor Fault alert for an unavailable reading regardless of value, even with no thresholds configured', async () => {
    supabaseMock.from
      .mockReturnValueOnce(chainable(ok([] as ThresholdRow[]))) // thresholds
      .mockReturnValueOnce(chainable(ok(null))) // hasActiveAlert
      .mockReturnValueOnce(chainable(ok(null))) // insert

    await evaluateReadingsForAlerts('device-1', null, [
      { sensorReadingId: 'r1', category: 'ph', position: 'pre_filtration', value: null, readingStatus: 'unavailable' },
    ])

    expect(dispatchNotification).toHaveBeenCalledWith(expect.objectContaining({ category: 'Sensor Fault', title: 'Sensor Connection Warning' }))
  })

  it('raises nothing for a reading within the configured threshold range', async () => {
    const thresholds: ThresholdRow[] = [
      { id: 't1', parameter: 'pH', stage: 'before', config: { min: 6, max: 8 }, updated_at: '2026-09-20T00:00:00.000Z' },
    ]
    supabaseMock.from.mockReturnValueOnce(chainable(ok(thresholds)))

    await evaluateReadingsForAlerts('device-1', null, [
      { sensorReadingId: 'r1', category: 'ph', position: 'pre_filtration', value: 7, readingStatus: null },
    ])

    expect(supabaseMock.from).toHaveBeenCalledTimes(1) // just the threshold lookup, no alert path entered
    expect(dispatchNotification).not.toHaveBeenCalled()
  })

  it('raises a Water Quality alert when a reading breaches the configured maximum', async () => {
    const thresholds: ThresholdRow[] = [
      { id: 't1', parameter: 'pH', stage: 'before', config: { min: 6, max: 8 }, updated_at: '2026-09-20T00:00:00.000Z' },
    ]
    supabaseMock.from
      .mockReturnValueOnce(chainable(ok(thresholds)))
      .mockReturnValueOnce(chainable(ok(null))) // hasActiveAlert
      .mockReturnValueOnce(chainable(ok(null))) // insert

    await evaluateReadingsForAlerts('device-1', null, [
      { sensorReadingId: 'r1', category: 'ph', position: 'pre_filtration', value: 9, readingStatus: null },
    ])

    expect(dispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Water Quality', message: expect.stringContaining('above the configured maximum of 8') })
    )
  })

  it('raises nothing for an extreme value when no threshold is configured at all', async () => {
    supabaseMock.from.mockReturnValueOnce(chainable(ok([] as ThresholdRow[])))

    await evaluateReadingsForAlerts('device-1', null, [
      { sensorReadingId: 'r1', category: 'ph', position: 'pre_filtration', value: 999, readingStatus: null },
    ])

    expect(supabaseMock.from).toHaveBeenCalledTimes(1)
    expect(dispatchNotification).not.toHaveBeenCalled()
  })
})
