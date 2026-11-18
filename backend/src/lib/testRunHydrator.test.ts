import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../config/supabaseClient', () => ({ supabaseAdmin: {} }))
import { formatDuration } from './testRunHydrator'

afterEach(() => vi.useRealTimers())

describe('test duration display', () => {
  const start='2026-10-26T00:00:00Z'
  it.each([
    [0, '00m 00s'],
    [59, '00m 59s'],
    [3599, '59m 59s'],
    [3600, '1h 00m 00s'],
    [3661, '1h 01m 01s'],
    [57336, '15h 55m 36s'],
    [90000, '25h 00m 00s'],
    [-1, '00m 00s'],
  ])('formats %i elapsed seconds as %s', (seconds, expected) => {
    const end=new Date(Date.parse(start)+seconds*1000).toISOString()
    expect(formatDuration(start,end)).toBe(expected)
  })
  it('shows hours for an ongoing test without a saved end time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-26T15:55:36Z'))
    expect(formatDuration(start)).toBe('15h 55m 36s')
    expect(formatDuration(start,null)).toBe('15h 55m 36s')
  })
})
