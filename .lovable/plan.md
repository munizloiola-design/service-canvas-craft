
## Mover "CRM Prospecção" para o menu Cliente

### 1. Nova rota `/clientes/crm`
- Criar `src/routes/_app/clientes.crm.tsx` como rota separada que renderiza a UI de prospecção já existente.
- Exportar `CrmTab` de `src/routes/_app/clientes.tsx` (mudar `function CrmTab` → `export function CrmTab`) e importar no novo arquivo.
- Envolver em um wrapper simples de página (título "CRM Prospecção" + subtítulo curto), mantendo o layout `.max-w-7xl mx-auto p-4 md:p-8` já usado nas outras rotas.

### 2. Remover a aba "CRM" do `/clientes`
- Em `src/routes/_app/clientes.tsx`, remover o `<TabsTrigger value="crm">` e o `<TabsContent value="crm">`, deixando só Diretório, Acessos, Briefing e Projetos.
- Ajustar o grid dos triggers de `grid-cols-5` para `grid-cols-4`.

### 3. Menu lateral
- Em `src/routes/_app.tsx`, adicionar novo item ao grupo **Cliente**:
  - `{ to: "/clientes/crm", label: "CRM Prospecção", icon: Sparkles, resource: "clientes_area" }`
- Adicionar `Sparkles` ao import de `lucide-react` se ainda não estiver.
- Manter o item "Clientes" (que continua abrindo `/clientes` no Diretório).

### Escopo
Nenhuma alteração de banco, permissões ou lógica do CRM em si. Só refatoração de rota, remoção da aba e adição de link no menu.
