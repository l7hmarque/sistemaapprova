## Objetivo

Criar sua conta `l7hmarque@gmail.com` (senha `leop60506924`), já confirmada, e conceder a role `super_admin` (acesso total à área `/owner` e permissões máximas).

## Passos

1. **Criar o usuário via Admin API** — usar `supabase.auth.admin.createUser` (com `SUPABASE_SERVICE_ROLE_KEY`, dentro de um script one-off executado no sandbox) passando `email_confirm: true` para pular verificação. O trigger `handle_new_user` já cria automaticamente uma organização e adiciona você como `owner` dela.
2. **Conceder role de super_admin** — inserir em `public.user_roles` o par `(user_id, 'super_admin')` via `supabase--insert`, usando o `id` retornado no passo 1. Isso libera o gate de `/owner` (`useCurrentUser.isSuperAdmin`) e o card "Fila Drive" que exige `has_role(_, 'super_admin')`.
3. **Verificação** — consultar `public.user_roles` e `public.organization_members` do seu `user_id` para confirmar que a role `super_admin` está presente e que existe uma organização com você como `owner`. Confirmar que consegue logar em `/login` com as credenciais fornecidas.

## Segurança

- A senha ficará apenas no comando one-off no sandbox; não será commitada em código nem em migração.
- Nenhuma alteração de schema, RLS ou trigger — apenas dados (um usuário + uma linha em `user_roles`).
- Depois de logar, você pode trocar a senha em Configurações / "Esqueci minha senha" se quiser.

## Fora de escopo

- Convidar outros usuários, mudar planos, alterar RLS ou modificar organizações existentes.