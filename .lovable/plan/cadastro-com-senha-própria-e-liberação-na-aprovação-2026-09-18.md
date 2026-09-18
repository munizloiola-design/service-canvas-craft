# Cadastro com senha própria e liberação na aprovação

Hoje a pessoa se cadastra sem senha, e só depois da aprovação o sistema gera um link para ela criar a senha. A mudança: a pessoa escolhe a senha no próprio cadastro, e a aprovação apenas libera o acesso.

## Como vai funcionar

1. Nas telas **Cadastro de Cliente** e **Cadastro de Usuário**, entram dois campos: **Senha** e **Confirmar senha** (mínimo 8 caracteres, precisam coincidir).
2. Ao enviar, a conta já é criada com essa senha, porém **bloqueada**. O pedido continua aparecendo em Aprovações como hoje.
3. Se a pessoa tentar entrar antes da aprovação, aparece a mensagem: "Seu cadastro ainda está em análise. Você será avisado quando for aprovado."
4. Em **Aprovações → Aprovar**: a conta é desbloqueada, recebe o nível de acesso (cliente vira cliente e é vinculado à empresa, usuário vira membro) e a pessoa entra com a senha que ela mesma criou. Não há mais link de criação de senha nessa etapa.
5. Em **Aprovações → Rejeitar**: a conta continua bloqueada e o motivo é registrado como hoje.
6. Se o e-mail já existir no sistema, o cadastro avisa: "Já existe uma conta com este e-mail. Use a opção Entrar ou Esqueci minha senha."

## O que continua igual

- A tela de Aprovações, os filtros Pendentes/Aprovados/Rejeitados e o fluxo de revisão.
- O botão "Esqueci minha senha" no login e a tela de criar nova senha (usada em recuperação).
- A criação manual de colaboradores pela equipe (Equipe/Squad) continua gerando link de criação de senha.

## Detalhes técnicos

- Novo server function público `submitRegistration` (`src/lib/registration.functions.ts`, sem `requireSupabaseAuth`), validado com Zod: tipo, nome, e-mail, empresa, telefone, observações, senha.
  - Usa `supabaseAdmin` (import dinâmico dentro do handler) para `auth.admin.createUser({ email, password, email_confirm: true })` e em seguida `auth.admin.updateUserById(uid, { ban_duration: '876000h' })` para bloquear até a aprovação.
  - Insere a linha em `pending_registrations` com `status: 'pending'` e guarda o `user_id` criado.
  - Não atribui nenhum papel em `user_roles` nesta etapa.
- Migração: coluna `pending_registrations.auth_user_id uuid` (nullable, referência lógica ao usuário criado). Sem alteração de RLS; o INSERT público direto pelas telas de cadastro deixa de ser usado (passa pelo server function).
- `approveRegistration` (`src/lib/approvals.functions.ts`): quando `auth_user_id` existir, pula `createUser`/`generateLink`, chama `updateUserById(uid, { ban_duration: 'none' })`, grava papéis, cria o `clients`/`client_users` para tipo cliente e atualiza `profiles` sem `password_setup_link`. Registros antigos sem `auth_user_id` seguem o caminho atual (link de senha), preservando compatibilidade.
- `rejectRegistration`: mantém o usuário banido (nenhuma ação extra além do status).
- `src/routes/cadastro.cliente.tsx` e `src/routes/cadastro.usuario.tsx`: trocam o insert direto por `useServerFn(submitRegistration)`, acrescentam os campos de senha e tratam o erro de e-mail duplicado.
- `src/routes/login.tsx`: ao falhar o login, se a mensagem indicar usuário banido, exibir o aviso de cadastro em análise.
