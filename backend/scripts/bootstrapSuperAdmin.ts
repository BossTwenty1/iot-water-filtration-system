import { z } from 'zod'
import { supabaseAdmin } from '../src/config/supabaseClient'

export async function bootstrapSuperAdmin(args: string[]) {
  if (args.includes('--help')) {
    console.log('Usage: ts-node scripts/bootstrapSuperAdmin.ts --email <designated-email> --reason <approval-reason> (--dry-run | --apply) [--authorizer <active-super-admin-uuid>]')
    return
  }
  const flags = new Map<string, string>()
  for (let i = 0; i < args.length; i++) {
    const key = args[i]!
    if (flags.has(key) || !['--email','--reason','--authorizer','--dry-run','--apply'].includes(key)) throw new Error('Invalid or duplicate options. Use --help.')
    if (['--apply','--dry-run'].includes(key)) flags.set(key, 'true')
    else {
      const value = args[++i]
      if (!value || value.startsWith('--')) throw new Error('Missing option value.')
      flags.set(key, value)
    }
  }
  if (flags.has('--apply') === flags.has('--dry-run')) throw new Error('Select exactly one of --dry-run or --apply.')
  const email = z.string().email().parse(flags.get('--email')).toLowerCase()
  const reason = z.string().trim().min(8).max(500).parse(flags.get('--reason'))
  const authorizer = flags.has('--authorizer') ? z.string().uuid().parse(flags.get('--authorizer')) : null
  const { data: profiles, error } = await supabaseAdmin.from('profiles').select('id,email,role,status').ilike('email', email.replace(/[\\%_]/g, '\\$&'))
  if (error || profiles?.length !== 1) throw new Error('Designated profile could not be uniquely verified.')
  const target = profiles[0]!
  const { data: auth, error: authError } = await supabaseAdmin.auth.admin.getUserById(target.id)
  if (authError || auth.user?.email?.toLowerCase() !== email || !auth.user.email_confirmed_at) throw new Error('Confirmed Auth identity could not be verified.')
  if (flags.has('--dry-run')) { console.log('Designated identity verified. No account changed. Database provisioning guards are checked only on --apply.'); return }
  const { error: provisionError } = await supabaseAdmin.rpc('provision_super_administrator', { p_target_id: target.id, p_reason: reason, p_authorizer_id: authorizer })
  if (provisionError) throw new Error('Provisioning denied or unavailable. Review migration, designation and authorizer privately; no success is claimed.')
  console.log('Designated Super Administrator provisioning confirmed. No password or credential was changed.')
}
if (require.main === module) void bootstrapSuperAdmin(process.argv.slice(2)).catch(() => { console.error('Super Administrator provisioning failed. Use --help and review the private configuration, explicit designation and database guards.'); process.exitCode = 1 })
