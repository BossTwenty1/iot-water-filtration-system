import { useContext, useEffect, useRef } from 'react'
import { RealtimeContext, type RealtimeContextValue } from '../context/RealtimeContext'

export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext)
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider')
  }
  return context
}

export function useRealtimeEvent<T>(event: string, callback: (data: T) => void): void {
  const { subscribe } = useRealtime()
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    const unsubscribe = subscribe<T>(event, (data) => {
      savedCallback.current(data)
    })
    return unsubscribe
  }, [event, subscribe])
}
