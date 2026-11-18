import type { SensorParameter,SensorStage } from '../types'

const sensorDecimals:Record<SensorParameter,number>={
  pH:2,
  turbidity:2,
  TDS:0,
  temperature:1,
  flowRate:1,
  totalVolume:2,
}

const timeZone='Asia/Manila'

export const dateTimeSettings={
  timezone:`${timeZone} (UTC+08:00)`,
  dateFormat:'MMM DD, YYYY',
  timeFormat:'12-hour (AM/PM)',
} as const

export function formatDateTime(value:string,includeSeconds=false){
  const date=new Date(value)
  if(Number.isNaN(date.getTime()))return '—'
  return new Intl.DateTimeFormat('en-US',{
    timeZone,year:'numeric',month:'short',day:'2-digit',hour:'numeric',minute:'2-digit',hour12:true,
    ...(includeSeconds?{second:'2-digit' as const}:{}),
  }).format(date)
}

export function formatTime(value:string,includeSeconds=false){
  const date=new Date(value)
  if(Number.isNaN(date.getTime()))return '—'
  return new Intl.DateTimeFormat('en-US',{
    timeZone,hour:'numeric',minute:'2-digit',hour12:true,
    ...(includeSeconds?{second:'2-digit' as const}:{}),
  }).format(date)
}

export function formatSensorValue(parameter:SensorParameter,value:number){
  return value.toFixed(sensorDecimals[parameter])
}

const sensorNames:Record<SensorParameter,string>={
  pH:'pH',
  turbidity:'Turbidity (cloudiness)',
  TDS:'TDS (dissolved solids)',
  temperature:'Temperature',
  flowRate:'Water flow rate',
  totalVolume:'Total water volume',
}

export function sensorLabel(parameter:SensorParameter|undefined){
  return parameter===undefined?'Not recorded':Object.hasOwn(sensorNames,parameter)?sensorNames[parameter]:parameter
}

export function formatOptionalNumber(value:number|null|undefined,decimals=2){
  return typeof value==='number'&&Number.isFinite(value)?value.toFixed(decimals):'—'
}

export function comparisonError(reference:number|null|undefined,reading:number|null|undefined){
  return reference===null||reference===undefined||reference===0||reading===null||reading===undefined?undefined:Math.abs(reading-reference)/Math.abs(reference)*100
}

export function formatPercentage(value:number){
  return `${value.toFixed(2)}%`
}

export function stageLabel(stage:SensorStage|undefined){
  return stage==='before'?'Before filtering':stage==='after'?'After filtering':'Not recorded'
}

// Keep API status values unchanged; use plain English only when displaying them.
const statusLabels:Record<string,string>={
  Acknowledged:'Pending',
  Resolved:'Resolved',
  Critical:'Urgent',
  Information:'Notice',
  Pending:'Waiting',
  'Review Needed':'Needs review',
  'Record Available':'Record saved',
  'Pending Hardware Integration':'Device setup is not complete',
  'Local Control Active':'Device control marked active',
  'Pending Confirmation':'Not confirmed',
  'Not Configured':'Not set',
  Authenticated:'Signed in',
  'All Severities':'All alert levels',
  'All Statuses':'All statuses',
}

export function formatStatusLabel(value:string){
  return Object.hasOwn(statusLabels,value)?statusLabels[value]:value
}
