
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

create policy "auth read documentos"
on storage.objects for select to authenticated
using (bucket_id = 'documentos');

create policy "auth insert documentos"
on storage.objects for insert to authenticated
with check (bucket_id = 'documentos');

create policy "auth update documentos"
on storage.objects for update to authenticated
using (bucket_id = 'documentos');

create policy "auth delete documentos"
on storage.objects for delete to authenticated
using (bucket_id = 'documentos');
