// Puts a pre-filtration board and a post-filtration board into one
// installation (devices.installation_id) so GET /telemetry merges their
// before/after cycles into one row. See docs/TWO_BOARD_SYNC_AND_MERGE.md.
//
// Usage (from backend/):
//   npm run pair:devices -- <pre-device-uuid> <post-device-uuid> --dry-run
//   npm run pair:devices -- <pre-device-uuid> <post-device-uuid> --apply
//   npm run pair:devices -- <device-uuid> --unpair --apply
//
// Checks that the first device only has pre_filtration sensors and the second
// only post_filtration sensors before changing anything. Writes to the
// database configured in backend/.env.

import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { supabaseAdmin } from '../src/config/supabaseClient'

async function positionsOf(deviceId: string): Promise<{ name: string; installationId: string | null; positions: Set<string> }> {
  const device = await supabaseAdmin.from('devices').select('id, name, device_identifier, installation_id').eq('id', deviceId).maybeSingle()
  if (device.error) throw new Error(`Load device failed: ${device.error.message}`)
  if (!device.data) throw new Error(`Device ${deviceId} not found.`)
  const sensors = await supabaseAdmin.from('sensors').select('position').eq('device_id', deviceId)
  if (sensors.error) throw new Error(`Load sensors failed: ${sensors.error.message}`)
  return {
    name: `${device.data.name ?? ''} (${device.data.device_identifier})`.trim(),
    installationId: device.data.installation_id,
    positions: new Set(sensors.data.map((s) => s.position)),
  }
}

async function main(args: string[]): Promise<void> {
  const apply = args.includes('--apply')
  const dryRun = args.includes('--dry-run')
  const unpair = args.includes('--unpair')
  const ids = args.filter((a) => !a.startsWith('--')).map((a) => z.string().uuid().parse(a))
  if (apply === dryRun) throw new Error('Pass exactly one of --dry-run or --apply.')

  if (unpair) {
    if (ids.length !== 1) throw new Error('--unpair takes one device uuid.')
    const info = await positionsOf(ids[0]!)
    console.log(`${info.name}: installation ${info.installationId ?? '(none)'} -> (none)`)
    if (apply) {
      const res = await supabaseAdmin.from('devices').update({ installation_id: null }).eq('id', ids[0]!)
      if (res.error) throw new Error(`Update failed: ${res.error.message}`)
      console.log('Unpaired.')
    }
    return
  }

  if (ids.length !== 2 || ids[0] === ids[1]) throw new Error('Pass two different device uuids: <pre> <post>.')
  const [preId, postId] = ids as [string, string]
  const pre = await positionsOf(preId)
  const post = await positionsOf(postId)
  if (pre.positions.size !== 1 || !pre.positions.has('pre_filtration')) throw new Error(`${pre.name} must have only pre_filtration sensors.`)
  if (post.positions.size !== 1 || !post.positions.has('post_filtration')) throw new Error(`${post.name} must have only post_filtration sensors.`)

  const installationId = pre.installationId ?? post.installationId ?? randomUUID()
  console.log(`pre : ${pre.name} (installation ${pre.installationId ?? 'none'})`)
  console.log(`post: ${post.name} (installation ${post.installationId ?? 'none'})`)
  console.log(`-> both set to installation ${installationId}`)
  if (!apply) { console.log('Dry run: nothing changed.'); return }

  const res = await supabaseAdmin.from('devices').update({ installation_id: installationId }).in('id', [preId, postId])
  if (res.error) throw new Error(`Update failed: ${res.error.message}`)
  console.log('Paired.')
}

main(process.argv.slice(2)).catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
