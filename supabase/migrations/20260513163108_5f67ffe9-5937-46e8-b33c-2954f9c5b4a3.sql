drop policy "extracoes insert publico" on public.extracoes_salvas;
drop policy "extracoes delete publico" on public.extracoes_salvas;
create policy "extracoes insert anon" on public.extracoes_salvas for insert to anon, authenticated with check (true);
create policy "extracoes delete anon" on public.extracoes_salvas for delete to anon, authenticated using (true);