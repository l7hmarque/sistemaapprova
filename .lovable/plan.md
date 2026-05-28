## Diagnóstico

O backend está saudável e não encontrei erro de cota de IA. O erro `new row violates row-level security policy` está vindo do controle de acesso do banco/armazenamento.

O ponto mais provável é a página `/admin/captura`: ela usa a primeira organização direta do usuário para montar o caminho do arquivo, mas o painel tem seletor de organização ativa. Se o super admin/escritório está visualizando outra OSC, o arquivo pode ser enviado para uma organização diferente da organização ativa, e depois o registro em `documentos_anexos` entra com `organization_id` padrão incorreto ou não compatível com a política.

Além disso, o bucket `documentos` é privado, mas a tela ainda usa `getPublicUrl`, que não é adequado para acesso posterior a arquivos privados.

## Plano de correção

1. **Usar a organização ativa em `/admin/captura`**
   - Trocar o `orgId` carregado manualmente por `activeOrgId` do `useActiveOrg()`.
   - Bloquear o processamento enquanto a organização ativa não estiver carregada.
   - Fazer as consultas de eventos, fornecedores e configurações filtrarem pela organização ativa.

2. **Gravar `organization_id` explicitamente**
   - No `insert` em `documentos_anexos`, enviar `organization_id: activeOrgId`.
   - No vínculo automático/manual, só considerar eventos da organização ativa.
   - Isso evita depender do `current_user_org()`, que pode apontar para a primeira organização do usuário e não para a OSC selecionada no painel.

3. **Padronizar o caminho rastreável do PDF**
   - Manter o prefixo obrigatório do bucket: `<organization_id>/...`.
   - Usar nome seguro com hash curto para rastreabilidade e evitar caracteres problemáticos.

4. **Ajustar URL de arquivo privado**
   - Substituir `getPublicUrl` por `createSignedUrl`.
   - Salvar também o caminho interno no `metadata`, para regenerar link assinado depois.

5. **Melhorar diagnóstico visível**
   - Exibir erro mais claro quando a falha vier de RLS/storage.
   - Incluir detalhes úteis no console para confirmar se falhou no upload, insert ou update.

## Arquivo afetado

- `src/routes/admin.captura.tsx`

## Resultado esperado

Ao processar o PDF na organização correta, o upload e o registro em `documentos_anexos` devem passar pela RLS e o item deve terminar como `vinculado` ou `orfao`, não como `erro`.