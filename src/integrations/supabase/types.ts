export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      waitlist: {
        Row: {
          id: number
          name: string
          email: string
          phone: string | null
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          email: string
          phone?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          email?: string
          phone?: string | null
          created_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          email: string
          whatsapp_number: string | null
          conversation_id: string | null
          name: string | null
          whatsapp_synced: boolean
          whatsapp_sync_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          whatsapp_number?: string | null
          conversation_id?: string | null
          name?: string | null
          whatsapp_synced?: boolean
          whatsapp_sync_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          whatsapp_number?: string | null
          conversation_id?: string | null
          name?: string | null
          whatsapp_synced?: boolean
          whatsapp_sync_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      bets: {
        Row: {
          id: string
          user_id: string
          bet_type: string
          sport: string
          league: string | null
          match_description: string | null
          bet_description: string
          odds: number
          stake_amount: number
          potential_return: number
          status: string
          bet_date: string
          match_date: string | null
          created_at: string
          updated_at: string
          raw_input: string | null
          processed_data: any | null
        }
        Insert: {
          id?: string
          user_id: string
          bet_type: string
          sport: string
          league?: string | null
          match_description?: string | null
          bet_description: string
          odds: number
          stake_amount: number
          potential_return: number
          status?: string
          bet_date: string
          match_date?: string | null
          created_at?: string
          updated_at?: string
          raw_input?: string | null
          processed_data?: any | null
        }
        Update: {
          id?: string
          user_id?: string
          bet_type?: string
          sport?: string
          league?: string | null
          match_description?: string | null
          bet_description?: string
          odds?: number
          stake_amount?: number
          potential_return?: number
          status?: string
          bet_date?: string
          match_date?: string | null
          created_at?: string
          updated_at?: string
          raw_input?: string | null
          processed_data?: any | null
        }
        Relationships: [
          {
            foreignKeyName: "bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      bet_legs: {
        Row: {
          id: string
          bet_id: string
          leg_number: number
          sport: string
          match_description: string
          bet_description: string
          odds: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          bet_id: string
          leg_number: number
          sport: string
          match_description: string
          bet_description: string
          odds: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          bet_id?: string
          leg_number?: number
          sport?: string
          match_description?: string
          bet_description?: string
          odds?: number
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bet_legs_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          }
        ]
      }
      message_queue: {
        Row: {
          id: string
          user_id: string
          message_type: string
          content: string | null
          media_url: string | null
          status: string
          processing_attempts: number
          error_message: string | null
          created_at: string
          processed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          message_type: string
          content?: string | null
          media_url?: string | null
          status?: string
          processing_attempts?: number
          error_message?: string | null
          created_at?: string
          processed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          message_type?: string
          content?: string | null
          media_url?: string | null
          status?: string
          processing_attempts?: number
          error_message?: string | null
          created_at?: string
          processed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
    Enums: {},
  },
} as const
