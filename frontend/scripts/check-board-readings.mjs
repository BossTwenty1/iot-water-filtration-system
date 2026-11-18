import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import ts from 'typescript'

const require=createRequire(import.meta.url)
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
const load=source=>import(`data:text/javascript,${encodeURIComponent(compile(source))}`)
const formatters=await load(await readFile(new URL('../src/utils/formatters.ts',import.meta.url),'utf8'))
const calls=[]
const pre={id:'pre-cycle',deviceId:'pre',deviceDisplayId:'Device 0004',testRunId:null,timestamp:'2026-11-17T13:12:57Z',before:{pH:7.56,temperature:26.25,flowRate:0},after:{}}
const post={id:'post-cycle',deviceId:'post',deviceDisplayId:'Device 0005',testRunId:null,timestamp:'2026-11-17T12:45:47Z',before:{},after:{temperature:25}}
let responses={before:[pre],after:[post]}
globalThis.__boardApi=async path=>{calls.push(path);return path.includes('stage=before')?responses.before:responses.after}
let service=await readFile(new URL('../src/services/telemetryService.ts',import.meta.url),'utf8')
service=service.replace(/^import .*\r?\n/gm,'')
service='const apiRequest=globalThis.__boardApi;\n'+service
const {getLatestBoardRecords}=await load(service)
let records=await getLatestBoardRecords()
assert.deepEqual(calls,['telemetry?stage=before&limit=10','telemetry?stage=after&limit=10'])
assert.equal(records.before,pre)
assert.equal(records.after,post)
assert.equal(pre.timestamp,'2026-11-17T13:12:57Z')
assert.equal(post.timestamp,'2026-11-17T12:45:47Z')
const source=await readFile(new URL('../src/components/telemetry/LatestBoardReadings.tsx',import.meta.url),'utf8')
const Box=({children,title,description,action})=>React.createElement('section',null,title,description,action,children)
let status='success'
const bindings={...formatters,getLatestBoardRecords,useServiceData:()=>({status,data:records,error:'Example error',reload:async()=>{}}),SectionCard:Box,ResourceState:({status})=>React.createElement('p',null,status)}
globalThis.__boardBindings=bindings
let output=compile('const {'+Object.keys(bindings).join(',')+'}=globalThis.__boardBindings;\n'+source.replace(/^import .*\r?\n/gm,''))
output=output.replaceAll('"react/jsx-runtime"',JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href))
const {LatestBoardReadings}=await import(`data:text/javascript,${encodeURIComponent(output)}`)
const render=()=>renderToStaticMarkup(React.createElement(LatestBoardReadings))
let html=render()
for(const text of ['Device 0004','Device 0005','9:12:57 PM','8:45:47 PM','27 min 10 sec','7.56','26.25','25.00','0.0','not a synchronized','older values are not carried forward']) assert.ok(html.includes(text),text)
assert.equal((html.match(/<table/g)??[]).length,1)
assert.ok(html.includes('—'))
assert.deepEqual(records,{before:pre,after:post})
responses={before:[],after:[post]};records=await getLatestBoardRecords()
html=render();assert.match(html,/No record/);assert.match(html,/until both boards have a record/);assert.match(html,/25\.00/)
responses={before:[],after:[]};records=await getLatestBoardRecords()
html=render();assert.doesNotMatch(html,/NaN|undefined/)
records={before:pre,after:{...post,timestamp:pre.timestamp}}
assert.match(render(),/0 min 0 sec/)
records={before:{...pre,before:{}},after:post}
assert.doesNotMatch(render(),/7\.56/)
status='error';assert.match(render(),/error/)
status='loading';assert.match(render(),/loading/)
assert.match(render(),/disabled/)
delete globalThis.__boardApi;delete globalThis.__boardBindings
console.log('Both-board checks passed: independent stage queries, timestamps/gap, side-by-side values, zero/missing values, no carry-forward or mutation, empty/error/loading states.')
