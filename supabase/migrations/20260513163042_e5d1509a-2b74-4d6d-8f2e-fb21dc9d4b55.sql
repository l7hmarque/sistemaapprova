create table public.extracoes_salvas (
  id uuid primary key default gen_random_uuid(),
  criada_em timestamptz not null default now(),
  mes_referencia text,
  nome_arquivo text,
  dados jsonb not null
);
alter table public.extracoes_salvas enable row level security;
create policy "extracoes leitura publica" on public.extracoes_salvas for select using (true);
create policy "extracoes insert publico" on public.extracoes_salvas for insert with check (true);
create policy "extracoes delete publico" on public.extracoes_salvas for delete using (true);
create index extracoes_salvas_criada_em_idx on public.extracoes_salvas (criada_em desc);