import type { TelemetryRecord } from '../types'

// Window for showing a pre-filtration cycle and a post-filtration cycle on one
// row when their recording times differ (boards not yet slot-aligned).
// PROVISIONAL — the approved pairing tolerance is TBD
// (docs/TWO_BOARD_SYNC_AND_MERGE.md). Matches the backend default.
export const BOARD_PAIR_TOLERANCE_MS=30_000

export type BoardPairing='exact'|'nearest'|'unpaired'

export interface PairedBoardRow {
  id:string
  // The before cycle's time when present, otherwise the after cycle's time.
  timestamp:string
  before?:TelemetryRecord
  after?:TelemetryRecord
  pairing:BoardPairing
  // after time minus before time, in seconds; null for a half row.
  gapSeconds:number|null
}

const timeOf=(record:TelemetryRecord)=>Date.parse(record.timestamp)

// Puts each before-filtration cycle and after-filtration cycle on one row so
// the two stages can be compared side by side.
// - Exact recording time first, then the nearest within toleranceMs.
// - Only cycles from the same test run (or both unlinked) are paired, and two
//   cycles that both name an installation must name the same one.
// - The same device is paired with itself only at the identical time (one
//   board that reports both stages in one cycle).
// - Each cycle is used at most once and no value is carried forward from
//   another cycle; a cycle without a partner stays a half row.
// Rows are time-aligned readings, not experimentally matched water samples.
export function pairBoardRecords(beforeRecords:TelemetryRecord[],afterRecords:TelemetryRecord[],toleranceMs=BOARD_PAIR_TOLERANCE_MS):PairedBoardRow[]{
  const candidates:Array<{before:TelemetryRecord;after:TelemetryRecord;gap:number}>=[]
  for(const before of beforeRecords){
    for(const after of afterRecords){
      const gap=Math.abs(timeOf(after)-timeOf(before))
      if(!Number.isFinite(gap)||gap>toleranceMs)continue
      if((before.testRunId??null)!==(after.testRunId??null))continue
      if(before.installationId&&after.installationId&&before.installationId!==after.installationId)continue
      if(before.deviceId===after.deviceId&&gap!==0)continue
      candidates.push({before,after,gap})
    }
  }
  // Smallest gap wins, so an exact match is never taken by a looser one.
  candidates.sort((a,b)=>a.gap-b.gap||timeOf(b.before)-timeOf(a.before))

  const used=new Set<TelemetryRecord>()
  const rows:PairedBoardRow[]=[]
  for(const {before,after} of candidates){
    if(used.has(before)||used.has(after))continue
    used.add(before)
    used.add(after)
    const gapSeconds=(timeOf(after)-timeOf(before))/1000
    rows.push({id:`${before.id}~${after.id}`,timestamp:before.timestamp,before,after,pairing:gapSeconds===0?'exact':'nearest',gapSeconds})
  }
  for(const before of beforeRecords)if(!used.has(before))rows.push({id:before.id,timestamp:before.timestamp,before,pairing:'unpaired',gapSeconds:null})
  for(const after of afterRecords)if(!used.has(after))rows.push({id:after.id,timestamp:after.timestamp,after,pairing:'unpaired',gapSeconds:null})

  return rows.sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp))
}

// "+13 s" / "−2 min 5 s" style label for a nonzero gap; null when not shown.
export function formatPairGap(gapSeconds:number|null){
  if(gapSeconds===null||gapSeconds===0)return null
  const sign=gapSeconds>0?'+':'−'
  const total=Math.round(Math.abs(gapSeconds))
  const minutes=Math.floor(total/60)
  const seconds=total%60
  return `${sign}${minutes?`${minutes} min `:''}${seconds} s`
}
