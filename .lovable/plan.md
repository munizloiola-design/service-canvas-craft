# Revisão das tabelas após a atualização

Fiz uma varredura completa no banco (estrutura, permissões, proteções de acesso e consistência dos dados). A boa notícia: **nenhum dado está corrompido e nenhum cadastro está quebrado hoje**.

## O que está correto

- Nenhum registro órfão ou inválido: demandas, responsáveis, tipos de mídia, clientes, contatos extras, briefing e senhas de rede social estão todos consistentes.
- Todas as tabelas estão protegidas e com regras de acesso ativas.
- Os dados sensíveis da equipe (documento, endereço, custo por hora, comissão) continuam restritos a gestores e ao próprio colaborador, e o nome/foto seguem visíveis para todos — as telas de demandas, chat, calendário e orçamento leem pela lista reduzida, que está funcionando.
- Novos campos (contatos adicionais da empresa, redes sociais, referências de pesquisa) estão com o formato correto em 100% dos registros.

## Riscos encontrados (pequenos, mas vale corrigir)

1. **Responsável duplicado na demanda**
   Hoje o sistema só impede repetir a mesma pessoa quando ela tem uma função escolhida. Se a função ficar em branco, a mesma pessoa pode ser lançada duas vezes na mesma demanda.

2. **Cópia de segurança antiga em "Perfis e Acessos"**
   Essa tela tem um caminho alternativo que lê o cadastro antigo da equipe. Ele ainda funciona, mas ficou obsoleto depois da mudança de privacidade e pode gerar erro confuso no futuro.

3. **Regras de leitura da equipe que nunca mais são usadas**
   Sobraram três regras antigas no cadastro da equipe que hoje não têm efeito nenhum. Manter regras mortas dificulta entender quem enxerga o quê.

4. **Edição do cadastro da equipe só para administradores**
   Gerentes veem os dados completos do colaborador, mas não conseguem salvar alterações. Precisa confirmar se isso é o desejado.

## O que proponho fazer

1. Impedir responsável repetido na mesma demanda mesmo quando a função está em branco (ajuste no banco, sem apagar nada).
2. Remover o caminho antigo de leitura da equipe em "Perfis e Acessos", deixando só o atual.
3. Limpar as regras de acesso obsoletas do cadastro da equipe.
4. Item 4 (gerente poder editar colaborador) fica pendente da sua decisão — só mexo se você pedir.

## Detalhes técnicos

- `project_assignees`: criar índice único parcial `(project_id, user_id) WHERE role_id IS NULL`, complementando o `UNIQUE (project_id, user_id, role_id)` existente (NULL não deduplica).
- Verificado: 0 duplicatas atuais, 0 órfãos em `project_assignees`, `project_media_types`, `client_social_secrets`, `user_specialties`; `clients.contacts`, `client_briefings.redes_sociais` e `referencias_pesquisa` sempre `jsonb` array.
- `profiles`: `SELECT` revogado a nível de tabela, mas com grants por coluna (id, full_name, job_title, avatar_url, phone, created_at, updated_at) — por isso a view `internal_profiles` (`security_invoker=true`) funciona. As policies `profiles_select_own`, `profiles_select_internal` e `profiles_select_managers` ficaram sem efeito prático e podem ser removidas.
- `src/routes/_app/acessos.tsx` (~linha 387): remover o fallback `supabase.from("profiles")`.
- Policies públicas existentes (`app_branding`, `media_types` para `anon`) são intencionais para os formulários públicos — mantidas.
