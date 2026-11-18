import { useCallback,useEffect,useRef,useState } from 'react'
import { getBoardTelemetry } from '../services/telemetryService'
import type { SensorStage,TelemetryRecord } from '../types'

export interface BoardTelemetry {
  records:TelemetryRecord[]
  loading:boolean
  error:string|null
}

export interface BoardTelemetryResource {
  before:BoardTelemetry
  after:BoardTelemetry
  refreshing:boolean
  refresh:()=>Promise<void>
}

export function useBoardTelemetry():BoardTelemetryResource {
  const [boards,setBoards]=useState<Record<SensorStage,BoardTelemetry>>({
    before:{records:[],loading:true,error:null},
    after:{records:[],loading:true,error:null},
  })
  const [refreshing,setRefreshing]=useState(false)
  const request=useRef<AbortController|null>(null)

  const refresh=useCallback(async()=>{
    if(request.current)return
    const controller=new AbortController()
    request.current=controller
    setRefreshing(true)
    await Promise.all((['before','after'] as const).map(async(stage)=>{
      try {
        const records=await getBoardTelemetry(stage,controller.signal)
        if(!controller.signal.aborted){
          setBoards(previous=>({...previous,[stage]:{records,loading:false,error:null}}))
        }
      } catch(cause) {
        if(!controller.signal.aborted){
          const error=cause instanceof Error?cause.message:'Unable to refresh readings.'
          // Retain the last successful cycle and its timestamp on a failed refresh.
          setBoards(previous=>({...previous,[stage]:{...previous[stage],loading:false,error}}))
        }
      }
    }))
    if(request.current===controller)request.current=null
    if(!controller.signal.aborted)setRefreshing(false)
  },[])

  useEffect(()=>{
    // Start the external board queries when this view mounts.
    // eslint-disable-next-line react/set-state-in-effect
    void refresh()
    const timer=window.setInterval(()=>void refresh(),10_000)
    return()=>{
      window.clearInterval(timer)
      request.current?.abort()
      request.current=null
    }
  },[refresh])

  return {...boards,refreshing,refresh}
}
