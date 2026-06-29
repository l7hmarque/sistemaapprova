create table if not exists public.organization_drive_folders (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  root_folder_id text not null,
  subfolders jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.organization_drive_folders to authenticated;
grant all on public.organization_drive_folders to service_role;

alter table public.organization_drive_folders enable row level security;

create policy "drive folders: members select"
  on public.organization_drive_folders for select to authenticated
  using (organization_id in (select organization_id from public.user_orgs(auth.uid())));

create policy "drive folders: owners write"
  on public.organization_drive_folders for all to authenticated
  using (public.is_org_owner(auth.uid(), organization_id))
  with check (public.is_org_owner(auth.uid(), organization_id));

drop trigger if exists trg_touch_org_drive_folders on public.organization_drive_folders;
create trigger trg_touch_org_drive_folders
  before update on public.organization_drive_folders
  for each row execute function public.touch_atualizado_em();

drop table if exists public.google_connections cascade;