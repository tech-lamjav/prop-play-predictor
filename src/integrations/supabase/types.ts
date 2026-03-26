export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  bigquery: {
    Tables: {
      [_ in never]: never
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
      bet_legs: {
        Row: {
          bet_description: string
          bet_id: string | null
          created_at: string | null
          id: string
          leg_number: number
          match_description: string
          odds: number
          sport: string
          status: string | null
        }
        Insert: {
          bet_description: string
          bet_id?: string | null
          created_at?: string | null
          id?: string
          leg_number: number
          match_description: string
          odds: number
          sport: string
          status?: string | null
        }
        Update: {
          bet_description?: string
          bet_id?: string | null
          created_at?: string | null
          id?: string
          leg_number?: number
          match_description?: string
          odds?: number
          sport?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bet_legs_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
        ]
      }
      bet_tags: {
        Row: {
          bet_id: string
          created_at: string | null
          id: string
          tag_id: string
        }
        Insert: {
          bet_id: string
          created_at?: string | null
          id?: string
          tag_id: string
        }
        Update: {
          bet_id?: string
          created_at?: string | null
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bet_tags_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      bets: {
        Row: {
          bet_date: string
          bet_description: string
          bet_type: string
          betting_house: string | null
          betting_market: string | null
          cashout_amount: number | null
          cashout_date: string | null
          cashout_odds: number | null
          channel: string | null
          created_at: string | null
          id: string
          is_cashout: boolean | null
          league: string | null
          match_date: string | null
          match_description: string | null
          odds: number
          potential_return: number
          processed_data: Json | null
          raw_input: string | null
          sport: string
          stake_amount: number
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          bet_date: string
          bet_description: string
          bet_type: string
          betting_house?: string | null
          betting_market?: string | null
          cashout_amount?: number | null
          cashout_date?: string | null
          cashout_odds?: number | null
          channel?: string | null
          created_at?: string | null
          id?: string
          is_cashout?: boolean | null
          league?: string | null
          match_date?: string | null
          match_description?: string | null
          odds: number
          potential_return: number
          processed_data?: Json | null
          raw_input?: string | null
          sport: string
          stake_amount: number
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          bet_date?: string
          bet_description?: string
          bet_type?: string
          betting_house?: string | null
          betting_market?: string | null
          cashout_amount?: number | null
          cashout_date?: string | null
          cashout_odds?: number | null
          channel?: string | null
          created_at?: string | null
          id?: string
          is_cashout?: boolean | null
          league?: string | null
          match_date?: string | null
          match_description?: string | null
          odds?: number
          potential_return?: number
          processed_data?: Json | null
          raw_input?: string | null
          sport?: string
          stake_amount?: number
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_movements: {
        Row: {
          affects_balance: boolean
          amount: number
          created_at: string | null
          description: string | null
          id: string
          movement_date: string
          source: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          affects_balance?: boolean
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          movement_date?: string
          source?: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          affects_balance?: boolean
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          movement_date?: string
          source?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capital_movements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_queue: {
        Row: {
          channel: string | null
          content: string | null
          created_at: string | null
          error_message: string | null
          id: string
          media_url: string | null
          message_type: string
          processed_at: string | null
          processing_attempts: number | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          content?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_type: string
          processed_at?: string | null
          processing_attempts?: number | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          content?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          processed_at?: string | null
          processing_attempts?: number | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_semanal: {
        Row: {
          apostas_pendentes: number
          breakdown_por_esporte: Json | null
          cashout: number
          created_at: string | null
          ganhos: number
          id: string
          lucro_liquido: number
          mensagem_whatsapp: string
          perdas: number
          semana_fim: string
          semana_inicio: string
          total_apostas: number
          updated_at: string | null
          user_email: string | null
          user_id: string
          user_name: string | null
          user_whatsapp_number: string | null
          valor_apostado: number
        }
        Insert: {
          apostas_pendentes?: number
          breakdown_por_esporte?: Json | null
          cashout?: number
          created_at?: string | null
          ganhos?: number
          id?: string
          lucro_liquido?: number
          mensagem_whatsapp: string
          perdas?: number
          semana_fim: string
          semana_inicio: string
          total_apostas?: number
          updated_at?: string | null
          user_email?: string | null
          user_id: string
          user_name?: string | null
          user_whatsapp_number?: string | null
          valor_apostado?: number
        }
        Update: {
          apostas_pendentes?: number
          breakdown_por_esporte?: Json | null
          cashout?: number
          created_at?: string | null
          ganhos?: number
          id?: string
          lucro_liquido?: number
          mensagem_whatsapp?: string
          perdas?: number
          semana_fim?: string
          semana_inicio?: string
          total_apostas?: number
          updated_at?: string | null
          user_email?: string | null
          user_id?: string
          user_name?: string | null
          user_whatsapp_number?: string | null
          valor_apostado?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_semanal_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string | null
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          created_at: string | null
          expires_at: string | null
          filters_snapshot: Json
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          filters_snapshot: Json
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          filters_snapshot?: Json
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          analytics_subscription_cancel_at: string | null
          analytics_subscription_cancel_at_period_end: boolean | null
          analytics_subscription_period_end: string | null
          analytics_subscription_status: string | null
          bank_amount: number | null
          betinho_subscription_cancel_at: string | null
          betinho_subscription_cancel_at_period_end: boolean | null
          betinho_subscription_period_end: string | null
          betinho_subscription_status: string | null
          conversation_id: string | null
          created_at: string | null
          email: string
          has_report_access: boolean | null
          id: string
          name: string | null
          referral_code: string | null
          referred_by: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_cancel_at: string | null
          subscription_cancel_at_period_end: boolean | null
          subscription_period_end: string | null
          subscription_product_type: string | null
          subscription_status: string | null
          telegram_chat_id: string | null
          telegram_phone: string | null
          telegram_sync_source: string | null
          telegram_synced: boolean | null
          telegram_synced_at: string | null
          telegram_user_id: string | null
          telegram_username: string | null
          unit_calculation_method: string | null
          unit_value: number | null
          updated_at: string | null
          whatsapp_number: string | null
          whatsapp_sync_token: string | null
          whatsapp_synced: boolean | null
        }
        Insert: {
          analytics_subscription_cancel_at?: string | null
          analytics_subscription_cancel_at_period_end?: boolean | null
          analytics_subscription_period_end?: string | null
          analytics_subscription_status?: string | null
          bank_amount?: number | null
          betinho_subscription_cancel_at?: string | null
          betinho_subscription_cancel_at_period_end?: boolean | null
          betinho_subscription_period_end?: string | null
          betinho_subscription_status?: string | null
          conversation_id?: string | null
          created_at?: string | null
          email: string
          has_report_access?: boolean | null
          id?: string
          name?: string | null
          referral_code?: string | null
          referred_by?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_cancel_at?: string | null
          subscription_cancel_at_period_end?: boolean | null
          subscription_period_end?: string | null
          subscription_product_type?: string | null
          subscription_status?: string | null
          telegram_chat_id?: string | null
          telegram_phone?: string | null
          telegram_sync_source?: string | null
          telegram_synced?: boolean | null
          telegram_synced_at?: string | null
          telegram_user_id?: string | null
          telegram_username?: string | null
          unit_calculation_method?: string | null
          unit_value?: number | null
          updated_at?: string | null
          whatsapp_number?: string | null
          whatsapp_sync_token?: string | null
          whatsapp_synced?: boolean | null
        }
        Update: {
          analytics_subscription_cancel_at?: string | null
          analytics_subscription_cancel_at_period_end?: boolean | null
          analytics_subscription_period_end?: string | null
          analytics_subscription_status?: string | null
          bank_amount?: number | null
          betinho_subscription_cancel_at?: string | null
          betinho_subscription_cancel_at_period_end?: boolean | null
          betinho_subscription_period_end?: string | null
          betinho_subscription_status?: string | null
          conversation_id?: string | null
          created_at?: string | null
          email?: string
          has_report_access?: boolean | null
          id?: string
          name?: string | null
          referral_code?: string | null
          referred_by?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_cancel_at?: string | null
          subscription_cancel_at_period_end?: boolean | null
          subscription_period_end?: string | null
          subscription_product_type?: string | null
          subscription_status?: string | null
          telegram_chat_id?: string | null
          telegram_phone?: string | null
          telegram_sync_source?: string | null
          telegram_synced?: boolean | null
          telegram_synced_at?: string | null
          telegram_user_id?: string | null
          telegram_username?: string | null
          unit_calculation_method?: string | null
          unit_value?: number | null
          updated_at?: string | null
          whatsapp_number?: string | null
          whatsapp_sync_token?: string | null
          whatsapp_synced?: boolean | null
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: number
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: number
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: number
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      weekly_performance: {
        Row: {
          created_at: string | null
          id: string
          net_profit: number
          sport_breakdown: Json | null
          total_bets: number
          total_cashout: number
          total_lost: number
          total_pending: number
          total_staked: number
          total_won: number
          updated_at: string | null
          user_email: string | null
          user_id: string
          user_name: string | null
          user_whatsapp_number: string | null
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          net_profit?: number
          sport_breakdown?: Json | null
          total_bets?: number
          total_cashout?: number
          total_lost?: number
          total_pending?: number
          total_staked?: number
          total_won?: number
          updated_at?: string | null
          user_email?: string | null
          user_id: string
          user_name?: string | null
          user_whatsapp_number?: string | null
          week_end_date: string
          week_start_date: string
        }
        Update: {
          created_at?: string | null
          id?: string
          net_profit?: number
          sport_breakdown?: Json | null
          total_bets?: number
          total_cashout?: number
          total_lost?: number
          total_pending?: number
          total_staked?: number
          total_won?: number
          updated_at?: string | null
          user_email?: string | null
          user_id?: string
          user_name?: string | null
          user_whatsapp_number?: string | null
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_performance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_message_to_queue: {
        Args: {
          p_content?: string
          p_media_url?: string
          p_message_type: string
          p_user_id: string
        }
        Returns: string
      }
      add_tag_to_bet: {
        Args: { p_bet_id: string; p_tag_id: string }
        Returns: boolean
      }
      calcular_performance_semanal: {
        Args: { p_semana_inicio?: string }
        Returns: undefined
      }
      calculate_weekly_performance: {
        Args: { p_week_start_date?: string }
        Returns: undefined
      }
      create_referral: {
        Args: {
          p_referral_code: string
          p_referred_id: string
          p_referrer_id: string
        }
        Returns: boolean
      }
      format_currency: { Args: { value: number }; Returns: string }
      format_date_br: { Args: { date_value: string }; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      generate_whatsapp_message: {
        Args: {
          p_apostas_pendentes: number
          p_cashout: number
          p_ganhos: number
          p_lucro_liquido: number
          p_perdas: number
          p_semana_fim: string
          p_semana_inicio: string
          p_total_apostas: number
          p_user_name: string
          p_valor_apostado: number
        }
        Returns: string
      }
      generate_whatsapp_sync_token: { Args: never; Returns: string }
      get_all_players: {
        Args: never
        Returns: {
          age: number
          current_status: string
          last_game_text: string
          player_id: number
          player_name: string
          position: string
          rating_stars: number
          team_abbreviation: string
          team_id: number
          team_name: string
        }[]
      }
      get_bet_tags: {
        Args: { p_bet_id: string }
        Returns: {
          color: string
          id: string
          name: string
        }[]
      }
      get_games: {
        Args: { p_game_date?: string; p_team_abbreviation?: string }
        Returns: {
          game_date: string
          game_datetime_brasilia: string
          game_id: number
          home_team_abbreviation: string
          home_team_id: number
          home_team_is_b2b_game: boolean
          home_team_is_next_game: boolean
          home_team_name: string
          home_team_score: number
          loaded_at: string
          visitor_team_abbreviation: string
          visitor_team_id: number
          visitor_team_is_b2b_game: boolean
          visitor_team_is_next_game: boolean
          visitor_team_name: string
          visitor_team_score: number
          winner_team_id: number
        }[]
      }
      get_pending_messages: {
        Args: { limit_count?: number }
        Returns: {
          content: string
          created_at: string
          id: string
          media_url: string
          message_type: string
          user_id: string
        }[]
      }
      get_player_by_id: {
        Args: { p_player_id: number }
        Returns: {
          age: number
          current_status: string
          last_game_text: string
          player_id: number
          player_name: string
          position: string
          team_abbreviation: string
          team_id: number
          team_name: string
        }[]
      }
      get_player_by_name: {
        Args: { p_player_name: string }
        Returns: {
          age: number
          current_status: string
          last_game_text: string
          player_id: number
          player_name: string
          position: string
          rating_stars: number
          team_abbreviation: string
          team_id: number
          team_name: string
        }[]
      }
      get_player_dashboard_bundle: {
        Args: { p_games_limit?: number; p_player_id: number }
        Returns: Json
      }
      get_player_game_stats: {
        Args: { p_limit?: number; p_player_id: number }
        Returns: {
          game_date: string
          game_id: number
          home_away: string
          is_b2b_game: boolean
          is_played: string
          line: number
          played_against: string
          player_id: number
          stat_type: string
          stat_value: number
          stat_vs_line: string
        }[]
      }
      get_player_props: {
        Args: { p_player_id: number }
        Returns: {
          is_available_backup: boolean
          is_leader_with_injury: boolean
          loaded_at: string
          next_available_player_name: string
          next_player_stats_normal: number
          next_player_stats_when_leader_out: number
          player_id: number
          rating_stars: number
          stat_rank: number
          stat_type: string
          team_id: number
        }[]
      }
      get_player_shooting_zones: {
        Args: { p_player_id: number }
        Returns: {
          above_the_break_3_fg_pct: number
          above_the_break_3_fga: number
          above_the_break_3_fgm: number
          backcourt_fg_pct: number
          backcourt_fga: number
          backcourt_fgm: number
          corner_3_fg_pct: number
          corner_3_fga: number
          corner_3_fgm: number
          in_the_paint_non_ra_fg_pct: number
          in_the_paint_non_ra_fga: number
          in_the_paint_non_ra_fgm: number
          left_corner_3_fg_pct: number
          left_corner_3_fga: number
          left_corner_3_fgm: number
          loaded_at: string
          mid_range_fg_pct: number
          mid_range_fga: number
          mid_range_fgm: number
          player_id: number
          player_name: string
          restricted_area_fg_pct: number
          restricted_area_fga: number
          restricted_area_fgm: number
          right_corner_3_fg_pct: number
          right_corner_3_fga: number
          right_corner_3_fgm: number
        }[]
      }
      get_referral_count: { Args: { p_user_id: string }; Returns: number }
      get_referred_users: {
        Args: { p_user_referral_code: string }
        Returns: {
          created_at: string
          referral_code: string
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_team_by_id: {
        Args: { p_team_id: number }
        Returns: {
          conference: string
          conference_rank: number
          is_next_game_home: boolean
          loaded_at: string
          losses: number
          next_game_injury_report_time_brasilia: string
          next_opponent_abbreviation: string
          next_opponent_conference_rank: number
          next_opponent_id: number
          next_opponent_name: string
          next_opponent_team_defensive_rating_rank: number
          next_opponent_team_last_five_games: string
          next_opponent_team_offensive_rating_rank: number
          next_opponent_team_rating_rank: number
          season: number
          team_abbreviation: string
          team_city: string
          team_defensive_rating_rank: number
          team_id: number
          team_injury_report_time_brasilia: string
          team_last_five_games: string
          team_name: string
          team_offensive_rating_rank: number
          team_rating_rank: number
          wins: number
        }[]
      }
      get_team_players: {
        Args: { p_team_id: number }
        Returns: {
          age: number
          current_status: string
          player_id: number
          player_name: string
          position: string
          rating_stars: number
          team_id: number
        }[]
      }
      get_user_referrals: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          referral_code: string
          referred_email: string
          referred_id: string
          referred_name: string
        }[]
      }
      get_user_referrals_from_users: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          referral_code: string
          referred_email: string
          referred_id: string
          referred_name: string
        }[]
      }
      remove_tag_from_bet: {
        Args: { p_bet_id: string; p_tag_id: string }
        Returns: boolean
      }
      setup_weekly_performance_cron: { Args: never; Returns: undefined }
      sync_whatsapp: {
        Args: {
          conversation_id: string
          user_id: string
          whatsapp_number: string
        }
        Returns: boolean
      }
      update_message_status: {
        Args: {
          p_error_message?: string
          p_message_id: string
          p_status: string
        }
        Returns: boolean
      }
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
  bigquery: {
    Enums: {},
  },
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

