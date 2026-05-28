ALTER TABLE public.convites_membro DROP CONSTRAINT IF EXISTS convites_membro_role_check;
ALTER TABLE public.convites_membro ALTER COLUMN role SET DEFAULT 'membro';
UPDATE public.convites_membro SET role = 'membro' WHERE role NOT IN ('owner','admin','membro');
ALTER TABLE public.convites_membro ADD CONSTRAINT convites_membro_role_check CHECK (role IN ('owner','admin','membro'));