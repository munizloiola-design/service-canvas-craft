# Material do cliente editável no modal do calendário

O modal da demanda no calendário já mostra tipo de mídia, referências e bate-papo. Falta tornar o bloco "Material do cliente" interativo.

## O que muda

- A seção "Material do cliente" passa a aparecer sempre que o usuário tiver permissão de visualizar (hoje ela some quando não há arquivo nem link).
- Com permissão de edição:
  - Campo de link do material: input com botão Salvar (grava o link final da demanda).
  - Anexar arquivo: seletor de arquivo que envia o material e passa a exibir o botão Baixar; opção de substituir o arquivo enviado.
- Sem permissão de edição: continua somente leitura (baixar arquivo / abrir link).
- Sem permissão de visualização: seção não aparece.

## Detalhes técnicos

- Arquivo: `src/routes/_app/calendario.tsx`.
- Usar `useFieldVisibility` com `canSee`/`canEdit` para os campos `deliverable_path` e `final_link`, mesmo padrão de `src/routes/_app/projects.tsx`.
- Upload para o bucket `project-files` e atualização de `projects.deliverable_path`; link salvo em `projects.final_link`.
- Após salvar/enviar, invalidar a query `projects-cal` para refletir no modal e no calendário.
- Estados locais de link e de envio, com feedback via toast (sonner) em erro/sucesso.
