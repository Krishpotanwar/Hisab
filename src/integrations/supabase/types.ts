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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      expense_splits: {
        Row: {
          amount: number
          expense_id: string
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          expense_id: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          expense_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          currency: string
          created_at: string
          date: string
          description: string
          group_id: string
          id: string
          is_recurring: boolean
          notes: string | null
          paid_by: string
          recurring_interval: string | null
          split_type: "equal" | "shares" | "exact"
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string
          currency?: string
          created_at?: string
          date?: string
          description: string
          group_id: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          paid_by: string
          recurring_interval?: string | null
          split_type?: "equal" | "shares" | "exact"
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          currency?: string
          created_at?: string
          date?: string
          description?: string
          group_id?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          paid_by?: string
          recurring_interval?: string | null
          split_type?: "equal" | "shares" | "exact"
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          icon: string | null
          id: string
          currency: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          icon?: string | null
          id?: string
          currency?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          icon?: string | null
          id?: string
          currency?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          id: string
          expense_id: string | null
          image_url: string
          ocr_text: string | null
          total_amount: number | null
          currency: string | null
          status: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          expense_id?: string | null
          image_url: string
          ocr_text?: string | null
          total_amount?: number | null
          currency?: string | null
          status?: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          expense_id?: string | null
          image_url?: string
          ocr_text?: string | null
          total_amount?: number | null
          currency?: string | null
          status?: string
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          id: string
          amount: number
          from_user: string
          group_id: string
          notes: string | null
          settled_at: string
          to_user: string
        }
        Insert: {
          id?: string
          amount: number
          from_user: string
          group_id: string
          notes?: string | null
          settled_at?: string
          to_user: string
        }
        Update: {
          id?: string
          amount?: number
          from_user?: string
          group_id?: string
          notes?: string | null
          settled_at?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_comments: {
        Row: {
          id: string
          expense_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          expense_id: string
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          expense_id?: string
          user_id?: string
          content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_comments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          id: string
          group_id: string
          user_id: string
          expense_id: string | null
          settlement_id: string | null
          event_type: string
          data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          user_id: string
          expense_id?: string | null
          settlement_id?: string | null
          event_type: string
          data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string
          expense_id?: string | null
          settlement_id?: string | null
          event_type?: string
          data?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_orders: {
        Row: {
          id: string
          group_id: string
          payer_user_id: string
          payee_user_id: string
          provider: string
          provider_order_id: string
          amount: number
          currency: string
          status: string
          notes: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          payer_user_id: string
          payee_user_id: string
          provider?: string
          provider_order_id: string
          amount: number
          currency?: string
          status?: string
          notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          payer_user_id?: string
          payee_user_id?: string
          provider?: string
          provider_order_id?: string
          amount?: number
          currency?: string
          status?: string
          notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_orders_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          id: string
          payment_order_id: string
          provider_payment_id: string
          status: string
          raw_response: Json
          created_at: string
        }
        Insert: {
          id?: string
          payment_order_id: string
          provider_payment_id: string
          status: string
          raw_response?: Json
          created_at?: string
        }
        Update: {
          id?: string
          payment_order_id?: string
          provider_payment_id?: string
          status?: string
          raw_response?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          id: string
          provider_event_id: string
          event_type: string
          payload: Json
          processed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          provider_event_id: string
          event_type: string
          payload: Json
          processed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          provider_event_id?: string
          event_type?: string
          payload?: Json
          processed?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      group_has_member: {
        Args: { group_id: string; user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { group_id: string }
        Returns: boolean
      }
      user_is_group_creator: {
        Args: { group_id: string }
        Returns: boolean
      }
      user_is_group_member: {
        Args: { group_id: string }
        Returns: boolean
      }
    }
    Enums: {
      expense_split_type: "equal" | "shares" | "exact"
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
      expense_split_type: ["equal", "shares", "exact"],
    },
  },
} as const
