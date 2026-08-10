# Perfis e Acessos: uma matriz em árvore, sem quebra-cabeça

Hoje a liberação está espalhada em dois diálogos separados (menus na Área, abas/campos na Especialidade), cada um com uma lista diferente. É por isso que dá a sensação de "liberei e não apareceu". A estrutura de dois níveis continua (Área libera menus, Especialidade detalha o que se vê dentro deles), mas a tela passa a ser uma só, em árvore.

## Como fica a tela

Uma única aba "Permissões", com a Área/Especialidade escolhida no topo e, abaixo, a árvore:

```text
Buscar: [ prazo                ]        [Liberar tudo] [Bloquear tudo]

▾ Operação
  ▾ Demandas                     Menu   [x] liberado (Área)
      Kanban                     Aba    [x] Ver
      Lista                      Aba    [x] Ver
      Prazo (due_date)           Campo  [x] Ver   [ ] Editar
      Data de postagem           Campo  [ ] Ver   [ ] Editar
      Legenda                    Campo  [x] Ver   [x] Editar
  ▸ Calendário                   Menu   [x] liberado (Área)
▾ Cliente
  ▾ Clientes                     Menu   [x] liberado (Área)
      Diretório                  Aba    [ ] Ver
      Briefing & Estratégia      Aba    [x] Ver
```

Regras da árvore:
- Marcar o menu marca abas e campos filhos; desmarcar bloqueia tudo abaixo.
- Menu não liberado para a Área aparece esmaecido, com o motivo ("não liberado na Área") e um atalho para liberar ali mesmo — fim do ida e volta entre telas.
- "Editar" só existe onde faz sentido (campos); abas têm apenas "Ver".
- Campos da demanda ficam aninhados dentro do menu Demandas (é o único menu com campos hoje); qualquer coluna nova da tabela aparece sozinha na lista.
- Busca filtra por menu, aba ou campo; ações em massa por menu e por grupo.
- Contador por menu ("3 de 12 itens liberados") e badge "Novo" para itens ainda sem decisão.

## Comportamento mantido

- Menu sem nenhuma regra de abas/campos para a Especialidade continua liberando tudo dentro dele (padrão permissivo atual). Isso fica escrito na tela: "Sem regras: tudo visível".
- Nada muda no banco: as decisões seguem em `area_menu_visibility` (menus) e `specialty_field_visibility` (abas com chave `menu:/x#aba` e campos com chave simples).
- Admins/gerentes seguem com acesso total pela especialidade "Administração › Total".

## Detalhes técnicos

- `src/routes/_app/acessos.tsx`: substituir `MenuVisibilityDialog` e `FieldVisibilityDialog` por um único componente `PermissionTree` (menu → seções → campos), com busca, expand/collapse, seleção em cascata e salvamento em lote (upsert/delete das duas tabelas em uma ação). Aba "Atribuição de usuários" permanece.
- `src/lib/access-registry.ts`: expor um único builder `permissionTree(areaAllowed)` que junta `menuHierarchy`, `sectionsForMenu` e `deriveFieldRegistry` (campos só sob `/projects`), preservando as exportações atuais.
- `src/lib/access-context.tsx` e `src/lib/access-sections.ts`: sem mudança de semântica; apenas ajustar o fallback permissivo para ser por menu (regras de um menu não escondem abas de outro).
- Sem migração de banco.
