
alter table public.prestacao_documentos
  add column if not exists extracao_id uuid references public.extracoes_salvas(id) on delete cascade,
  add column if not exists despesa_uid text,
  add column if not exists status_aprovacao text not null default 'pendente',
  add column if not exists aprovado_por uuid,
  add column if not exists aprovado_em timestamptz,
  add column if not exists observacao_aprovacao text,
  add column if not exists tamanho_bytes integer,
  add column if not exists mime_type text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'prestacao_documentos_status_aprovacao_check'
  ) then
    alter table public.prestacao_documentos
      add constraint prestacao_documentos_status_aprovacao_check
      check (status_aprovacao in ('pendente','aprovado','rejeitado'));
  end if;
end $$;

create index if not exists prestacao_documentos_extracao_uid_idx
  on public.prestacao_documentos (extracao_id, despesa_uid);

create index if not exists prestacao_documentos_status_idx
  on public.prestacao_documentos (status_aprovacao);

alter table public.extracoes_salvas
  add column if not exists hash_arquivo text;

create index if not exists extracoes_salvas_hash_idx
  on public.extracoes_salvas (hash_arquivo);

-- Storage: políticas para autenticados no bucket "documentos" sob comprovantes/*
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='auth read comprovantes') then
    create policy "auth read comprovantes" on storage.objects
      for select to authenticated
      using (bucket_id = 'documentos' and (storage.foldername(name))[1] = 'comprovantes');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='auth upload comprovantes') then
    create policy "auth upload comprovantes" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = 'comprovantes');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='auth delete comprovantes') then
    create policy "auth delete comprovantes" on storage.objects
      for delete to authenticated
      using (bucket_id = 'documentos' and (storage.foldername(name))[1] = 'comprovantes');
  end if;
end $$;
