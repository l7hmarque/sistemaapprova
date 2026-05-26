-- Convites para portal público do fornecedor
CREATE TABLE public.convites_cotacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cotacao_id UUID NOT NULL,
  fornecedor_id UUID,
  razao_social TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  representante_legal TEXT,
  cpf_representante TEXT,
  endereco TEXT,
  token TEXT NOT NULL UNIQUE,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  status TEXT NOT NULL DEFAULT 'pendente',
  respostas JSONB NOT NULL DEFAULT '[]'::jsonb,
  observacao_fornecedor TEXT,
  orcamento_id UUID,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  respondido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_convites_cotacao_id ON public.convites_cotacao(cotacao_id);
CREATE INDEX idx_convites_token ON public.convites_cotacao(token);

ALTER TABLE public.convites_cotacao ENABLE ROW LEVEL SECURITY;

-- Autenticados: acesso total
CREATE POLICY "auth_all_convites" ON public.convites_cotacao
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anônimos: SELECT/UPDATE permitidos (filtragem por token é feita no servidor com supabaseAdmin)
-- Não habilitamos acesso anônimo direto — o portal público usa server route
-- com supabaseAdmin após validar token. RLS bloqueia anon por padrão.

CREATE TRIGGER trg_convites_atualizado_em
  BEFORE UPDATE ON public.convites_cotacao
  FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

-- Agenda
CREATE TABLE public.eventos_agenda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ,
  tipo TEXT NOT NULL DEFAULT 'compromisso',
  prioridade TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'pendente',
  cotacao_id UUID,
  notificar_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eventos_agenda_data_inicio ON public.eventos_agenda(data_inicio);

ALTER TABLE public.eventos_agenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_agenda" ON public.eventos_agenda
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_agenda_atualizado_em
  BEFORE UPDATE ON public.eventos_agenda
  FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();