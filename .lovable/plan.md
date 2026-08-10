# Corrigir perda de permissão de Administrador (sessão expirada)

## O que está acontecendo

No banco, `munizloiola@gmail.com` está corretamente como **Administrador** (papel `admin`) e com a especialidade **Administração › Total**.

O problema está na sessão do navegador: verifiquei a aba aberta e o token de acesso está **expirado**. Todas as consultas ao backend retornam "JWT expired". Como o app carrega os papéis sem tratar erro, ele simplesmente fica com a lista de papéis vazia — e, sem papel, a tela assume "Colaborador/membro" e esconde os menus de administrador. É por isso que você aparece como membro na lista lateral.

Solução imediata: sair e entrar novamente resolve a visualização. O plano abaixo evita que isso volte a acontecer.

## O que será feito

1. **Renovação automática de sessão**
   - Ao detectar falha de autorização (token expirado) na carga de papéis, tentar renovar a sessão e recarregar os papéis.
   - Se a renovação falhar, encerrar a sessão e mandar para o login com aviso claro ("Sua sessão expirou, entre novamente") em vez de deixar o usuário logado sem permissões.

2. **Nunca rebaixar silenciosamente o usuário**
   - Se a leitura de papéis falhar, manter os papéis anteriores e marcar o estado como "não carregado", em vez de virar lista vazia (que hoje equivale a membro).
   - Recarregar papéis também quando o token for renovado (evento de refresh) e ao voltar o foco na aba.

3. **Lista de usuários em Perfis e Acessos**
   - Quando a consulta de papéis falhar, mostrar um aviso de erro e "—" no lugar de rotular todo mundo como "Colaborador".

## Detalhes técnicos

- `src/lib/auth-context.tsx`: `loadRoles` passa a inspecionar `error`; em erro de auth chama `supabase.auth.refreshSession()` e repete uma vez; em falha definitiva chama `signOut()`. Assinar também `TOKEN_REFRESHED` para recarregar papéis; não zerar `roles` em erro.
- `src/routes/_app/acessos.tsx` (`AssignTab`): usar `rolesQ.isError` para exibir alerta e fazer `roleOf` retornar indefinido em vez do fallback `"membro"`.
- Sem alterações de banco de dados; as políticas de `user_roles` já permitem leitura própria e de gestores.
