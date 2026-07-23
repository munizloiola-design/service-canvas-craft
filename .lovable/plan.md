
## Refatoração de `src/routes/_app/clientes.tsx` (aba Diretório)

### 1. Tipagem `Client`
Adicionar:
- `team_id?: string | null;`
- `teams?: { name: string } | null;`

### 2. `useClients`
Trocar o select por `select("*, teams(name)")` (mantendo `.order("name")`) e retornar como `Client[]`.

### 3. Remover `useDefaultClientTeams`
Excluir a função e todas as referências (`teamNameByClient`, `useDefaultClientTeams` import de resultado).

### 4. Novo hook `useTeams`
```ts
function useTeams() {
  return useQuery({
    queryKey: ["teams", "options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });
}
```

### 5. Tabela
- Substituir `teamNameByClient.get(r.id)` por `r.teams?.name ?? null` para renderizar o badge "Time padrão".
- Remover o `const tn = ...` e usar diretamente na célula.

### 6. Formulário do Dialog
- Em `DirectoryTab`, chamar `useTeams()` e adicionar um estado `const [teamId, setTeamId] = useState<string>("none")`.
- No `openNew`/`openEdit`, resetar `teamId` para `editing?.team_id ?? "none"`.
- Abaixo do campo E-mail, adicionar um `<Select>` "Time responsável" listando os times, com opção "Sem time" (value `"none"`).
- Ajustar o texto informativo abaixo do form (atualmente diz que times são gerenciados em Squad → Times de Cliente) para refletir que agora o time é escolhido diretamente aqui.

### 7. Mutation `save`
Adicionar `team_id: teamId === "none" ? null : teamId` ao payload enviado ao Supabase, mantendo os demais campos.

### Escopo
Alterações limitadas à aba `DirectoryTab` e às funções compartilhadas `useClients` / tipagem `Client`. Nenhuma alteração no CRM, no banco de dados, em RLS, ou em outras abas/rotas.
