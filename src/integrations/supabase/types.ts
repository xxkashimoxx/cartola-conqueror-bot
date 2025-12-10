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
      atleta_pontuacoes: {
        Row: {
          atleta_id: number | null
          created_at: string | null
          id: number
          pontos: number
          preco: number | null
          rodada: number
        }
        Insert: {
          atleta_id?: number | null
          created_at?: string | null
          id?: number
          pontos: number
          preco?: number | null
          rodada: number
        }
        Update: {
          atleta_id?: number | null
          created_at?: string | null
          id?: number
          pontos?: number
          preco?: number | null
          rodada?: number
        }
        Relationships: [
          {
            foreignKeyName: "atleta_pontuacoes_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atletas"
            referencedColumns: ["id"]
          },
        ]
      }
      atletas: {
        Row: {
          apelido: string
          clube_id: number | null
          created_at: string | null
          foto_url: string | null
          id: number
          jogos: number | null
          media: number | null
          nome: string
          pontos_num: number | null
          posicao_id: number | null
          preco: number | null
          status_id: number | null
          updated_at: string | null
          variacao_preco: number | null
        }
        Insert: {
          apelido: string
          clube_id?: number | null
          created_at?: string | null
          foto_url?: string | null
          id: number
          jogos?: number | null
          media?: number | null
          nome: string
          pontos_num?: number | null
          posicao_id?: number | null
          preco?: number | null
          status_id?: number | null
          updated_at?: string | null
          variacao_preco?: number | null
        }
        Update: {
          apelido?: string
          clube_id?: number | null
          created_at?: string | null
          foto_url?: string | null
          id?: number
          jogos?: number | null
          media?: number | null
          nome?: string
          pontos_num?: number | null
          posicao_id?: number | null
          preco?: number | null
          status_id?: number | null
          updated_at?: string | null
          variacao_preco?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "atletas_clube_id_fkey"
            columns: ["clube_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atletas_posicao_id_fkey"
            columns: ["posicao_id"]
            isOneToOne: false
            referencedRelation: "posicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ausencias: {
        Row: {
          atleta_id: number | null
          created_at: string
          id: string
          nota: string | null
          probabilidade: number | null
          rodada: number
          tipo: string
        }
        Insert: {
          atleta_id?: number | null
          created_at?: string
          id?: string
          nota?: string | null
          probabilidade?: number | null
          rodada: number
          tipo: string
        }
        Update: {
          atleta_id?: number | null
          created_at?: string
          id?: string
          nota?: string | null
          probabilidade?: number | null
          rodada?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ausencias_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atletas"
            referencedColumns: ["id"]
          },
        ]
      }
      clubes: {
        Row: {
          abreviacao: string
          created_at: string | null
          escudo_url: string | null
          id: number
          nome: string
          updated_at: string | null
        }
        Insert: {
          abreviacao: string
          created_at?: string | null
          escudo_url?: string | null
          id: number
          nome: string
          updated_at?: string | null
        }
        Update: {
          abreviacao?: string
          created_at?: string | null
          escudo_url?: string | null
          id?: number
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      mercado_status: {
        Row: {
          abertura: string | null
          created_at: string | null
          fechamento: string | null
          id: number
          rodada_atual: number
          status_mercado: number
        }
        Insert: {
          abertura?: string | null
          created_at?: string | null
          fechamento?: string | null
          id?: number
          rodada_atual: number
          status_mercado: number
        }
        Update: {
          abertura?: string | null
          created_at?: string | null
          fechamento?: string | null
          id?: number
          rodada_atual?: number
          status_mercado?: number
        }
        Relationships: []
      }
      oportunidades: {
        Row: {
          atleta_id: number | null
          created_at: string
          id: string
          nota: string | null
          rodada: number
          score: number | null
          tipo: string
        }
        Insert: {
          atleta_id?: number | null
          created_at?: string
          id?: string
          nota?: string | null
          rodada: number
          score?: number | null
          tipo: string
        }
        Update: {
          atleta_id?: number | null
          created_at?: string
          id?: string
          nota?: string | null
          rodada?: number
          score?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "oportunidades_atleta_id_fkey"
            columns: ["atleta_id"]
            isOneToOne: false
            referencedRelation: "atletas"
            referencedColumns: ["id"]
          },
        ]
      }
      partidas: {
        Row: {
          clean_sheet_casa: number | null
          clean_sheet_fora: number | null
          created_at: string
          data_partida: string | null
          id: string
          rodada: number
          time_casa_id: number | null
          time_fora_id: number | null
          updated_at: string
          xg_casa: number | null
          xg_fora: number | null
        }
        Insert: {
          clean_sheet_casa?: number | null
          clean_sheet_fora?: number | null
          created_at?: string
          data_partida?: string | null
          id?: string
          rodada: number
          time_casa_id?: number | null
          time_fora_id?: number | null
          updated_at?: string
          xg_casa?: number | null
          xg_fora?: number | null
        }
        Update: {
          clean_sheet_casa?: number | null
          clean_sheet_fora?: number | null
          created_at?: string
          data_partida?: string | null
          id?: string
          rodada?: number
          time_casa_id?: number | null
          time_fora_id?: number | null
          updated_at?: string
          xg_casa?: number | null
          xg_fora?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "partidas_time_casa_id_fkey"
            columns: ["time_casa_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidas_time_fora_id_fkey"
            columns: ["time_fora_id"]
            isOneToOne: false
            referencedRelation: "clubes"
            referencedColumns: ["id"]
          },
        ]
      }
      posicoes: {
        Row: {
          abreviacao: string
          id: number
          nome: string
        }
        Insert: {
          abreviacao: string
          id: number
          nome: string
        }
        Update: {
          abreviacao?: string
          id?: number
          nome?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          plan: Database["public"]["Enums"]["user_plan"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          plan?: Database["public"]["Enums"]["user_plan"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          plan?: Database["public"]["Enums"]["user_plan"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_analytics: {
        Row: {
          error_message: string | null
          id: string
          records_synced: number | null
          success: boolean | null
          sync_type: string
          synced_at: string
          synced_by: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          records_synced?: number | null
          success?: boolean | null
          sync_type: string
          synced_at?: string
          synced_by?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          records_synced?: number | null
          success?: boolean | null
          sync_type?: string
          synced_at?: string
          synced_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      user_plan: "FREE" | "PRO" | "PREMIUM" | "MASTER"
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
      app_role: ["admin", "user"],
      user_plan: ["FREE", "PRO", "PREMIUM", "MASTER"],
    },
  },
} as const
