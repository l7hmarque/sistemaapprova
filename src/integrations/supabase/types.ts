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
      audit_log: {
        Row: {
          acao: string
          criado_em: string
          id: string
          organization_id: string | null
          payload: Json
          user_id: string | null
        }
        Insert: {
          acao: string
          criado_em?: string
          id?: string
          organization_id?: string | null
          payload?: Json
          user_id?: string | null
        }
        Update: {
          acao?: string
          criado_em?: string
          id?: string
          organization_id?: string | null
          payload?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      captura_jobs: {
        Row: {
          arquivo_hash: string
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          dados: Json | null
          documento_id: string | null
          evento_id: string | null
          finalizado_em: string | null
          id: string
          iniciado_em: string | null
          mensagem: string | null
          mes_referencia: string
          mime_type: string | null
          nome_arquivo: string
          organization_id: string
          status: string
          storage_path: string
          tamanho_bytes: number | null
          tentativas: number
        }
        Insert: {
          arquivo_hash: string
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          dados?: Json | null
          documento_id?: string | null
          evento_id?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string | null
          mensagem?: string | null
          mes_referencia: string
          mime_type?: string | null
          nome_arquivo: string
          organization_id: string
          status?: string
          storage_path: string
          tamanho_bytes?: number | null
          tentativas?: number
        }
        Update: {
          arquivo_hash?: string
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          dados?: Json | null
          documento_id?: string | null
          evento_id?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string | null
          mensagem?: string | null
          mes_referencia?: string
          mime_type?: string | null
          nome_arquivo?: string
          organization_id?: string
          status?: string
          storage_path?: string
          tamanho_bytes?: number | null
          tentativas?: number
        }
        Relationships: [
          {
            foreignKeyName: "captura_jobs_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_anexos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captura_jobs_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_financeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captura_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          atualizado_em: string
          chave: string
          organization_id: string
          valor: Json
        }
        Insert: {
          atualizado_em?: string
          chave: string
          organization_id?: string
          valor?: Json
        }
        Update: {
          atualizado_em?: string
          chave?: string
          organization_id?: string
          valor?: Json
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contadores_periodo: {
        Row: {
          atualizado_em: string
          mes_referencia: string
          organization_id: string
          ultimo_numero: number
        }
        Insert: {
          atualizado_em?: string
          mes_referencia: string
          organization_id: string
          ultimo_numero?: number
        }
        Update: {
          atualizado_em?: string
          mes_referencia?: string
          organization_id?: string
          ultimo_numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "contadores_periodo_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          razao_social?: string
          representante_legal?: string | null
          respondido_em?: string | null
          respostas?: Json
          status?: string
          telefone?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "convites_cotacao_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      convites_membro: {
        Row: {
          aceito_em: string | null
          aceito_por: string | null
          convidado_por: string
          criado_em: string
          email: string
          expira_em: string
          id: string
          organization_id: string
          role: string
          token: string
        }
        Insert: {
          aceito_em?: string | null
          aceito_por?: string | null
          convidado_por: string
          criado_em?: string
          email: string
          expira_em?: string
          id?: string
          organization_id: string
          role?: string
          token: string
        }
        Update: {
          aceito_em?: string | null
          aceito_por?: string | null
          convidado_por?: string
          criado_em?: string
          email?: string
          expira_em?: string
          id?: string
          organization_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "convites_membro_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          termo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacao_presets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          status?: string
          termo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_anexos: {
        Row: {
          arquivo_hash: string | null
          arquivo_url: string | null
          cnpj_extraido: string | null
          created_at: string
          data_extraida: string | null
          drive_file_id: string | null
          evento_id: string | null
          gmail_message_id: string | null
          id: string
          metadata: Json
          numero_extraido: string | null
          organization_id: string
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
          drive_file_id?: string | null
          evento_id?: string | null
          gmail_message_id?: string | null
          id?: string
          metadata?: Json
          numero_extraido?: string | null
          organization_id?: string
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
          drive_file_id?: string | null
          evento_id?: string | null
          gmail_message_id?: string | null
          id?: string
          metadata?: Json
          numero_extraido?: string | null
          organization_id?: string
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
          {
            foreignKeyName: "documentos_anexos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_sync_queue: {
        Row: {
          atualizado_em: string
          bucket: string
          criado_em: string
          drive_file_id: string | null
          id: string
          mes_ref: string | null
          mime_type: string | null
          nome_original: string | null
          organization_id: string
          path: string
          proximo_retry: string
          ref_id: string | null
          ref_table: string | null
          section: string
          status: string
          tentativas: number
          ultimo_erro: string | null
        }
        Insert: {
          atualizado_em?: string
          bucket: string
          criado_em?: string
          drive_file_id?: string | null
          id?: string
          mes_ref?: string | null
          mime_type?: string | null
          nome_original?: string | null
          organization_id: string
          path: string
          proximo_retry?: string
          ref_id?: string | null
          ref_table?: string | null
          section: string
          status?: string
          tentativas?: number
          ultimo_erro?: string | null
        }
        Update: {
          atualizado_em?: string
          bucket?: string
          criado_em?: string
          drive_file_id?: string | null
          id?: string
          mes_ref?: string | null
          mime_type?: string | null
          nome_original?: string | null
          organization_id?: string
          path?: string
          proximo_retry?: string
          ref_id?: string | null
          ref_table?: string | null
          section?: string
          status?: string
          tentativas?: number
          ultimo_erro?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drive_sync_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          prioridade?: string
          status?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_agenda_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_financeiros: {
        Row: {
          categoria: string
          cd_modalidade_compra: number | null
          created_at: string
          data_emissao: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string | null
          excluido_em: string | null
          excluido_por: string | null
          fornecedor_id: string | null
          id: string
          id_interno: string | null
          mes_referencia: string
          metadata: Json
          nm_favorecido: string | null
          nr_doc_fav: string | null
          nr_documento: string | null
          nr_documento_pagamento: string | null
          organization_id: string
          origem: string
          prestacao_snapshot_id: string | null
          status_documental: string
          tp_despesa: number | null
          tp_doc_fav: string | null
          tp_documento_despesa: number | null
          tp_documento_pagamento: number | null
          updated_at: string
          valor_efetivo: number | null
          valor_previsto: number | null
        }
        Insert: {
          categoria: string
          cd_modalidade_compra?: number | null
          created_at?: string
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          excluido_em?: string | null
          excluido_por?: string | null
          fornecedor_id?: string | null
          id?: string
          id_interno?: string | null
          mes_referencia: string
          metadata?: Json
          nm_favorecido?: string | null
          nr_doc_fav?: string | null
          nr_documento?: string | null
          nr_documento_pagamento?: string | null
          organization_id?: string
          origem?: string
          prestacao_snapshot_id?: string | null
          status_documental?: string
          tp_despesa?: number | null
          tp_doc_fav?: string | null
          tp_documento_despesa?: number | null
          tp_documento_pagamento?: number | null
          updated_at?: string
          valor_efetivo?: number | null
          valor_previsto?: number | null
        }
        Update: {
          categoria?: string
          cd_modalidade_compra?: number | null
          created_at?: string
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          excluido_em?: string | null
          excluido_por?: string | null
          fornecedor_id?: string | null
          id?: string
          id_interno?: string | null
          mes_referencia?: string
          metadata?: Json
          nm_favorecido?: string | null
          nr_doc_fav?: string | null
          nr_documento?: string | null
          nr_documento_pagamento?: string | null
          organization_id?: string
          origem?: string
          prestacao_snapshot_id?: string | null
          status_documental?: string
          tp_despesa?: number | null
          tp_doc_fav?: string | null
          tp_documento_despesa?: number | null
          tp_documento_pagamento?: number | null
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
          {
            foreignKeyName: "eventos_financeiros_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
        }
        Insert: {
          criada_em?: string
          dados: Json
          hash_arquivo?: string | null
          id?: string
          mes_referencia?: string | null
          nome_arquivo?: string | null
          organization_id?: string
        }
        Update: {
          criada_em?: string
          dados?: Json
          hash_arquivo?: string | null
          id?: string
          mes_referencia?: string | null
          nome_arquivo?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extracoes_salvas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      favorecidos_padrao: {
        Row: {
          ativo: boolean
          atualizado_em: string
          categoria: string
          cnpj: string
          criado_em: string
          id: string
          match_regex: string | null
          match_subtipo: number | null
          nome: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          categoria: string
          cnpj: string
          criado_em?: string
          id?: string
          match_regex?: string | null
          match_subtipo?: number | null
          nome: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string
          cnpj?: string
          criado_em?: string
          id?: string
          match_regex?: string | null
          match_subtipo?: number | null
          nome?: string
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
          organization_id: string
          razao_social: string
          regras_sit: Json
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
          organization_id?: string
          razao_social: string
          regras_sit?: Json
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
          organization_id?: string
          razao_social?: string
          regras_sit?: Json
          representante_legal?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          params?: Json
          template_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelos_planilha_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      objetos_cotacao: {
        Row: {
          categoria: string | null
          criado_em: string
          descricao: string
          id: string
          organization_id: string
          unidade_padrao: string | null
          uso_count: number
        }
        Insert: {
          categoria?: string | null
          criado_em?: string
          descricao: string
          id?: string
          organization_id?: string
          unidade_padrao?: string | null
          uso_count?: number
        }
        Update: {
          categoria?: string | null
          criado_em?: string
          descricao?: string
          id?: string
          organization_id?: string
          unidade_padrao?: string | null
          uso_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "objetos_cotacao_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_presets: {
        Row: {
          criado_em: string
          fornecedores_sugeridos: Json
          id: string
          itens: Json
          nome: string
          objeto: string | null
          organization_id: string
          termo: string | null
        }
        Insert: {
          criado_em?: string
          fornecedores_sugeridos?: Json
          id?: string
          itens?: Json
          nome: string
          objeto?: string | null
          organization_id?: string
          termo?: string | null
        }
        Update: {
          criado_em?: string
          fornecedores_sugeridos?: Json
          id?: string
          itens?: Json
          nome?: string
          objeto?: string | null
          organization_id?: string
          termo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_presets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
          {
            foreignKeyName: "orcamentos_salvos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_drive_folders: {
        Row: {
          atualizado_em: string
          criado_em: string
          organization_id: string
          root_folder_id: string
          subfolders: Json
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          organization_id: string
          root_folder_id: string
          subfolders?: Json
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          organization_id?: string
          root_folder_id?: string
          subfolders?: Json
        }
        Relationships: [
          {
            foreignKeyName: "organization_drive_folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          criado_em: string
          organization_id: string
          role: Database["public"]["Enums"]["org_member_role"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_member_role"]
          user_id: string
        }
        Update: {
          criado_em?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          atualizado_em: string
          cnpj: string | null
          cobranca_externa: boolean
          criado_em: string
          id: string
          nome: string
          observacoes: string | null
          parent_organization_id: string | null
          plano: string
          status: Database["public"]["Enums"]["org_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tipo: Database["public"]["Enums"]["org_tipo"]
          trial_ate: string | null
        }
        Insert: {
          atualizado_em?: string
          cnpj?: string | null
          cobranca_externa?: boolean
          criado_em?: string
          id?: string
          nome: string
          observacoes?: string | null
          parent_organization_id?: string | null
          plano?: string
          status?: Database["public"]["Enums"]["org_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tipo?: Database["public"]["Enums"]["org_tipo"]
          trial_ate?: string | null
        }
        Update: {
          atualizado_em?: string
          cnpj?: string | null
          cobranca_externa?: boolean
          criado_em?: string
          id?: string
          nome?: string
          observacoes?: string | null
          parent_organization_id?: string | null
          plano?: string
          status?: Database["public"]["Enums"]["org_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tipo?: Database["public"]["Enums"]["org_tipo"]
          trial_ate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_organization_id_fkey"
            columns: ["parent_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
          {
            foreignKeyName: "prestacao_documentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
          pdf_path: string | null
          pdf_url: string | null
          revisao: number
          revogado_em: string | null
          revogado_motivo: string | null
          revogado_por: string | null
          titulo: string | null
          total_documentos: number
          total_eventos: number
          versao: number
        }
        Insert: {
          assinatura_hash: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          manifest?: Json
          mes_referencia: string
          organization_id?: string
          pdf_path?: string | null
          pdf_url?: string | null
          revisao?: number
          revogado_em?: string | null
          revogado_motivo?: string | null
          revogado_por?: string | null
          titulo?: string | null
          total_documentos?: number
          total_eventos?: number
          versao?: number
        }
        Update: {
          assinatura_hash?: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          manifest?: Json
          mes_referencia?: string
          organization_id?: string
          pdf_path?: string | null
          pdf_url?: string | null
          revisao?: number
          revogado_em?: string | null
          revogado_motivo?: string | null
          revogado_por?: string | null
          titulo?: string | null
          total_documentos?: number
          total_eventos?: number
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "prestacoes_snapshot_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assunto: string
          atualizado_em: string
          criado_em: string
          criado_por: string
          id: string
          mensagem: string
          organization_id: string
          respondido_em: string | null
          resposta: string | null
          status: string
        }
        Insert: {
          assunto: string
          atualizado_em?: string
          criado_em?: string
          criado_por: string
          id?: string
          mensagem: string
          organization_id: string
          respondido_em?: string | null
          resposta?: string | null
          status?: string
        }
        Update: {
          assunto?: string
          atualizado_em?: string
          criado_em?: string
          criado_por?: string
          id?: string
          mensagem?: string
          organization_id?: string
          respondido_em?: string | null
          resposta?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          criado_em: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          criado_em?: string
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
      current_user_org: { Args: never; Returns: string }
      drive_queue_claim: {
        Args: { _limit?: number }
        Returns: {
          atualizado_em: string
          bucket: string
          criado_em: string
          drive_file_id: string | null
          id: string
          mes_ref: string | null
          mime_type: string | null
          nome_original: string | null
          organization_id: string
          path: string
          proximo_retry: string
          ref_id: string | null
          ref_table: string | null
          section: string
          status: string
          tentativas: number
          ultimo_erro: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "drive_sync_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_owner: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      user_orgs: {
        Args: { _user_id: string }
        Returns: {
          organization_id: string
        }[]
      }
    }
    Enums: {
      app_role: "super_admin" | "org_owner" | "org_admin" | "org_member"
      org_member_role: "owner" | "admin" | "membro"
      org_status: "trial" | "ativo" | "suspenso" | "cancelado"
      org_tipo: "osc" | "escritorio"
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
      app_role: ["super_admin", "org_owner", "org_admin", "org_member"],
      org_member_role: ["owner", "admin", "membro"],
      org_status: ["trial", "ativo", "suspenso", "cancelado"],
      org_tipo: ["osc", "escritorio"],
    },
  },
} as const
