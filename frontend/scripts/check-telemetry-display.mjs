import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require=createRequire(import.meta.url)
const formatSource=await readFile(new URL('../src/utils/formatters.ts',import.meta.url),'utf8')
const compile=(source)=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
const load=(source)=>import(`data:text/javascript,${encodeURIComponent(compile(source))}`)
const formatters=await load(formatSource)
const pairing=await load(await readFile(new URL('../src/utils/pairBoardRecords.ts',import.meta.url),'utf8'))
const record={id:'temperature-only',deviceId:'device-uuid',deviceDisplayId:'Device 0005',timestamp:'2026-11-17T11:49:53Z',testRunId:null,before:{},after:{temperature:25.12}}
const fixtures={records:[record]}
const telemetryService={getTelemetryHistory:()=>fixtures.records}
const empty=()=>[]
const services={telemetryService,alertsService:{getAlerts:empty},testRunsService:{getTestRuns:empty},deviceService:{getDeviceStatus:()=>null}}
const Box=({children})=>React.createElement('div',null,children)
const stubNames=['LatestBoardReadings','BoardReadingsComparison','SectionCard','SummaryCard','StatusBadge','Modal','ResourceState','TelemetryChart','TelemetrySparkline','ProcessTopology','SensorGrid','Link','Download','Info','Activity','CloudCog','Droplets','FlaskConical','Gauge','ThermometerSun']
let canExport=true
let exportClick
let exportRows
const boardResource=()=>({
 before:{records:fixtures.records.filter(row=>Object.keys(row.before).length>0),loading:false,error:null},
 after:{records:fixtures.records.filter(row=>Object.keys(row.after).length>0),loading:false,error:null},
 refreshing:false,refresh:async()=>{},
})
const bindings={
 usePermission:()=>canExport,...formatters,...pairing,...services,useState:React.useState,
 useServiceData:(fn)=>({status:'success',data:fn()}),useBoardTelemetry:boardResource,
 downloadCsv:(_filename,rows)=>{exportRows=rows},
 ...Object.fromEntries(stubNames.map(n=>[n,Box])),
 PageHeader:({actions})=>{exportClick=actions?.props.onClick;return React.createElement('header',null,actions)},
}
globalThis.__telemetryDisplayCheck=bindings

// Render the actual page JSX. Only service hooks and unrelated child components
// are stubbed, so the regression checks exercise table cells and reading details.
for(const page of ['HistoryPage','DashboardPage']){
 const original=await readFile(new URL(`../src/pages/${page}.tsx`,import.meta.url),'utf8')
 const source=original.replace(/^import .* from .*\r?\n/gm,'')
 const compiled=compile(`const {${Object.keys(bindings).join(',')}}=globalThis.__telemetryDisplayCheck;\n${source}`)
 const jsxUrl=new URL(`file:///${require.resolve('react/jsx-runtime').replace(/\\/g,'/')}`).href
 const module=await import(`data:text/javascript,${encodeURIComponent(compiled.replaceAll('"react/jsx-runtime"',JSON.stringify(jsxUrl)))}`)
 const render=()=>renderToStaticMarkup(React.createElement(module[page]))
 let html=render()
 assert.match(html,/25\.12/)
 assert.match(html,/Device 0005/)
 assert.match(html,/temperature \(°C\)/i)
 assert.match(html,/Nov 17, 2026/)
 assert.match(html,/—/)
 if(page==='HistoryPage') assert.match(html,/25\.12 °C<\/div>/) // details use the same value
 assert.doesNotMatch(html,/NaN|undefined/)
 if(page==='HistoryPage'){
  exportClick()
  assert.equal(exportRows.length,1)
  assert.equal(exportRows[0].after_device_id,'device-uuid')
  assert.equal(exportRows[0].before_device_id,undefined)
  assert.equal(exportRows[0].timestamp,record.timestamp)
  assert.equal(exportRows[0].after_temperature_c,25.12)
  assert.equal(exportRows[0].before_temperature_c,undefined)
  assert.equal(exportRows[0].pairing,'unpaired')
  assert.match(html,/After only/)

  // Two boards further apart than the pairing window stay separate half rows.
  const pre={...record,id:'pre-cycle',deviceId:'pre-board',deviceDisplayId:'Device 0001',timestamp:'2026-11-17T11:48:59Z',before:{pH:5.72,temperature:26.25},after:{}}
  fixtures.records=[pre,record]
  html=render()
  assert.match(html,/26\.25/)
  assert.match(html,/25\.12/)
  assert.match(html,/Before only/)
  exportClick()
  assert.equal(exportRows.length,2)
  assert.equal(exportRows.find(row=>row.before_device_id==='pre-board').timestamp,pre.timestamp)
  assert.equal(exportRows.find(row=>row.after_device_id==='device-uuid').before_temperature_c,undefined)

  // Same recording time: before and after share ONE row, values side by side.
  const alignedPre={...pre,id:'aligned-pre',timestamp:record.timestamp}
  fixtures.records=[alignedPre,record]
  html=render()
  const bodyRows=html.split('<tbody>')[1].split('</tbody>')[0].match(/<tr/g)??[]
  assert.equal(bodyRows.length,1,'before and after on the same row')
  assert.match(html,/Device 0001 \/ Device 0005/)
  assert.match(html,/26\.25<\/span><span class="text-muted" aria-hidden="true"> \/ <\/span><span class="text-hydro">25\.12/)
  assert.doesNotMatch(html,/Before only|After only/)
  exportClick()
  assert.equal(exportRows.length,1)
  assert.equal(exportRows[0].pairing,'exact')
  assert.equal(exportRows[0].before_device_id,'pre-board')
  assert.equal(exportRows[0].after_device_id,'device-uuid')
  assert.equal(exportRows[0].before_temperature_c,26.25)
  assert.equal(exportRows[0].after_temperature_c,25.12)

  // Within the window but not identical: one row, with the time gap shown.
  fixtures.records=[{...pre,id:'near-pre',timestamp:'2026-11-17T11:49:40Z'},record]
  html=render()
  assert.equal((html.split('<tbody>')[1].split('</tbody>')[0].match(/<tr/g)??[]).length,1)
  assert.match(html,/After recorded \+13 s/)
  canExport=false;exportRows=null;render();exportClick()
  assert.equal(exportRows,null,'CSV permissions remain enforced')
  canExport=true
 }
 fixtures.records=[{...record,after:{temperature:0,TDS:0,flowRate:0,pH:0,turbidity:0}}]
 html=render()
 assert.match(html,/0\.00/)
 assert.doesNotMatch(html,/NaN|undefined/)
 fixtures.records=[record]
 console.log(`${page}: temperature-only record, device/date context, missing measurements and numeric zero passed.`)
}
delete globalThis.__telemetryDisplayCheck
