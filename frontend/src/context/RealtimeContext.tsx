import { createContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { apiBaseUrl, getAccessToken, subscribeAuth, getAuthState } from '../services/apiClient'
import type { DeviceStatus, SystemAlert, TelemetryRecord, TestRun } from '../types'

export type RealtimeConnectionStatus = 'connected' | 'connecting' | 'disconnected'

export interface RealtimeContextValue {
  connectionStatus: RealtimeConnectionStatus
  latestDevice: DeviceStatus | null
  activeAlertCount: number
  latestTelemetry: TelemetryRecord | null
  activeTestRun: TestRun | null
  subscribe: <T>(event: string, callback: (data: T) => void) => () => void
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>('disconnected')
  const [latestDevice, setLatestDevice] = useState<DeviceStatus | null>(null)
  const [activeAlertCount, setActiveAlertCount] = useState<number>(0)
  const [latestTelemetry, setLatestTelemetry] = useState<TelemetryRecord | null>(null)
  const [activeTestRun, setActiveTestRun] = useState<TestRun | null>(null)

  const subscribersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map())
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const alertMapRef = useRef<Map<string, SystemAlert>>(new Map())

  const subscribe = <T,>(event: string, callback: (data: T) => void): (() => void) => {
    let set = subscribersRef.current.get(event)
    if (!set) {
      set = new Set()
      subscribersRef.current.set(event, set)
    }
    set.add(callback)
    return () => {
      set?.delete(callback)
    }
  }

  const dispatchEvent = (event: string, data: any) => {
    const set = subscribersRef.current.get(event)
    if (set) {
      for (const cb of set) {
        try {
          cb(data)
        } catch (err) {
          console.error(`Error in realtime subscriber for event "${event}":`, err)
        }
      }
    }
  }

  useEffect(() => {
    let isMounted = true
    let backoffDelay = 2000

    const cleanup = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      setConnectionStatus('disconnected')
    }

    const connect = async () => {
      cleanup()
      const auth = getAuthState()
      if (auth.status !== 'authenticated' || !apiBaseUrl) {
        return
      }

      setConnectionStatus('connecting')

      let token = ''
      try {
        token = await getAccessToken()
      } catch {
        if (isMounted) scheduleReconnect()
        return
      }

      if (!isMounted) return

      const url = `${apiBaseUrl}/realtime/stream?token=${encodeURIComponent(token)}`
      const es = new EventSource(url)
      eventSourceRef.current = es

      es.onopen = () => {
        if (!isMounted) return
        setConnectionStatus('connected')
        backoffDelay = 2000
      }

      es.addEventListener('telemetry', (e) => {
        if (!isMounted) return
        try {
          const records: TelemetryRecord[] = JSON.parse(e.data)
          if (Array.isArray(records) && records.length > 0) {
            const newest = records[records.length - 1]
            if (newest) setLatestTelemetry(newest)
            dispatchEvent('telemetry', records)
          }
        } catch (err) {
          console.error('Failed to parse realtime telemetry event:', err)
        }
      })

      es.addEventListener('alert', (e) => {
        if (!isMounted) return
        try {
          const alerts: SystemAlert[] = JSON.parse(e.data)
          if (Array.isArray(alerts)) {
            for (const a of alerts) {
              alertMapRef.current.set(a.id, a)
            }
            // Recompute active alert count
            let active = 0
            for (const a of alertMapRef.current.values()) {
              if (a.status === 'Active') active++
            }
            setActiveAlertCount(active)
            dispatchEvent('alert', alerts)
          }
        } catch (err) {
          console.error('Failed to parse realtime alert event:', err)
        }
      })

      es.addEventListener('device', (e) => {
        if (!isMounted) return
        try {
          const device: DeviceStatus = JSON.parse(e.data)
          if (device && typeof device.deviceId === 'string') {
            setLatestDevice(device)
            dispatchEvent('device', device)
          }
        } catch (err) {
          console.error('Failed to parse realtime device event:', err)
        }
      })

      es.addEventListener('test_run', (e) => {
        if (!isMounted) return
        try {
          const run: TestRun = JSON.parse(e.data)
          if (run && typeof run.id === 'string') {
            setActiveTestRun(run)
            dispatchEvent('test_run', run)
          }
        } catch (err) {
          console.error('Failed to parse realtime test_run event:', err)
        }
      })

      es.onerror = () => {
        if (!isMounted) return
        cleanup()
        scheduleReconnect()
      }
    }

    const scheduleReconnect = () => {
      if (!isMounted) return
      setConnectionStatus('connecting')
      reconnectTimerRef.current = setTimeout(() => {
        if (isMounted) {
          backoffDelay = Math.min(backoffDelay * 1.5, 15000)
          void connect()
        }
      }, backoffDelay)
    }

    void connect()

    const unsubscribeAuth = subscribeAuth(() => {
      const auth = getAuthState()
      if (auth.status === 'authenticated') {
        void connect()
      } else {
        cleanup()
      }
    })

    return () => {
      isMounted = false
      unsubscribeAuth()
      cleanup()
    }
  }, [])

  return (
    <RealtimeContext.Provider
      value={{
        connectionStatus,
        latestDevice,
        activeAlertCount,
        latestTelemetry,
        activeTestRun,
        subscribe,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  )
}

export { RealtimeContext }
