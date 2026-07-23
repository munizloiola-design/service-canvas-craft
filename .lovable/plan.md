## Objetivo

Permitir editar o nome dos times no menu **Squad → Times**.

## Situação atual

Em `src/routes/_app/squad.tsx`, o diálogo de time (`TeamDialog`) não expõe um campo para o nome:

- Linha 200: `teamName` é uma constante derivada de `editing?.name` ou de um timestamp para novos times.
- O formulário salva sempre esse valor fixo, então não é possível renomear um time existente nem escolher o nome de um novo time.

O backend já suporta: a mutação em `onSubmit` faz `teams.update({ name })` quando `editing` existe, e `teams.insert({ name })` quando é novo. Falta apenas a UI.

## Mudanças

Arquivo único: `src/routes/_app/squad.tsx`

1. Trocar a constante `teamName` por um `useState<string>` inicializado com `editing?.name ?? ""` (ou com o timestamp padrão só como placeholder do input).
2. Adicionar um campo `<Label>Nome do time</Label><Input value={teamName} onChange=... />` no topo do formulário do `TeamDialog`.
3. Validar no submit: se `teamName.trim()` estiver vazio, mostrar `toast.error("Informe o nome do time")` e não chamar `onSubmit`.
4. Garantir que ao reabrir o diálogo (troca de `editing`) o estado do nome seja reiniciado — usar `key={editing?.id ?? "new"}` no `TeamDialog` no ponto de uso, ou um `useEffect` que ressincroniza quando `editing?.id` muda.

Sem alterações de schema, RLS ou outros arquivos.

&nbsp;

Verifique porque o relatório de times ainda não está funcionando