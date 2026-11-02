# Duplicar demanda

## O que o usuário verá
- Novo botão **Duplicar** (ícone de cópia) ao lado de "Excluir" na lista de demandas e dentro do modal da demanda.
- Ao clicar, abre uma confirmação rápida com opções:
  - Copiar responsáveis (marcado por padrão)
  - Copiar anexos de referência (desmarcado por padrão)
- A cópia é criada com o título "Cópia de <título>" e abre logo em seguida para edição.

## O que é copiado
- Título (com prefixo "Cópia de"), descrição, cartões de descrição, legenda, empresa, equipe, tipo de mídia, links de referência, observações e prioridade.
- Responsáveis com suas funções (se marcado).
- Anexos de referência (se marcado) — o arquivo é copiado, não só referenciado, para que excluir um não apague o outro.

## O que NÃO é copiado (começa do zero)
- Fase: volta para a primeira etapa.
- Datas de entrega e postagem: ficam vazias, para obrigar novo prazo (evita nascer já atrasada).
- Entregas finais, link final, comentários, histórico de fases, tempo registrado e decisão do cliente.

## Quem pode duplicar
- As mesmas pessoas que hoje podem criar demandas.

## Detalhes técnicos
- Lógica em `src/lib/duplicate-project.ts` (insert em `projects`, `project_assignees`, `project_media_types`; cópia de storage para `project_attachments`), chamada de `src/routes/_app/projects.tsx` (lista e modal) e do modal do calendário.
- Sem mudança no banco; usa as permissões atuais.
- Invalida as queries de projetos após criar.
