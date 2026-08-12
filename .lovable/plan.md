# Modal da demanda no Calendário: mídia, referências, material e bate-papo

Hoje o modal aberto ao clicar numa demanda no Calendário mostra apenas etapa, cliente, prazo, postagem, descrição, direção de arte e legenda. Passará a mostrar também:

## O que entra no modal

1. **Tipo de mídia** — exibido como selo ao lado de etapa e cliente.
2. **Referências** — lista de links de referência clicáveis (abrem em nova aba) e os anexos de referência da demanda, com botão de download.
3. **Material do cliente** — se houver arquivo entregável, botão "Baixar"; se houver link finalizado, link clicável. Somente leitura (upload continua em Demandas).
4. **Bate-papo** — o mesmo chat da tela de Demandas, com comentários e envio de mensagem, no fim do modal.

Comportamento mantido: o modal continua rolando internamente com cabeçalho e rodapé fixos, e o botão "Abrir em Demandas" segue no rodapé. Cada bloco só aparece quando o usuário tem permissão para ver aquele campo (Perfis e Acessos) e quando há conteúdo.

## Detalhes técnicos

Arquivo: `src/routes/_app/calendario.tsx`.

- Ampliar o `select` da query `projects-cal` com `media_type_id, reference_links, deliverable_path, final_link`, e ajustar o tipo `Project`.
- Nova query `media_types` (id, name) para o rótulo do tipo de mídia.
- Query condicional `project_attachments` filtrada por `project_id` do detalhe aberto (`enabled: !!detail`).
- Download via `supabase.storage.from("project-files").createSignedUrl(path, 60)`, mesmo padrão já usado em `projects.tsx`/`portal/calendario.tsx`.
- Reutilizar `ProjectChat` de `@/components/ProjectChat` passando `projectId={detail.id}`.
- Usar `useFieldVisibility().canSee` para `media_type`, `reference_links`, `deliverable_path` e `final_link`.
- Sem alterações de banco, RLS ou de outras telas.
