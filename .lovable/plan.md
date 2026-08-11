# Link de aprovação deve levar à tela de criar senha

Hoje, ao aprovar um cadastro (cliente ou agência/usuário), o sistema gera um link de recuperação sem destino definido. Ao abrir, a pessoa cai na página inicial em vez da tela onde define a senha.

## O que muda

- O link gerado na aprovação passa a apontar para a tela **/set-password** ("Definir nova senha"), tanto para cadastro de cliente quanto para cadastro de usuário/agência.
- O mesmo vale para o link criado ao cadastrar um usuário interno pela equipe e para o botão de gerar link novamente.
- Textos ajustados de "link para redefinir" para "link para criar senha", mantendo a validade de 24 horas.

## Detalhes técnicos

- `src/lib/approvals.functions.ts`: adicionar um campo opcional `base_url` (validado como URL) nos inputs de `approveRegistration`, `createTeamUser` e `regeneratePasswordLink`, e passar `{ redirectTo: `${base_url}/set-password` }` nas chamadas de `generateLink`. Sem `base_url`, usar o domínio público do projeto como padrão.
- Chamadores enviam `base_url: window.location.origin`:
  - `src/routes/_app/aprovacoes.tsx` (aprovar cadastro)
  - telas que usam `createTeamUser` / `regeneratePasswordLink` (Squad/Equipe e Perfis e Acessos)
- Tipo do link continua `recovery` (o usuário já é criado antes), o que funciona normalmente na tela `/set-password`, que valida a sessão do link e chama `updateUser({ password })`.
- Ajuste de textos no modal `PasswordLinkModal` para "criar senha".
