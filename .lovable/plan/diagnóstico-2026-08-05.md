## Diagnóstico

O erro "row-level security policy for table projects" acontece porque a regra de gravação da tabela de demandas ainda exige **papel** de admin/gerente (`is_manager`), enquanto a liberação do sistema já foi migrada para **Perfis e Acessos** (áreas, cargos e menus visíveis).

Confirmado no banco:
- criar demanda: permitido só se `is_manager(auth.uid())`
- adicionar responsáveis: idem
- o menu `/projects` já é liberado por área em "Menus visíveis" (ex.: área Geral)

Ou seja: um usuário com acesso ao menu Demandas via Perfis e Acessos consegue abrir a tela, mas o banco recusa o cadastro.

## Correção proposta

1. Criar uma função de verificação no banco que responde "este usuário tem o menu X liberado?", cruzando: usuário → cargos → área → menus visíveis. Administradores continuam com acesso total.
2. Trocar as regras de gravação para usarem essa função com o menu `/projects`:
   - criar/editar demanda: quem tem `/projects` liberado (ou é gestor)
   - editar demanda: também continua permitido a quem é responsável pela demanda
   - excluir demanda: mantém restrito a gestores
   - responsáveis da demanda (incluir/remover): mesma regra de criar/editar, mantendo o bloqueio de adicionar perfis de cliente como responsável
3. Manter tudo o mais como está (visualização, portal do cliente, histórico de status).

## Detalhes técnicos

- Nova função `public.has_menu_access(_uid uuid, _menu_key text)` — `SECURITY DEFINER`, `STABLE`, `search_path = public` — unindo `user_specialties → provider_specialties → provider_areas → area_menu_visibility`, com atalho `is_master`.
- Recriar as policies `projects_insert_managers`, `projects_update_managers`, `assignees_insert_mgr`, `assignees_update_mgr`, `assignees_delete_mgr` usando `is_manager(auth.uid()) OR has_menu_access(auth.uid(), '/projects')`.
- Nenhuma mudança de schema/colunas e nenhuma alteração no front-end; o formulário atual passa a funcionar para os usuários já liberados.

## Verificação

Depois de aplicar, testar criando uma demanda com o usuário que estava recebendo o erro e confirmar que os responsáveis são gravados.
