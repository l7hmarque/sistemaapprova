
CREATE TABLE public.eventos_visita (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  rota TEXT NOT NULL,
  evento TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  user_agent TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eventos_visita_created_at ON public.eventos_visita (created_at DESC);
CREATE INDEX idx_eventos_visita_rota ON public.eventos_visita (rota);
CREATE INDEX idx_eventos_visita_evento ON public.eventos_visita (evento);
CREATE INDEX idx_eventos_visita_session ON public.eventos_visita (session_id);

ALTER TABLE public.eventos_visita ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_insert_eventos_visita"
ON public.eventos_visita
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "auth_can_view_eventos_visita"
ON public.eventos_visita
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "auth_can_delete_eventos_visita"
ON public.eventos_visita
FOR DELETE
TO authenticated
USING (true);
