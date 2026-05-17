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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      extracoes_salvas: {
        Row: {
          criada_em: string
          dados: Json
          id: string
          mes_referencia: string | null
          nome_arquivo: string | null
        }
        Insert: {
          criada_em?: string
          dados: Json
          id?: string
          mes_referencia?: string | null
          nome_arquivo?: string | null
        }
        Update: {
          criada_em?: string
          dados?: Json
          id?: string
          mes_referencia?: string | null
          nome_arquivo?: string | null
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          cnpj: string
          cpf_representante: string | null
          criado_em: string
          email: string | null
          endereco: string | null
          id: string
          razao_social: string
          representante_legal: string | null
          telefone: string | null
        }
        Insert: {
          cnpj: string
          cpf_representante?: string | null
          criado_em?: string
          email?: string | null
          endereco?: string | null
          id?: string
          razao_social: string
          representante_legal?: string | null
          telefone?: string | null
        }
        Update: {
          cnpj?: string
          cpf_representante?: string | null
          criado_em?: string
          email?: string | null
          endereco?: string | null
          id?: string
          razao_social?: string
          representante_legal?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      objetos_cotacao: {
        Row: {
          categoria: string | null
          criado_em: string
          descricao: string
          id: string
          unidade_padrao: string | null
          uso_count: number
        }
        Insert: {
          categoria?: string | null
          criado_em?: string
          descricao: string
          id?: string
          unidade_padrao?: string | null
          uso_count?: number
        }
        Update: {
          categoria?: string | null
          criado_em?: string
          descricao?: string
          id?: string
          unidade_padrao?: string | null
          uso_count?: number
        }
        Relationships: []
      }
      orcamento_presets: {
        Row: {
          criado_em: string
          fornecedores_sugeridos: Json
          id: string
          itens: Json
          nome: string
          objeto: string | null
          termo: string | null
        }
        Insert: {
          criado_em?: string
          fornecedores_sugeridos?: Json
          id?: string
          itens?: Json
          nome: string
          objeto?: string | null
          termo?: string | null
        }
        Update: {
          criado_em?: string
          fornecedores_sugeridos?: Json
          id?: string
          itens?: Json
          nome?: string
          objeto?: string | null
          termo?: string | null
        }
        Relationships: []
      }
      orcamentos_salvos: {
        Row: {
          criado_em: string
          dados: Json
          drive_file_id: string | null
          drive_file_url: string | null
          fornecedor_id: string | null
          id: string
          mes_referencia: string | null
          objeto: string | null
          termo: string | null
          tipo: string
        }
        Insert: {
          criado_em?: string
          dados: Json
          drive_file_id?: string | null
          drive_file_url?: string | null
          fornecedor_id?: string | null
          id?: string
          mes_referencia?: string | null
          objeto?: string | null
          termo?: string | null
          tipo: string
        }
        Update: {
          criado_em?: string
          dados?: Json
          drive_file_id?: string | null
          drive_file_url?: string | null
          fornecedor_id?: string | null
          id?: string
          mes_referencia?: string | null
          objeto?: string | null
          termo?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_salvos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
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
