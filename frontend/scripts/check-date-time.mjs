import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

// Use the project's existing compiler; no test framework or live API is needed.
const source=await readFile(new URL('../src/utils/formatters.ts',import.meta.url),'utf8')
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}})
const {dateTimeSettings,formatDateTime,formatTime}=await import(`data:text/javascript,${encodeURIComponent(outputText)}`)

assert.deepEqual(dateTimeSettings,{
  timezone:'Asia/Manila (UTC+08:00)',
  dateFormat:'MMM DD, YYYY',
  timeFormat:'12-hour (AM/PM)',
})
assert.equal(formatDateTime('2026-10-27T02:57:00Z'),'Oct 27, 2026, 10:57 AM')
assert.equal(formatDateTime('2026-10-07T02:57:00Z'),'Oct 07, 2026, 10:57 AM')
assert.equal(formatDateTime('2026-10-26T16:05:00Z'),'Oct 27, 2026, 12:05 AM')
assert.equal(formatDateTime('2026-12-31T16:00:00Z'),'Jan 01, 2027, 12:00 AM')
assert.equal(formatTime('2026-10-27T04:00:00Z'),'12:00 PM')
assert.equal(formatTime('2026-10-27T15:59:59Z',true),'11:59:59 PM')
assert.equal(formatDateTime('2026-10-27T02:57:43Z',true),'Oct 27, 2026, 10:57:43 AM')
assert.equal(formatDateTime('not a timestamp'),'—')
assert.equal(formatTime('not a timestamp'),'—')

const original='2026-10-26T16:05:43.123Z'
formatDateTime(original,true)
assert.equal(original,'2026-10-26T16:05:43.123Z')
console.log('Date/time checks passed: client format, Philippine date rollover, midnight/noon, seconds, and invalid timestamps.')
