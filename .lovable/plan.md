# Corrigir erro ao cadastrar demanda

Ao salvar uma demanda aparece "Cannot read properties of undefined (reading 'rest')".

## Causa

Em `src/lib/project-media-types.ts`, as chamadas ao banco são feitas com a função `from` "solta" (`const from = supabase.from as any` e `(supabase.from as any)(...)`). Ao chamar assim, a função perde a referência ao cliente e tenta ler uma propriedade interna (`rest`) de algo indefinido — exatamente o erro exibido. Isso acontece nas três chamadas do arquivo: leitura dos tipos de mídia, exclusão e inserção durante o salvamento.

## Correção

- Em `src/lib/project-media-types.ts`, usar sempre `supabase.from("project_media_types")` diretamente (mantendo o cast de tipo apenas no resultado), nas funções `useProjectMediaTypes` e `syncProjectMediaTypes`.
- Depois do ajuste, validar no preview: cadastrar uma demanda com dois tipos de mídia e conferir que salva, que as etiquetas aparecem no Kanban/lista/modal e que o filtro por tipo de mídia funciona.

Sem mudanças de banco, permissões ou layout.
