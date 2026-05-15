# Envio real de e-mails de aprovação/recusa de tickets

Hoje `notifyDecision` em `src/routes/_app/tickets.tsx` apenas faz `console.info`. Vamos plugar o envio de verdade usando a infra de e-mails transacionais da Lovable (domínio `notify.digcomunicacao.com.br` já configurado).

## O que será feito

1. **Scaffold de e-mails transacionais**
   - Cria server route `/lovable/email/transactional/send`, página `/unsubscribe`, tabelas de suppression/unsubscribe e registry de templates.
   - Cria helper `src/lib/email/send.ts` com `sendTransactionalEmail(...)`.

2. **Dois templates React Email** em `src/lib/email-templates/`
   - `ticket-approved.tsx` — assunto: "Sua solicitação foi aprovada · {brand}". Conteúdo: saudação ao solicitante, título da demanda, mensagem de aprovação e botão "Acompanhar projeto" (link público `/v/{token}` quando o token do projeto criado existir; se não existir, omite o botão).
   - `ticket-rejected.tsx` — assunto: "Sua solicitação não foi aprovada · {brand}". Conteúdo: título da demanda + bloco com o **motivo da recusa** (`review_notes`).
   - Ambos carregam logo + cor primária de `app_branding` (passados via `templateData`).
   - Registrados em `src/lib/email-templates/registry.ts`.

3. **Substituir `notifyDecision`** em `src/routes/_app/tickets.tsx`
   - Após aprovar: buscar `client_token` do projeto recém-criado e chamar `sendTransactionalEmail({ templateName: 'ticket-approved', recipientEmail: t.requester_email, idempotencyKey: 'ticket-' + t.id + '-approved', templateData: { name, title, brandName, brandLogoUrl, primaryColor, trackUrl } })`.
   - Após recusar: chamar com `ticket-rejected` e `templateData.reviewNotes = note`.
   - Remover o `console.info` e o TODO.
   - Manter o estado da tabela `email_templates` apenas como referência editável futura (sem usar agora para o envio real — fica claro no código).

4. **Aviso na UI**
   - O texto que já avisa "ao aprovar/recusar, um e-mail será enviado para …" passa a ser verdade. Sem alteração visual.

## Detalhes técnicos

- `SENDER_DOMAIN` baked-in: `notify.digcomunicacao.com.br` (não confundir com `FROM_DOMAIN`).
- `idempotencyKey` previne duplicidade em re-tentativas/cliques duplos.
- Tratamento de erro: o envio é best-effort. Se falhar, mostra `toast.warning("Ticket atualizado, mas o e-mail não foi enviado")` — o status do ticket não é revertido (o e-mail entra na fila e tem retry automático).
- Endereços já em `suppressed_emails` (bounces/unsubscribes) são bloqueados automaticamente pelo server route.
- Rodapé de unsubscribe é adicionado automaticamente pelo sistema — templates não incluem opt-out.

## Arquivos tocados

- Novos: `src/lib/email/send.ts`, `src/lib/email-templates/ticket-approved.tsx`, `src/lib/email-templates/ticket-rejected.tsx`, `src/routes/unsubscribe.tsx`, mais arquivos gerados pelo scaffold (`send-transactional-email`, `handle-email-unsubscribe`, `handle-email-suppression`, `registry.ts`).
- Editados: `src/routes/_app/tickets.tsx` (função `notifyDecision`).

## Fora do escopo

- E-mail de aprovação/recusa do **cliente final** no fluxo `/v/{token}` (decisão do projeto, não do ticket). Fica para depois.
- Edição visual dos templates pela tela de Personalização. Por ora os templates vivem no código e puxam logo/cor da marca via `app_branding`.
