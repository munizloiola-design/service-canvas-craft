# Botão de excluir o arquivo do Material do cliente

Hoje, na seção "Material do cliente" (modal da demanda em Demandas e no modal do Calendário), o arquivo enviado só pode ser baixado ou substituído — não há como removê-lo sem enviar outro. Os anexos de referência já têm botão de excluir; o arquivo do material não.

## O que muda

- Ao lado do botão **Baixar**, aparece um botão de lixeira para excluir o arquivo do material.
- Ao clicar, pede confirmação ("Excluir o arquivo do material?") e então:
  - remove o arquivo do armazenamento;
  - limpa o campo `deliverable_path` da demanda (volta a mostrar o seletor de upload).
- O botão só aparece para quem tem permissão de **edição** do campo Material do cliente (mesma regra `canEdit("deliverable_path")` já usada para o upload); quem só visualiza continua vendo apenas o Baixar.
- Após excluir, o modal e o calendário/demandas atualizam na hora, com aviso de sucesso ou erro.

## Onde

1. `src/routes/_app/projects.tsx` (modal de detalhe da demanda)
2. `src/routes/_app/calendario.tsx` (modal da demanda no calendário)

## Detalhes técnicos

- Nova mutation `removeDeliverable` em cada arquivo: `supabase.storage.from("project-files").remove([path])` seguido de `update projects set deliverable_path = null`.
- Em `projects.tsx`, reaproveitar o `updateField.mutate({ deliverable_path: null })` para limpar o campo e atualizar o estado local; em `calendario.tsx`, atualizar `detail` e invalidar a query `projects-cal`.
- Botão com `variant="outline"` + ícone `Trash2` em `text-destructive`, confirmação via `confirm()` (mesmo padrão do botão de excluir anexos já existente), feedback via `toast` (sonner).
- Sem mudanças de banco ou permissões.
