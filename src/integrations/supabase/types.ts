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
      configuracoes: {
        Row: {
          atualizado_em: string
          chave: string
          valor: Json
        }
        Insert: {
          atualizado_em?: string
          chave: string
          valor?: Json
        }
        Update: {
          atualizado_em?: string
          chave?: string
          valor?: Json
        }
        Relationships: []
      }
      convites_cotacao: {
        Row: {
          atualizado_em: string
          cnpj: string
          cotacao_id: string
          cpf_representante: string | null
          criado_em: string
          email: string | null
          endereco: string | null
          enviado_em: string
          expira_em: string
          fornecedor_id: string | null
          id: string
          observacao_fornecedor: string | null
          orcamento_id: string | null
          razao_social: string
          representante_legal: string | null
          respondido_em: string | null
          respostas: Json
          status: string
          telefone: string | null
          token: string
        }
        Insert: {
          atualizado_em?: string
          cnpj: string
          cotacao_id: string
          cpf_representante?: string | null
          criado_em?: string
          email?: string | null
          endereco?: string | null
          enviado_em?: string
          expira_em?: string
          fornecedor_id?: string | null
          id?: string
          observacao_fornecedor?: string | null
          orcamento_id?: string | null
          razao_social: string
          representante_legal?: string | null
          respondido_em?: string | null
          respostas?: Json
          status?: string
          telefone?: string | null
          token: string
        }
        Update: {
          atualizado_em?: string
          cnpj?: string
          cotacao_id?: string
          cpf_representante?: string | null
          criado_em?: string
          email?: string | null
          endereco?: string | null
          enviado_em?: string
          expira_em?: string
          fornecedor_id?: string | null
          id?: string
          observacao_fornecedor?: string | null
          orcamento_id?: string | null
          razao_social?: string
          representante_legal?: string | null
          respondido_em?: string | null
          respostas?: Json
          status?: string
          telefone?: string | null
          token?: string
        }
        Relationships: []
      }
      cotacao_presets: {
        Row: {
          atualizado_em: string
          criado_em: string
          fornecedores_sugeridos: Json
          id: string
          itens: Json
          nome: string
          objeto: string | null
          termo: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          fornecedores_sugeridos?: Json
          id?: string
          itens?: Json
          nome: string
          objeto?: string | null
          termo?: string | null
        }
        Update: {
          atualizado_em?: string
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
      cotacoes: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          itens: Json
          mapa_drive_file_id: string | null
          mapa_drive_file_url: string | null
          mes_referencia: string | null
          objeto: string
          observacoes: string | null
          status: string
          termo: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          itens?: Json
          mapa_drive_file_id?: string | null
          mapa_drive_file_url?: string | null
          mes_referencia?: string | null
          objeto: string
          observacoes?: string | null
          status?: string
          termo?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          itens?: Json
          mapa_drive_file_id?: string | null
          mapa_drive_file_url?: string | null
          mes_referencia?: string | null
          objeto?: string
          observacoes?: string | null
          status?: string
          termo?: string | null
        }
        Relationships: []
      }
      documentos_anexos: {
        Row: {
          arquivo_hash: string | null
          arquivo_url: string | null
          cnpj_extraido: string | null
          created_at: string
          data_extraida: string | null
          evento_id: string | null
          gmail_message_id: string | null
          id: string
          metadata: Json
          numero_extraido: string | null
          origem: string
          tipo: string
          valor_extraido: number | null
        }
        Insert: {
          arquivo_hash?: string | null
          arquivo_url?: string | null
          cnpj_extraido?: string | null
          created_at?: string
          data_extraida?: string | null
          evento_id?: string | null
          gmail_message_id?: string | null
          id?: string
          metadata?: Json
          numero_extraido?: string | null
          origem?: string
          tipo: string
          valor_extraido?: number | null
        }
        Update: {
          arquivo_hash?: string | null
          arquivo_url?: string | null
          cnpj_extraido?: string | null
          created_at?: string
          data_extraida?: string | null
          evento_id?: string | null
          gmail_message_id?: string | null
          id?: string
          metadata?: Json
          numero_extraido?: string | null
          origem?: string
          tipo?: string
          valor_extraido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_anexos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_financeiros"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_agenda: {
        Row: {
          atualizado_em: string
          cotacao_id: string | null
          criado_em: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          id: string
          notificar_em: string | null
          prioridade: string
          status: string
          tipo: string
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          cotacao_id?: string | null
          criado_em?: string
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          id?: string
          notificar_em?: string | null
          prioridade?: string
          status?: string
          tipo?: string
          titulo: string
        }
        Update: {
          atualizado_em?: string
          cotacao_id?: string | null
          criado_em?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          id?: string
          notificar_em?: string | null
          prioridade?: string
          status?: string
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      eventos_financeiros: {
        Row: {
          categoria: string
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string | null
          fornecedor_id: string | null
          id: string
          mes_referencia: string
          metadata: Json
          origem: string
          prestacao_snapshot_id: string | null
          status_documental: string
          updated_at: string
          valor_efetivo: number | null
          valor_previsto: number | null
        }
        Insert: {
          categoria: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string
          mes_referencia: string
          metadata?: Json
          origem?: string
          prestacao_snapshot_id?: string | null
          status_documental?: string
          updated_at?: string
          valor_efetivo?: number | null
          valor_previsto?: number | null
        }
        Update: {
          categoria?: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string
          mes_referencia?: string
          metadata?: Json
          origem?: string
          prestacao_snapshot_id?: string | null
          status_documental?: string
          updated_at?: string
          valor_efetivo?: number | null
          valor_previsto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_financeiros_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_visita: {
        Row: {
          country: string | null
          created_at: string
          evento: string
          id: string
          payload: Json
          referrer: string | null
          rota: string
          session_id: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          evento: string
          id?: string
          payload?: Json
          referrer?: string | null
          rota: string
          session_id: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          evento?: string
          id?: string
          payload?: Json
          referrer?: string | null
          rota?: string
          session_id?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      extracoes_salvas: {
        Row: {
          criada_em: string
          dados: Json
          hash_arquivo: string | null
          id: string
          mes_referencia: string | null
          nome_arquivo: string | null
        }
        Insert: {
          criada_em?: string
          dados: Json
          hash_arquivo?: string | null
          id?: string
          mes_referencia?: string | null
          nome_arquivo?: string | null
        }
        Update: {
          criada_em?: string
          dados?: Json
          hash_arquivo?: string | null
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
      leads: {
        Row: {
          cargo: string
          created_at: string
          dor: string | null
          email: string
          id: string
          ip_hash: string | null
          nome: string
          observacoes_internas: string | null
          origem_descoberta: string | null
          osc_nome: string
          plano: string
          publico: string | null
          qtd_lancamentos: number | null
          qtd_oscs: number | null
          referrer: string | null
          status: string
          telefone: string
          updated_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          cargo: string
          created_at?: string
          dor?: string | null
          email: string
          id?: string
          ip_hash?: string | null
          nome: string
          observacoes_internas?: string | null
          origem_descoberta?: string | null
          osc_nome: string
          plano: string
          publico?: string | null
          qtd_lancamentos?: number | null
          qtd_oscs?: number | null
          referrer?: string | null
          status?: string
          telefone: string
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          cargo?: string
          created_at?: string
          dor?: string | null
          email?: string
          id?: string
          ip_hash?: string | null
          nome?: string
          observacoes_internas?: string | null
          origem_descoberta?: string | null
          osc_nome?: string
          plano?: string
          publico?: string | null
          qtd_lancamentos?: number | null
          qtd_oscs?: number | null
          referrer?: string | null
          status?: string
          telefone?: string
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      leads_rate_limit: {
        Row: {
          count: number
          ip_hash: string
          window_start: string
        }
        Insert: {
          count?: number
          ip_hash: string
          window_start?: string
        }
        Update: {
          count?: number
          ip_hash?: string
          window_start?: string
        }
        Relationships: []
      }
      modelos_planilha: {
        Row: {
          aba: string
          ativo: boolean
          atualizado_em: string
          criado_em: string
          id: string
          nome: string
          params: Json
          template_id: string
          tipo: string
        }
        Insert: {
          aba?: string
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome: string
          params?: Json
          template_id: string
          tipo: string
        }
        Update: {
          aba?: string
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome?: string
          params?: Json
          template_id?: string
          tipo?: string
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
          cotacao_id: string | null
          criado_em: string
          dados: Json
          drive_file_id: string | null
          drive_file_url: string | null
          fornecedor_id: string | null
          id: string
          mes_referencia: string | null
          objeto: string | null
          status: string
          termo: string | null
          tipo: string
        }
        Insert: {
          cotacao_id?: string | null
          criado_em?: string
          dados: Json
          drive_file_id?: string | null
          drive_file_url?: string | null
          fornecedor_id?: string | null
          id?: string
          mes_referencia?: string | null
          objeto?: string | null
          status?: string
          termo?: string | null
          tipo: string
        }
        Update: {
          cotacao_id?: string | null
          criado_em?: string
          dados?: Json
          drive_file_id?: string | null
          drive_file_url?: string | null
          fornecedor_id?: string | null
          id?: string
          mes_referencia?: string | null
          objeto?: string | null
          status?: string
          termo?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_salvos_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_salvos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      prestacao_documentos: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          arquivo_url: string | null
          atualizado_em: string
          criado_em: string
          data_emissao: string | null
          data_vencimento: string | null
          descricao: string | null
          despesa_uid: string | null
          drive_file_id: string | null
          extracao_id: string | null
          id: string
          mes_referencia: string | null
          mime_type: string | null
          nome: string
          observacao_aprovacao: string | null
          ordem: number
          status_aprovacao: string
          tamanho_bytes: number | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          arquivo_url?: string | null
          atualizado_em?: string
          criado_em?: string
          data_emissao?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          despesa_uid?: string | null
          drive_file_id?: string | null
          extracao_id?: string | null
          id?: string
          mes_referencia?: string | null
          mime_type?: string | null
          nome: string
          observacao_aprovacao?: string | null
          ordem?: number
          status_aprovacao?: string
          tamanho_bytes?: number | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          arquivo_url?: string | null
          atualizado_em?: string
          criado_em?: string
          data_emissao?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          despesa_uid?: string | null
          drive_file_id?: string | null
          extracao_id?: string | null
          id?: string
          mes_referencia?: string | null
          mime_type?: string | null
          nome?: string
          observacao_aprovacao?: string | null
          ordem?: number
          status_aprovacao?: string
          tamanho_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prestacao_documentos_extracao_id_fkey"
            columns: ["extracao_id"]
            isOneToOne: false
            referencedRelation: "extracoes_salvas"
            referencedColumns: ["id"]
          },
        ]
      }
      prestacoes_snapshot: {
        Row: {
          assinatura_hash: string
          gerado_em: string
          gerado_por: string | null
          id: string
          manifest: Json
          mes_referencia: string
          pdf_path: string | null
          pdf_url: string | null
          titulo: string | null
          total_documentos: number
          total_eventos: number
        }
        Insert: {
          assinatura_hash: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          manifest?: Json
          mes_referencia: string
          pdf_path?: string | null
          pdf_url?: string | null
          titulo?: string | null
          total_documentos?: number
          total_eventos?: number
        }
        Update: {
          assinatura_hash?: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          manifest?: Json
          mes_referencia?: string
          pdf_path?: string | null
          pdf_url?: string | null
          titulo?: string | null
          total_documentos?: number
          total_eventos?: number
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
