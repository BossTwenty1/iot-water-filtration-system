import type { Request, Response } from 'express'

// Minimal Server-Sent Events helper. Chosen over WebSocket (see
// API_ROUTES PLAN.md's "Real-time strategy note") because it needs no new
// dependency — plain Express `res.write` is enough — and every real-time
// surface in this API (telemetry, alerts, device status) is server-to-client
// only, so SSE's one-way stream is sufficient.

export interface SseSender {
  send: (event: string, data: unknown) => void
}

export function startSseStream(req: Request, res: Response): SseSender {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders?.()

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000)

  req.on('close', () => {
    clearInterval(heartbeat)
    res.end()
  })

  return { send }
}

export interface PollAndStreamOptions<TRow extends { [key: string]: any }, TPayload = TRow[]> {
  req: Request
  res: Response
  event: string
  // Must be a column present on the *fetched rows* (TRow) — the cursor
  // advances off these, not off whatever `transform` turns them into. Keeping
  // this separate from the payload shape is what caught a real bug during
  // the TS conversion: the telemetry stream used to advance its cursor by a
  // field (`measured_at`) that only exists on the raw rows, not on the
  // grouped TelemetryRecord[] it was sending — so the cursor never moved.
  cursorField: keyof TRow & string
  intervalMs: number
  fetchLatest: (since: string) => Promise<TRow[]>
  // Optional shape conversion applied only to what's sent over the wire.
  transform?: (rows: TRow[]) => TPayload
}

// Polls `fetchLatest(sinceIso)` on an interval and pushes any new rows to the
// SSE client as `event`. `fetchLatest` must return rows with a `cursorField`
// timestamp column; the cursor advances to the max value seen.
export function pollAndStream<TRow extends { [key: string]: any }, TPayload = TRow[]>({
  req,
  res,
  event,
  cursorField,
  fetchLatest,
  intervalMs,
  transform,
}: PollAndStreamOptions<TRow, TPayload>): void {
  const { send } = startSseStream(req, res)
  let cursor = new Date().toISOString()

  const tick = async () => {
    try {
      const rows = await fetchLatest(cursor)
      if (rows?.length) {
        send(event, transform ? transform(rows) : rows)
        cursor = rows.reduce((max, row) => (String(row[cursorField]) > max ? String(row[cursorField]) : max), cursor)
      }
    } catch (err) {
      send('error', { message: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  const timer = setInterval(tick, intervalMs)
  req.on('close', () => clearInterval(timer))
}
