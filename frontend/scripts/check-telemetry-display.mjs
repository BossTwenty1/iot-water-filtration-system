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
const record={id:'temperature-only',deviceId:'device-uuid',deviceDisplayId:'Device 0005',timestamp:'2026-11-17T11:49:53Z',testRunId:null,before:{},after:{temperature:25.12}}
const fixtures={records:[record]}
const telemetryService={getTelemetryHistory:()=>fixtures.records}
const empty=()=>[]
const services={telemetryService,alertsService:{getAlerts:empty},testRunsService:{getTestRuns:empty},deviceService:{getDeviceStatus:()=>null}}
const Box=({children})=>React.createElement('div',null,children)
const stubNames=['LatestBoardReadings','PageHeader','SectionCard','SummaryCard','StatusBadge','Modal','ResourceState','TelemetryChart','TelemetrySparkline','ProcessTopology','SensorGrid','Link','Download','Info','Activity','CloudCog','Droplets','FlaskConical','Gauge','ThermometerSun']
const bindings={usePermission:()=>true,...formatters,...services,useState:React.useState,useServiceData:(fn)=>({status:'success',data:fn()}),downloadCsv:()=>{},...Object.fromEntries(stubNames.map(n=>[n,Box]))}
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
 assert.match(html,/temperature \(°C\)/)
 assert.match(html,/Nov 17, 2026/)
 assert.match(html,/—/)
 if(page==='HistoryPage') assert.match(html,/25\.12 °C<\/div>/) // details use the same value
 assert.doesNotMatch(html,/NaN|undefined/)
 fixtures.records=[{...record,after:{temperature:0,TDS:0,flowRate:0,pH:0,turbidity:0}}]
 html=render()
 assert.match(html,/0\.00/)
 assert.doesNotMatch(html,/NaN|undefined/)
 fixtures.records=[record]
 console.log(`${page}: temperature-only record, device/date context, missing measurements and numeric zero passed.`)
}
delete globalThis.__telemetryDisplayCheck
