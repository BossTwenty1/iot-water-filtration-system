import type { SensorParameter,SensorStage } from '../types'

const sensorDecimals:Record<SensorParameter,number>={
  pH:2,
  turbidity:2,
  TDS:0,
  temperature:1,
  flowRate:1,
  totalVolume:2,
}

export function formatDateTime(value:string){
  return new Intl.DateTimeFormat('en-CA',{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Manila'}).format(new Date(value))
}

export function formatSensorValue(parameter:SensorParameter,value:number){
  return value.toFixed(sensorDecimals[parameter])
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
  return stage==='before'?'Before Filtration':stage==='after'?'After Filtration':'Not recorded'
}
