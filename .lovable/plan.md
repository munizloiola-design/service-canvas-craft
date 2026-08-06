# Agrupar menus e submenus na seleção de Especialidade

## O que muda

Na tela **Perfis e Acessos**, ao configurar o que uma Especialidade pode ver (botão de engrenagem da especialidade), o campo **Menu** hoje é uma lista plana com todos os menus do sistema.

Passa a ser:

1. **Agrupado por menu principal** — cada menu pai aparece com seus submenus recuados logo abaixo. Exemplo:

```text
Cliente
  Clientes
    └ CRM Prospecção
Squad
  Times
    └ Relatório do Squad
```

2. **Só menus liberados** — a lista mostra apenas os menus já liberados em "Menus visíveis" para a Área dessa Especialidade. Menus bloqueados para a Área não aparecem (não faz sentido configurar seções de um menu que a Área não acessa).

3. Se a Área ainda não tem nenhum menu liberado, a lista fica vazia com o aviso "Libere menus para esta Área primeiro".

4. O menu selecionado por padrão passa a ser o primeiro menu liberado da Área.

A mesma lógica de hierarquia (pai › submenu recuado) também é aplicada ao seletor "Liberar menu" dentro do diálogo de Menus visíveis, para manter a leitura consistente.

## Detalhes técnicos

- `src/lib/access-registry.ts`: adicionar helper que monta a hierarquia a partir de `MENU_REGISTRY`, usando o prefixo da chave (`/clientes` é pai de `/clientes/crm`); menus sem pai ficam na raiz do seu `group`.
- `src/routes/_app/acessos.tsx`:
  - passar `areaId` para `FieldVisibilityDialog` (já disponível na lista de especialidades da área);
  - consultar `area_menu_visibility` da área e filtrar a hierarquia por essas chaves (mantendo o pai visível quando só o filho está liberado, apenas como rótulo não selecionável);
  - renderizar o `Select` com `SelectGroup`/`SelectLabel` por grupo e indentação para submenus;
  - ajustar o estado inicial de `menu` para o primeiro item liberado.
- Sem mudanças de banco de dados; nada muda na forma como as permissões são gravadas.
