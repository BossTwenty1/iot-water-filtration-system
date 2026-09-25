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

export function formatPercentage(value:number){
  return `${value.toFixed(2)}%`
}

export function stageLabel(stage:SensorStage){
  return stage==='before'?'Before Filtration':'After Filtration'
}
