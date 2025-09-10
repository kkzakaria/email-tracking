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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
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
      tracked_emails: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          id: string
          internet_message_id: string | null
          message_id: string
          recipient_email: string
          reply_detection_method: string | null
          reply_received_at: string | null
          sender_email: string | null
          sent_at: string
          status: Database["public"]["Enums"]["email_status"] | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          internet_message_id?: string | null
          message_id: string
          recipient_email: string
          reply_detection_method?: string | null
          reply_received_at?: string | null
          sender_email?: string | null
          sent_at: string
          status?: Database["public"]["Enums"]["email_status"] | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          internet_message_id?: string | null
          message_id?: string
          recipient_email?: string
          reply_detection_method?: string | null
          reply_received_at?: string | null
          sender_email?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["email_status"] | null
          subject?: string
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
          emails_with_conversation_id: number | null
          expired_emails: number | null
          failed_emails: number | null
          pending_emails: number | null
          replied_emails: number | null
          total_emails: number | null
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
    }
    Functions: {
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
