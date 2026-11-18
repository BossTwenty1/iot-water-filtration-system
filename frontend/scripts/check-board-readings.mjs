import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import ts from 'typescript'

const require=createRequire(import.meta.url)
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
const stripImports=source=>source.replace(/^import .*\r?\n/gm,'')
const load=async(source,bindings={})=>{
  const key='__boardCheck'+load.index++
  globalThis[key]=bindings
  let output=compile('const {'+Object.keys(bindings).join(',')+'}=globalThis.'+key+';\n'+stripImports(source))
  output=output.replaceAll('"react/jsx-runtime"',JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href))
  const result=await import('data:text/javascript,'+encodeURIComponent(output))
  delete globalThis[key]
  return result
}
load.index=0
const formatters=await load(await readFile(new URL('../src/utils/formatters.ts',import.meta.url),'utf8'))
const pre={id:'pre-cycle',deviceId:'d4b1601b-9355-4203-ac6e-2b84b28cbf50',deviceDisplayId:'Device 0001',testRunId:null,timestamp:'2026-11-17T13:12:57Z',before:{pH:7.56,temperature:26.25,flowRate:0},after:{}}
const post={id:'post-cycle',deviceId:'cb06c51a-83db-4940-b6cc-19f6d52fcde7',deviceDisplayId:'Device 0005',testRunId:null,timestamp:'2026-11-17T12:45:47Z',before:{},after:{temperature:25}}
const original=structuredClone({pre,post})
const apiCalls=[]
const apiRequest=async(path,options)=>{
  apiCalls.push({path,options})
  // Even an unexpected API response must not add another board to the pair.
  return [path.includes('stage=before')?pre:post,{...pre,id:'simulated-cycle',deviceId:'simulated-board'}]
}
const {getBoardTelemetry}=await load(await readFile(new URL('../src/services/telemetryService.ts',import.meta.url),'utf8'),{apiRequest})
const signal=new AbortController().signal
assert.deepEqual(await getBoardTelemetry('before',signal),[pre])
assert.deepEqual(await getBoardTelemetry('after',signal),[post])
assert.deepEqual(apiCalls.map(call=>call.path),[
  `telemetry?stage=before&deviceId=${pre.deviceId}&limit=200`,
  `telemetry?stage=after&deviceId=${post.deviceId}&limit=200`,
])
assert.ok(apiCalls.every(call=>call.options.signal===signal&&call.options.cache==='no-store'))

// Latest-reading cards: one request per confirmed board, and each board only
// contributes its own stage, so a stage never gets two sets of cards.
const currentCalls=[]
const reading=(parameter,stage,value)=>({parameter,label:parameter,value,unit:'',stage})
const currentRequest=async(path)=>{
  currentCalls.push(path)
  return path.includes(pre.deviceId)
    ?[reading('pH','before',7.56),reading('TDS','before',289),reading('pH','after',99)]
    :[reading('pH','after',3.82),reading('TDS','after',36),reading('pH','before',99)]
}
const latestService=await load(await readFile(new URL('../src/services/telemetryService.ts',import.meta.url),'utf8'),{apiRequest:currentRequest})
const latest=await latestService.telemetryService.getLatestTelemetry()
assert.deepEqual(currentCalls,[`telemetry/current?deviceId=${pre.deviceId}`,`telemetry/current?deviceId=${post.deviceId}`])
assert.deepEqual(latest.map(r=>`${r.stage}-${r.parameter}=${r.value}`),['before-pH=7.56','before-TDS=289','after-pH=3.82','after-TDS=36'])
const keys=latest.map(r=>`${r.stage}-${r.parameter}`)
assert.equal(new Set(keys).size,keys.length,'unique stage/parameter cards')

// Exercise the actual refresh hook with controlled network promises and timers.
// Hook slots model React state/ref retention without a browser or a hosted API.
function hookHarness(){
  const slots=[],effects=[],timers=new Map()
  let cursor=0
  let nextTimer=0
  const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]))
  const hooks={
    useState(initial){
      const index=cursor++
      if(!(index in slots))slots[index]=initial
      return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next}]
    },
    useRef(initial){
      const index=cursor++
      if(!(index in slots))slots[index]={current:initial}
      return slots[index]
    },
    useCallback(callback,deps){
      const index=cursor++
      if(!slots[index]||!equal(slots[index].deps,deps))slots[index]={callback,deps}
      return slots[index].callback
    },
    useEffect(callback,deps){
      const index=cursor++
      if(!slots[index]||!equal(slots[index].deps,deps)){
        slots[index]?.cleanup?.()
        slots[index]={deps}
        effects.push(()=>{slots[index].cleanup=callback()})
      }
    },
  }
  return {hooks,timers,render(fn){cursor=0;const result=fn();effects.splice(0).forEach(effect=>effect());return result},
    window:{setInterval(fn,ms){assert.equal(ms,10000);timers.set(++nextTimer,fn);return nextTimer},clearInterval(id){timers.delete(id)}},
    dispose(){slots.forEach(slot=>slot?.cleanup?.())}}
}
const requests=[]
const fakeGetBoardTelemetry=(stage,signal)=>new Promise((resolve,reject)=>{
  requests.push({stage,signal,resolve,reject})
  signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true})
})
const harness=hookHarness()
const {useBoardTelemetry}=await load(await readFile(new URL('../src/hooks/useBoardTelemetry.ts',import.meta.url),'utf8'),{...harness.hooks,getBoardTelemetry:fakeGetBoardTelemetry,window:harness.window})
const tick=()=>[...harness.timers.values()][0]()
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve()}
let resource=harness.render(useBoardTelemetry)
assert.deepEqual(requests.map(r=>r.stage),['before','after'])
requests[0].resolve([pre])
await flush()
resource=harness.render(useBoardTelemetry)
assert.deepEqual(resource.before.records,[pre])
assert.equal(resource.before.loading,false)
assert.equal(resource.after.loading,true)
tick()
assert.equal(requests.length,2,'skip overlapping polls while a stage is still pending')
requests[1].resolve([post])
await flush()
resource=harness.render(useBoardTelemetry)
assert.equal(resource.refreshing,false)
assert.deepEqual(resource.after.records,[post])
tick()
resource=harness.render(useBoardTelemetry)
assert.equal(resource.refreshing,true)
assert.deepEqual(resource.before.records,[pre],'retain values during refresh')
assert.deepEqual(resource.after.records,[post])
const newerPost={...post,id:'new-post-cycle',timestamp:'2026-11-17T13:13:15Z',after:{temperature:24.5}}
requests[3].resolve([newerPost])
await flush()
resource=harness.render(useBoardTelemetry)
assert.deepEqual(resource.after.records,[newerPost],'after can finish first')
assert.deepEqual(resource.before.records,[pre])
requests[2].reject(new Error('Before server unavailable'))
await flush()
resource=harness.render(useBoardTelemetry)
assert.equal(resource.before.error,'Before server unavailable')
assert.deepEqual(resource.before.records,[pre],'failed refresh retains original pre cycle')
assert.equal(resource.before.records[0].timestamp,pre.timestamp)
assert.equal(resource.after.error,null)
assert.equal(resource.refreshing,false)
tick()
requests[4].resolve([{...pre,id:'missing-pre',before:{}}])
requests[5].resolve([])
await flush()
resource=harness.render(useBoardTelemetry)
assert.equal(resource.before.error,null)
assert.deepEqual(resource.before.records[0].before,{},'do not backfill missing measurements from earlier cycles')
assert.deepEqual(resource.after.records,[],'successful empty response replaces prior data')
tick()
const pendingSignals=requests.slice(-2).map(r=>r.signal)
harness.dispose()
await flush()
assert.ok(pendingSignals.every(s=>s.aborted))
assert.equal(harness.timers.size,0)
assert.deepEqual({pre,post},original)

const Box=({children,title,description,action})=>React.createElement('section',null,title,description,action,children)
const ready=records=>({records,loading:false,error:null})
resource={before:ready([pre]),after:ready([post]),refreshing:false,refresh:async()=>{}}
const {LatestBoardReadings}=await load(await readFile(new URL('../src/components/telemetry/LatestBoardReadings.tsx',import.meta.url),'utf8'),{...formatters,SectionCard:Box,useBoardTelemetry:()=>resource})
const render=()=>renderToStaticMarkup(React.createElement(LatestBoardReadings))
let html=render()
for(const value of ['Device 0001','Device 0005','9:12:57 PM','8:45:47 PM','27 min 10 sec','7.56','26.25','25.00','0.0','independently recorded','every 10 seconds'])assert.ok(html.includes(value),value)
assert.equal((html.match(/<table/g)??[]).length,1)
resource={...resource,refreshing:true}
html=render()
assert.match(html,/disabled/)
assert.match(html,/26\.25/)
assert.match(html,/25\.00/)
resource={...resource,refreshing:false,before:{...ready([pre]),error:'Before unavailable'}}
html=render()
assert.match(html,/role="alert"/)
assert.match(html,/Showing its last saved records/)
assert.match(html,/25\.00/)
resource={...resource,before:{records:[],loading:true,error:null}}
html=render()
assert.match(html,/Loading/)
assert.match(html,/25\.00/,'one board can load while the other remains visible')
resource={...resource,before:ready([]),after:ready([])}
html=render()
assert.doesNotMatch(html,/NaN|undefined/)
assert.match(html,/No record/)
console.log('Board telemetry checks passed: stage-specific queries, independent arrival order, single-flight polling, refresh preservation, errors/recovery, cancellation, timestamps, missing/zero values, and side-by-side rendering.')
