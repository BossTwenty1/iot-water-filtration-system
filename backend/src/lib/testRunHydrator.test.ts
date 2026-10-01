import { describe, expect, it } from 'vitest'
import { computeProcessedVolume, formatDuration } from './testRunHydrator'

describe('testRunHydrator', () => {
  describe('formatDuration', () => {
    it('formats duration between two ISO timestamps', () => {
      const start = '2026-03-30T10:00:00.000Z'
      const end = '2026-03-30T10:05:30.000Z'
      expect(formatDuration(start, end)).toBe('05m 30s')
    })

    it('formats zero duration gracefully', () => {
      const start = '2026-03-30T10:00:00.000Z'
      expect(formatDuration(start, start)).toBe('00m 00s')
    })
  })

  describe('computeProcessedVolume', () => {
    it('returns undefined if less than 2 readings are provided', () => {
      expect(computeProcessedVolume(null)).toBeUndefined()
      expect(computeProcessedVolume([])).toBeUndefined()
      expect(computeProcessedVolume([{ value: 2.0, measured_at: '2026-03-30T10:00:00.000Z' }])).toBeUndefined()
    })

    it('computes volume using trapezoidal numerical integration', () => {
      // 1 minute at constant 2.0 L/min = 2.0 L
      // Next 1 minute accelerating from 2.0 L/min to 4.0 L/min (avg 3.0 L/min) = 3.0 L
      // Total volume = 5.0 L
      const readings = [
        { value: 2.0, measured_at: '2026-03-30T10:00:00.000Z' },
        { value: 2.0, measured_at: '2026-03-30T10:01:00.000Z' },
        { value: 4.0, measured_at: '2026-03-30T10:02:00.000Z' },
      ]
      expect(computeProcessedVolume(readings)).toBe(5.0)
    })

    it('skips intervals where flow value is null or timestamps are invalid', () => {
      const readings = [
        { value: 2.0, measured_at: '2026-03-30T10:00:00.000Z' },
        { value: null, measured_at: '2026-03-30T10:01:00.000Z' },
        { value: 2.0, measured_at: '2026-03-30T10:02:00.000Z' },
        { value: 2.0, measured_at: '2026-03-30T10:03:00.000Z' },
      ]
      // Only interval 10:02 to 10:03 is valid: 1 min * 2.0 L/min = 2.0 L
      expect(computeProcessedVolume(readings)).toBe(2.0)
    })

    it('returns undefined if no valid intervals exist', () => {
      const readings = [
        { value: null, measured_at: '2026-03-30T10:00:00.000Z' },
        { value: null, measured_at: '2026-03-30T10:01:00.000Z' },
      ]
      expect(computeProcessedVolume(readings)).toBeUndefined()
    })
  })
})
