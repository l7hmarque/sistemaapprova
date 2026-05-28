ALTER TABLE public.eventos_financeiros
  ADD COLUMN IF NOT EXISTS id_interno text,
  ADD COLUMN IF NOT EXISTS data_emissao date,
  ADD COLUMN IF NOT EXISTS tp_documento_despesa smallint,
  ADD COLUMN IF NOT EXISTS tp_doc_fav text,
  ADD COLUMN IF NOT EXISTS nr_doc_fav text,
  ADD COLUMN IF NOT EXISTS nm_favorecido text,
  ADD COLUMN IF NOT EXISTS nr_documento text,
  ADD COLUMN IF NOT EXISTS cd_modalidade_compra smallint,
  ADD COLUMN IF NOT EXISTS tp_documento_pagamento smallint,
  ADD COLUMN IF NOT EXISTS nr_documento_pagamento text,
  ADD COLUMN IF NOT EXISTS tp_despesa integer;