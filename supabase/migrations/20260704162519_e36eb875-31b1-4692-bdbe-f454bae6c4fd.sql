
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS regras_sit jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_fornecedores_regras_sit_gin
  ON public.fornecedores USING GIN (regras_sit);

COMMENT ON COLUMN public.fornecedores.regras_sit IS
'Regras SIT por fornecedor (JSONB). Chaves opcionais: tp_despesa (int), tp_documento_despesa (int), tp_documento_pagamento (int), cd_modalidade_compra (int), tp_doc_fav ("CPF"|"CNPJ"|"EXT"), nm_favorecido_override (text), categoria_padrao (text), observacao (text). Presente = precedência sobre inferência por código.';

-- Seed idempotente: fornecedores canônicos por organização com regras SIT prontas.
-- Copel (energia) e Sanepar (água) são específicos do PR mas úteis; DARF/GPS/FGTS são nacionais.
INSERT INTO public.fornecedores (organization_id, cnpj, razao_social, regras_sit)
SELECT o.id, v.cnpj, v.razao_social, v.regras
FROM public.organizations o
CROSS JOIN (VALUES
  ('00394460000141', 'MINISTERIO DA FAZENDA - MATRIZ',
   '{"tp_documento_despesa":7,"tp_doc_fav":"CNPJ","categoria_padrao":"3.1.90.47.99","tp_despesa":40,"observacao":"DARF Federal"}'::jsonb),
  ('16727230000197', 'FUNDO DO REGIME GERAL DE PREVIDENCIA SOCIAL',
   '{"tp_documento_despesa":9,"tp_doc_fav":"CNPJ","categoria_padrao":"3.1.90.13.02","tp_despesa":22,"observacao":"GPS/INSS"}'::jsonb),
  ('00360305000104', 'CAIXA ECONOMICA FEDERAL',
   '{"tp_documento_despesa":10,"tp_doc_fav":"CNPJ","categoria_padrao":"3.1.90.13.01","tp_despesa":21,"observacao":"GFIP/GRRF/GFD - FGTS"}'::jsonb),
  ('76483817000120', 'COPEL DISTRIBUICAO S.A.',
   '{"tp_documento_despesa":3,"tp_doc_fav":"CNPJ","categoria_padrao":"3.3.90.39.43","tp_despesa":223,"observacao":"Energia eletrica"}'::jsonb),
  ('76484013000145', 'COMPANHIA DE SANEAMENTO DO PARANA - SANEPAR',
   '{"tp_documento_despesa":3,"tp_doc_fav":"CNPJ","categoria_padrao":"3.3.90.39.44","tp_despesa":224,"observacao":"Agua e esgoto"}'::jsonb)
) AS v(cnpj, razao_social, regras)
ON CONFLICT (organization_id, cnpj) DO UPDATE
  SET regras_sit = CASE
        WHEN public.fornecedores.regras_sit = '{}'::jsonb
          THEN EXCLUDED.regras_sit
        ELSE public.fornecedores.regras_sit
      END;
