import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

// Checks pairBoardRecords: before/after cycles from two boards share one row.
// All fixtures are synthetic.
const source=await readFile(new URL('../src/utils/pairBoardRecords.ts',import.meta.url),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {pairBoardRecords,formatPairGap,BOARD_PAIR_TOLERANCE_MS}=await import(`data:text/javascript,${encodeURIComponent(compiled)}`)

const T0=Date.parse('2026-11-18T06:05:00Z')
const at=seconds=>new Date(T0+seconds*1000).toISOString()
const pre=(seconds,extra={})=>({id:`pre@${seconds}`,deviceId:'pre-board',deviceDisplayId:'Device 0006',testRunId:null,timestamp:at(seconds),before:{pH:6.8},after:{},...extra})
const post=(seconds,extra={})=>({id:`post@${seconds}`,deviceId:'post-board',deviceDisplayId:'Device 0007',testRunId:null,timestamp:at(seconds),before:{},after:{pH:7.0},...extra})

assert.equal(BOARD_PAIR_TOLERANCE_MS,30000)

// exact match -> one row
let rows=pairBoardRecords([pre(0)],[post(0)])
assert.equal(rows.length,1)
assert.equal(rows[0].pairing,'exact')
assert.equal(rows[0].gapSeconds,0)
assert.equal(rows[0].before.id,'pre@0')
assert.equal(rows[0].after.id,'post@0')

// nearest within tolerance, gap reported as after - before
rows=pairBoardRecords([pre(13)],[post(0)])
assert.equal(rows[0].pairing,'nearest')
assert.equal(rows[0].gapSeconds,-13)
assert.equal(rows[0].timestamp,at(13),'row time is the before cycle')

// outside tolerance -> two half rows, newest first
rows=pairBoardRecords([pre(0)],[post(45)])
assert.deepEqual(rows.map(r=>[r.pairing,!!r.before,!!r.after]),[['unpaired',false,true],['unpaired',true,false]])
assert.equal(pairBoardRecords([pre(0)],[post(1)],0).length,2,'tolerance 0 = exact only')

// each cycle used once; closest partner wins
rows=pairBoardRecords([pre(0),pre(60)],[post(2),post(58)])
assert.deepEqual(rows.map(r=>[r.before.id,r.after.id]),[['pre@60','post@58'],['pre@0','post@2']])

// no carry-forward: an extra before cycle stays alone
rows=pairBoardRecords([pre(0),pre(60)],[post(0)])
assert.equal(rows[0].before.id,'pre@60')
assert.equal(rows[0].after,undefined)

// different test runs or installations never pair
assert.equal(pairBoardRecords([pre(0,{testRunId:'run-1'})],[post(0,{testRunId:'run-2'})]).length,2)
assert.equal(pairBoardRecords([pre(0,{installationId:'a'})],[post(0,{installationId:'b'})]).length,2)
assert.equal(pairBoardRecords([pre(0,{installationId:'a'})],[post(0)]).length,1,'missing installation does not block')

// one board reporting both stages pairs with itself only at the identical time
const self=(seconds,stage)=>({id:`self-${stage}@${seconds}`,deviceId:'combo',testRunId:null,timestamp:at(seconds),before:stage==='before'?{pH:6.9}:{},after:stage==='after'?{pH:7.1}:{}})
assert.equal(pairBoardRecords([self(0,'before')],[self(0,'after')]).length,1)
assert.equal(pairBoardRecords([self(0,'before')],[self(5,'after')]).length,2)

// inputs are not mutated
const input=[pre(0)]
const copy=structuredClone(input)
pairBoardRecords(input,[post(0)])
assert.deepEqual(input,copy)

assert.equal(formatPairGap(0),null)
assert.equal(formatPairGap(null),null)
assert.equal(formatPairGap(13),'+13 s')
assert.equal(formatPairGap(-125),'−2 min 5 s')

console.log('Board pairing checks passed: exact/nearest/unpaired rows, tolerance, one-use greedy matching, no carry-forward, test-run/installation guards, single-board cycles, gap labels.')
