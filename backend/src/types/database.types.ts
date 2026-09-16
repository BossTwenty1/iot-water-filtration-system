export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alert_state_changes: {
        Row: {
          alert_id: string
          changed_at: string
          changed_by: string | null
          from_status: string | null
          id: string
          to_status: string | null
        }
        Insert: {
          alert_id: string
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          to_status?: string | null
        }
        Update: {
          alert_id?: string
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_state_changes_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_state_changes_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          category: string | null
          created_at: string
          device_id: string
          id: string
          message: string | null
          sensor_reading_id: string | null
          severity: string | null
          source: string | null
          status: string | null
          test_run_id: string | null
          title: string | null
          triggered_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          category?: string | null
          created_at?: string
          device_id: string
          id?: string
          message?: string | null
          sensor_reading_id?: string | null
          severity?: string | null
          source?: string | null
          status?: string | null
          test_run_id?: string | null
          title?: string | null
          triggered_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          category?: string | null
          created_at?: string
          device_id?: string
          id?: string
          message?: string | null
          sensor_reading_id?: string | null
          severity?: string | null
          source?: string | null
          status?: string | null
          test_run_id?: string | null
          title?: string | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_sensor_reading_id_fkey"
            columns: ["sensor_reading_id"]
            isOneToOne: false
            referencedRelation: "sensor_readings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          date_format: string | null
          device_display_name: string | null
          id: number
          notifications: Json
          system_name: string | null
          time_format: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          date_format?: string | null
          device_display_name?: string | null
          id?: number
          notifications?: Json
          system_name?: string | null
          time_format?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          date_format?: string | null
          device_display_name?: string | null
          id?: number
          notifications?: Json
          system_name?: string | null
          time_format?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      calibration_records: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          parameters: Json | null
          performed_at: string
          performed_by: string | null
          sensor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          parameters?: Json | null
          performed_at?: string
          performed_by?: string | null
          sensor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          parameters?: Json | null
          performed_at?: string
          performed_by?: string | null
          sensor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calibration_records_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calibration_records_sensor_id_fkey"
            columns: ["sensor_id"]
            isOneToOne: false
            referencedRelation: "sensors"
            referencedColumns: ["id"]
          },
        ]
      }
      data_retention_policy: {
        Row: {
          config: Json
          id: number
          retention_days: number | null
          updated_at: string
        }
        Insert: {
          config?: Json
          id?: number
          retention_days?: number | null
          updated_at?: string
        }
        Update: {
          config?: Json
          id?: number
          retention_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          config: Json
          connection_state: string
          controller_name: string | null
          created_at: string
          device_identifier: string
          fail_safe_state: string
          id: string
          is_simulated: boolean
          last_seen_at: string | null
          name: string | null
          wifi_state: string
        }
        Insert: {
          config?: Json
          connection_state?: string
          controller_name?: string | null
          created_at?: string
          device_identifier: string
          fail_safe_state?: string
          id?: string
          is_simulated?: boolean
          last_seen_at?: string | null
          name?: string | null
          wifi_state?: string
        }
        Update: {
          config?: Json
          connection_state?: string
          controller_name?: string | null
          created_at?: string
          device_identifier?: string
          fail_safe_state?: string
          id?: string
          is_simulated?: boolean
          last_seen_at?: string | null
          name?: string | null
          wifi_state?: string
        }
        Relationships: []
      }
      laboratory_validation_records: {
        Row: {
          created_at: string
          id: string
          lab_reference: string | null
          percentage_error: number | null
          results: Json | null
          sample_reference: string | null
          test_run_id: string | null
          validated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lab_reference?: string | null
          percentage_error?: number | null
          results?: Json | null
          sample_reference?: string | null
          test_run_id?: string | null
          validated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lab_reference?: string | null
          percentage_error?: number | null
          results?: Json | null
          sample_reference?: string | null
          test_run_id?: string | null
          validated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "laboratory_validation_records_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          component: string
          created_at: string
          description: string | null
          id: string
          notes: string | null
          occurred_at: string
          performed_by: string | null
          status: string | null
          type: string | null
        }
        Insert: {
          component: string
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          performed_by?: string | null
          status?: string | null
          type?: string | null
        }
        Update: {
          component?: string
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          performed_by?: string | null
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_reminders: {
        Row: {
          component: string
          created_at: string
          dismissed_at: string | null
          due_date: string | null
          id: string
          label: string
          status: string
        }
        Insert: {
          component: string
          created_at?: string
          dismissed_at?: string | null
          due_date?: string | null
          id?: string
          label: string
          status?: string
        }
        Update: {
          component?: string
          created_at?: string
          dismissed_at?: string | null
          due_date?: string | null
          id?: string
          label?: string
          status?: string
        }
        Relationships: []
      }
      notification_providers: {
        Row: {
          config: Json
          enabled: boolean
          id: string
          provider: string
          updated_at: string
        }
        Insert: {
          config?: Json
          enabled?: boolean
          id?: string
          provider: string
          updated_at?: string
        }
        Update: {
          config?: Json
          enabled?: boolean
          id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          status?: string
        }
        Relationships: []
      }
      sensor_readings: {
        Row: {
          calibration_id: string | null
          created_at: string
          device_id: string
          id: string
          measured_at: string
          reading_status: string | null
          received_at: string
          sensor_id: string
          test_run_id: string | null
          value: number | null
        }
        Insert: {
          calibration_id?: string | null
          created_at?: string
          device_id: string
          id?: string
          measured_at: string
          reading_status?: string | null
          received_at?: string
          sensor_id: string
          test_run_id?: string | null
          value?: number | null
        }
        Update: {
          calibration_id?: string | null
          created_at?: string
          device_id?: string
          id?: string
          measured_at?: string
          reading_status?: string | null
          received_at?: string
          sensor_id?: string
          test_run_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sensor_readings_calibration_id_fkey"
            columns: ["calibration_id"]
            isOneToOne: false
            referencedRelation: "calibration_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_readings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_readings_sensor_id_fkey"
            columns: ["sensor_id"]
            isOneToOne: false
            referencedRelation: "sensors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensor_readings_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sensors: {
        Row: {
          category: string
          created_at: string
          device_id: string
          id: string
          position: string
          unit: string | null
        }
        Insert: {
          category: string
          created_at?: string
          device_id: string
          id?: string
          position: string
          unit?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          device_id?: string
          id?: string
          position?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sensors_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      test_runs: {
        Row: {
          created_at: string
          device_id: string
          ended_at: string | null
          id: string
          notes: string | null
          started_at: string
          status: string | null
          target_volume_liters: number | null
        }
        Insert: {
          created_at?: string
          device_id: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          status?: string | null
          target_volume_liters?: number | null
        }
        Update: {
          created_at?: string
          device_id?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          status?: string | null
          target_volume_liters?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "test_runs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      thresholds: {
        Row: {
          config: Json
          id: string
          parameter: string
          stage: string
          updated_at: string
        }
        Insert: {
          config?: Json
          id?: string
          parameter: string
          stage?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          id?: string
          parameter?: string
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

