import type { Database, Json } from './database.types'

export type AccountAuditRow = {
  id: string; actor_id: string | null; target_id: string; action: string
  old_role: string | null; new_role: string | null; old_status: string | null; new_status: string | null
  reason: string | null; created_at: string
}
// Explicit migration overlay until types can be regenerated from an approved local stack.
// Never edit the generated baseline or fetch hosted schema as part of development.
export type RbacDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Functions'> & {
    Tables: Database['public']['Tables'] & {
      account_audit: { Row: AccountAuditRow; Insert: never; Update: never; Relationships: [] }
    }
    Functions: Database['public']['Functions'] & {
      manage_account: { Args: { p_actor_id: string; p_target_id: string; p_action: string; p_value?: string | null }; Returns: Json }
      provision_super_administrator: { Args: { p_target_id: string; p_reason: string; p_authorizer_id?: string | null }; Returns: Json }
    }
  }
}
