export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      cron_job_logs: {
        Row: {
          created_at: string | null
          details: string | null
          error_count: number | null
          execution_time: string | null
          id: number
          job_name: string
          success_count: number | null
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          error_count?: number | null
          execution_time?: string | null
          id?: number
          job_name: string
          success_count?: number | null
        }
        Update: {
          created_at?: string | null
          details?: string | null
          error_count?: number | null
          execution_time?: string | null
          id?: number
          job_name?: string
          success_count?: number | null
        }
        Relationships: []
      }
      email_reminders: {
        Row: {
          compiled_message: string | null
          created_at: string | null
          id: string
          reminder_number: number
          scheduled_for: string
          sent_at: string | null
          status: string
          tracked_email_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          compiled_message?: string | null
          created_at?: string | null
          id?: string
          reminder_number?: number
          scheduled_for: string
          sent_at?: string | null
          status?: string
          tracked_email_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          compiled_message?: string | null
          created_at?: string | null
          id?: string
          reminder_number?: number
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          tracked_email_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_reminders_tracked_email_id_fkey"
            columns: ["tracked_email_id"]
            isOneToOne: false
            referencedRelation: "tracked_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_subscriptions: {
        Row: {
          change_types: string[]
          client_state: string
          created_at: string | null
          expiration_datetime: string
          id: string
          is_active: boolean | null
          last_renewal_at: string | null
          notification_url: string
          renewal_attempts: number | null
          resource: string
          subscription_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          change_types?: string[]
          client_state: string
          created_at?: string | null
          expiration_datetime: string
          id?: string
          is_active?: boolean | null
          last_renewal_at?: string | null
          notification_url: string
          renewal_attempts?: number | null
          resource: string
          subscription_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          change_types?: string[]
          client_state?: string
          created_at?: string | null
          expiration_datetime?: string
          id?: string
          is_active?: boolean | null
          last_renewal_at?: string | null
          notification_url?: string
          renewal_attempts?: number | null
          resource?: string
          subscription_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      microsoft_tokens: {
        Row: {
          access_token_encrypted: string
          created_at: string
          expires_at: string
          id: string
          last_refreshed_at: string | null
          refresh_attempts: number | null
          refresh_token_encrypted: string
          scope: string | null
          token_nonce: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          created_at?: string
          expires_at: string
          id?: string
          last_refreshed_at?: string | null
          refresh_attempts?: number | null
          refresh_token_encrypted: string
          scope?: string | null
          token_nonce: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_refreshed_at?: string | null
          refresh_attempts?: number | null
          refresh_token_encrypted?: string
          scope?: string | null
          token_nonce?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      received_messages: {
        Row: {
          body_preview: string | null
          conversation_id: string | null
          created_at: string | null
          from_email: string | null
          graph_message_id: string
          id: string
          internet_message_id: string | null
          processed_at: string | null
          received_at: string | null
          subject: string | null
          to_email: string | null
        }
        Insert: {
          body_preview?: string | null
          conversation_id?: string | null
          created_at?: string | null
          from_email?: string | null
          graph_message_id: string
          id?: string
          internet_message_id?: string | null
          processed_at?: string | null
          received_at?: string | null
          subject?: string | null
          to_email?: string | null
        }
        Update: {
          body_preview?: string | null
          conversation_id?: string | null
          created_at?: string | null
          from_email?: string | null
          graph_message_id?: string
          id?: string
          internet_message_id?: string | null
          processed_at?: string | null
          received_at?: string | null
          subject?: string | null
          to_email?: string | null
        }
        Relationships: []
      }
      sent_messages: {
        Row: {
          body_preview: string | null
          conversation_id: string | null
          created_at: string | null
          from_email: string | null
          graph_message_id: string
          id: string
          internet_message_id: string | null
          processed_at: string | null
          sent_at: string | null
          subject: string | null
          to_email: string | null
        }
        Insert: {
          body_preview?: string | null
          conversation_id?: string | null
          created_at?: string | null
          from_email?: string | null
          graph_message_id: string
          id?: string
          internet_message_id?: string | null
          processed_at?: string | null
          sent_at?: string | null
          subject?: string | null
          to_email?: string | null
        }
        Update: {
          body_preview?: string | null
          conversation_id?: string | null
          created_at?: string | null
          from_email?: string | null
          graph_message_id?: string
          id?: string
          internet_message_id?: string | null
          processed_at?: string | null
          sent_at?: string | null
          subject?: string | null
          to_email?: string | null
        }
        Relationships: []
      }
      tracked_emails: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          id: string
          internet_message_id: string | null
          is_self_email: boolean | null
          message_id: string
          recipient_email: string
          reply_detection_method: string | null
          reply_received_at: string | null
          sender_email: string | null
          sent_at: string
          status: Database["public"]["Enums"]["email_status"] | null
          subject: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          internet_message_id?: string | null
          is_self_email?: boolean | null
          message_id: string
          recipient_email: string
          reply_detection_method?: string | null
          reply_received_at?: string | null
          sender_email?: string | null
          sent_at: string
          status?: Database["public"]["Enums"]["email_status"] | null
          subject: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          internet_message_id?: string | null
          is_self_email?: boolean | null
          message_id?: string
          recipient_email?: string
          reply_detection_method?: string | null
          reply_received_at?: string | null
          sender_email?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["email_status"] | null
          subject?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          auth_user_id: string
          created_at: string | null
          created_by: string | null
          email: string
          emails_replied: number | null
          emails_sent: number | null
          full_name: string
          id: string
          last_activity_at: string | null
          last_login_at: string | null
          reminder_config: Json | null
          response_rate: number | null
          role: string
          status: string
          updated_at: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string | null
          created_by?: string | null
          email: string
          emails_replied?: number | null
          emails_sent?: number | null
          full_name: string
          id?: string
          last_activity_at?: string | null
          last_login_at?: string | null
          reminder_config?: Json | null
          response_rate?: number | null
          role?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string | null
          created_by?: string | null
          email?: string
          emails_replied?: number | null
          emails_sent?: number | null
          full_name?: string
          id?: string
          last_activity_at?: string | null
          last_login_at?: string | null
          reminder_config?: Json | null
          response_rate?: number | null
          role?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          change_type: string
          created_at: string | null
          error_message: string | null
          id: string
          processed: boolean | null
          processed_at: string | null
          raw_notification: Json | null
          resource_id: string | null
          retry_count: number | null
          subscription_id: string
        }
        Insert: {
          change_type: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          processed?: boolean | null
          processed_at?: string | null
          raw_notification?: Json | null
          resource_id?: string | null
          retry_count?: number | null
          subscription_id: string
        }
        Update: {
          change_type?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          processed?: boolean | null
          processed_at?: string | null
          raw_notification?: Json | null
          resource_id?: string | null
          retry_count?: number | null
          subscription_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      active_subscriptions: {
        Row: {
          created_at: string | null
          expiration_datetime: string | null
          last_renewal_at: string | null
          resource: string | null
          subscription_id: string | null
          time_until_expiry: unknown | null
        }
        Insert: {
          created_at?: string | null
          expiration_datetime?: string | null
          last_renewal_at?: string | null
          resource?: string | null
          subscription_id?: string | null
          time_until_expiry?: never
        }
        Update: {
          created_at?: string | null
          expiration_datetime?: string | null
          last_renewal_at?: string | null
          resource?: string | null
          subscription_id?: string | null
          time_until_expiry?: never
        }
        Relationships: []
      }
      email_stats: {
        Row: {
          avg_reply_time_hours: number | null
          cancelled_reminders: number | null
          emails_with_conversation_id: number | null
          expired_emails: number | null
          failed_emails: number | null
          pending_emails: number | null
          replied_emails: number | null
          scheduled_reminders: number | null
          sent_reminders: number | null
          total_emails: number | null
          total_reminders: number | null
        }
        Relationships: []
      }
      recent_cron_jobs: {
        Row: {
          details: string | null
          error_count: number | null
          execution_time: string | null
          job_name: string | null
          success_count: number | null
          success_rate: number | null
        }
        Relationships: []
      }
      recent_email_activity: {
        Row: {
          activity_at: string | null
          activity_type: string | null
          conversation_id: string | null
          email: string | null
          message_id: string | null
          other_email: string | null
          subject: string | null
        }
        Relationships: []
      }
      recent_webhook_events: {
        Row: {
          change_type: string | null
          created_at: string | null
          error_message: string | null
          processed: boolean | null
          subscription_id: string | null
        }
        Relationships: []
      }
      token_refresh_stats: {
        Row: {
          avg_refresh_attempts: number | null
          expired_tokens: number | null
          last_refresh_time: string | null
          tokens_need_refresh: number | null
          total_tokens: number | null
        }
        Relationships: []
      }
      upcoming_reminders: {
        Row: {
          hours_until_due: number | null
          id: string | null
          recipient_email: string | null
          reminder_number: number | null
          scheduled_for: string | null
          sender_name: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_email_reminders_cron: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      activate_reminder_cron_jobs: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      calculate_next_reminder_date: {
        Args: {
          p_base_date?: string
          p_reminder_number: number
          p_user_id: string
        }
        Returns: string
      }
      check_4h_delays: {
        Args: Record<PropertyKey, never>
        Returns: {
          all_using_4h: boolean
          avg_delay_hours: number
          avg_interval_hours: number
          user_count: number
        }[]
      }
      check_email_reminders_job_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          active: boolean
          job_name: string
          last_response: Json
          last_run: string
          last_status: string
          next_estimated_run: string
          schedule: string
        }[]
      }
      check_reminder_jobs_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          active: boolean
          job_name: string
          last_run: string
          last_status: string
          next_run: string
          schedule: string
        }[]
      }
      check_renewal_job_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          active: boolean
          job_name: string
          last_run: string
          last_status: string
          next_run: string
          schedule: string
        }[]
      }
      check_user_role: {
        Args: { required_role: string }
        Returns: boolean
      }
      cleanup_old_cron_logs: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      compile_reminder_template: {
        Args: {
          p_reminder_number: number
          p_tracked_email_id: string
          p_user_id: string
        }
        Returns: string
      }
      deactivate_email_reminders_cron: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      deactivate_reminder_cron_jobs: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          email: string
          emails_replied: number
          emails_sent: number
          full_name: string
          id: string
          last_login_at: string
          response_rate: number
          role: string
          status: string
        }[]
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_email_reminders_dashboard_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_test_emails_for_reminders: {
        Args: { p_test_email_ids?: string[]; p_user_id: string }
        Returns: {
          current_reminder_count: number
          days_elapsed: number
          max_reminders: number
          message_id: string
          recipient_email: string
          sent_at: string
          subject: string
          tracked_email_id: string
        }[]
      }
      get_users_with_profiles: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_role?: string
          p_status?: string
        }
        Returns: {
          auth_user_id: string
          created_at: string
          email: string
          emails_replied: number
          emails_sent: number
          full_name: string
          id: string
          last_login_at: string
          response_rate: number
          role: string
          status: string
        }[]
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_test_working_hours: {
        Args: { p_check_time?: string; p_user_id: string }
        Returns: boolean
      }
      log_received_message: {
        Args: {
          p_body_preview?: string
          p_conversation_id?: string
          p_from_email?: string
          p_graph_message_id: string
          p_internet_message_id?: string
          p_received_at?: string
          p_subject?: string
          p_to_email?: string
        }
        Returns: string
      }
      log_sent_message: {
        Args: {
          p_body_preview?: string
          p_conversation_id?: string
          p_from_email?: string
          p_graph_message_id: string
          p_internet_message_id?: string
          p_sent_at?: string
          p_subject?: string
          p_to_email?: string
        }
        Returns: string
      }
      log_tracked_email: {
        Args: {
          p_conversation_id?: string
          p_internet_message_id?: string
          p_message_id: string
          p_recipient_email: string
          p_sender_email?: string
          p_sent_at?: string
          p_subject: string
        }
        Returns: string
      }
      refresh_expired_microsoft_tokens: {
        Args: Record<PropertyKey, never>
        Returns: {
          error_message: string
          refresh_status: string
          user_id: string
        }[]
      }
      schedule_test_reminder: {
        Args: {
          p_dry_run?: boolean
          p_tracked_email_id: string
          p_user_id: string
        }
        Returns: string
      }
      test_cron_logs_rls: {
        Args: Record<PropertyKey, never>
        Returns: {
          details: string
          result: string
          test_name: string
        }[]
      }
      test_reminder_delays: {
        Args: Record<PropertyKey, never>
        Returns: {
          current_value: number
          description: string
          setting_name: string
        }[]
      }
      test_token_refresh: {
        Args: Record<PropertyKey, never>
        Returns: {
          test_result: string
          tokens_to_refresh: number
          user_count: number
        }[]
      }
      trigger_email_reminders_manually: {
        Args: { p_target_email_ids?: string[]; p_target_user_ids?: string[] }
        Returns: Json
      }
      update_user_email_stats: {
        Args: {
          p_increment_replied?: boolean
          p_increment_sent?: boolean
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      email_status: "PENDING" | "REPLIED" | "FAILED" | "EXPIRED"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      email_status: ["PENDING", "REPLIED", "FAILED", "EXPIRED"],
    },
  },
} as const
