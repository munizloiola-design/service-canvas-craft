## Reorganização do menu lateral em categorias com submenus

Hoje o menu em `src/routes/_app.tsx` é uma lista plana de 14 itens. Vou agrupá-los em categorias colapsáveis usando o componente `Collapsible` (já disponível) dentro do sidebar atual, sem trocar o layout geral.

### Proposta de agrupamento

```text
Dashboard

Operação
  ├─ Projetos
  ├─ Tickets
  ├─ Calendário
  └─ Equipamentos

Financeiro
  ├─ Financeiro
  └─ Orçamento

Marketing
  ├─ Facebook Ads
  └─ Diguinho IA

Equipe

Configurações
  ├─ Cadastros
  ├─ Integrações
  ├─ Personalização
  └─ Permissões (admin)
```

### Como vai funcionar

- Cada categoria vira um cabeçalho clicável (com chevron) que expande/recolhe os itens filhos.
- A categoria que contém a rota ativa abre automaticamente ao carregar.
- Categorias sem itens visíveis (por permissão) somem inteiras — nada de cabeçalho vazio.
- Visual: cabeçalho em `text-xs uppercase tracking-wide text-sidebar-foreground/50`, itens filhos com leve recuo (`pl-3`) mantendo o mesmo estilo de hover/active de hoje.
- Mobile (Sheet) usa exatamente a mesma estrutura — sem mudanças adicionais.

### Detalhes técnicos

- Editar apenas `src/routes/_app.tsx`:
  - Substituir o array plano `navItems` por uma estrutura `navGroups: { label, items: NavItem[] }[]`.
  - Filtrar itens por `can(resource, 'view')` + `adminOnly` antes de renderizar o grupo; pular grupos vazios.
  - Renderizar cada grupo com `Collapsible` / `CollapsibleTrigger` / `CollapsibleContent` (`@/components/ui/collapsible`, já no projeto).
  - `defaultOpen` do grupo = `group.items.some(i => pathname.startsWith(i.to))`.
- Nenhuma alteração em rotas, permissões, portal do cliente ou backend.

Posso confirmar e implementar?