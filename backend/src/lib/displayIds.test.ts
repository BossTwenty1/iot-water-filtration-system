import { describe, expect, it } from 'vitest'
import { displayId } from './displayIds'

describe('permanent record display IDs', () => {
  it('labels a database number without changing it or truncating larger numbers', () => {
    expect(displayId('Test', 1)).toBe('Test 0001')
    expect(displayId('Device', 1)).toBe('Device 0001')
    expect(displayId('Alert', 12345)).toBe('Alert 12345')
  })
  it('does not invent a number when the database has none or returns invalid data', () => {
    for (const value of [undefined, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(displayId('Test', value)).toBeUndefined()
    }
  })
})
