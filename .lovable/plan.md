## Diagnóstico

Você é Admin Master, mas ao tentar marcar/desmarcar checkboxes na tela **Permissões** aparece um erro do tipo "permission denied / RLS".

Causa: as políticas RLS da tabela `role_permissions` exigem o papel **`admin`** (literal):

```
rp_insert / rp_update / rp_delete  →  has_role(auth.uid(), 'admin')
```

Como sua conta tem o papel `admin_master` (e não `admin`), o banco bloqueia o INSERT/UPDATE/DELETE — mesmo que o front-end já libere a UI para o master. A liberação no `permissions.tsx` (linha `roles.includes("admin_master")`) só afeta a tela; o banco continua negando.

O mesmo padrão pode estar afetando outras tabelas administrativas que usam `has_role(..., 'admin')` em vez de `is_manager` / `is_master`.

## O que vou fazer

1. **Migração SQL** ajustando as políticas RLS para que `admin_master` também passe:
   - `role_permissions` (insert/update/delete): trocar `has_role(auth.uid(), 'admin')` por `is_master(auth.uid()) OR has_role(auth.uid(), 'admin')`.
   - `profiles.profiles_admin_update`: idem (master poder editar perfis de qualquer pessoa).
   - `projects.projects_insert_managers / projects_update_managers / projects_delete_managers`: trocar pela função `is_manager(auth.uid())` (que já inclui master, admin e gerente) para manter consistência.
   - `project_attachments.attachments_delete_managers`: idem.

2. **Não mexer** em `user_roles` (já usa `can_manage_user_role`, que tem bypass do master), nem nas tabelas que já usam `is_manager` / `is_master`.

3. Após aprovar a migração, abrir a tela **Permissões** e validar que os checkboxes salvam sem erro.

## Por que essa abordagem

- Mantém a hierarquia atual (admin / gerente / membro) intacta.
- Centraliza o "poder total" no `is_master()`, que já existe e é `SECURITY DEFINER`.
- Não precisa mudar nenhuma tela — só destrava o banco para o master.

## Detalhes técnicos (resumo SQL)

```sql
-- exemplo (será aplicado a cada policy citada acima)
DROP POLICY "rp_insert" ON public.role_permissions;
CREATE POLICY "rp_insert" ON public.role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_master(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
```

Quer que eu siga com essa correção?
