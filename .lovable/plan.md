# Por que "Empresa" e "Responsáveis" não aparecem — e revisão dos campos em Permissões

## 1. Diagnóstico (confirmado no banco)

As permissões estão corretas: para Designer, Social Media e Vídeomaker, os itens **Cliente (client_id)** e **Responsáveis (assignees)** estão com "Ver" ligado. O problema não é Perfis e Acessos — é regra de acesso ao banco.

- Tabela de **clientes**: só administradores/gerentes (ou o próprio cliente do portal) podem ler. Um colaborador não consegue ler nenhum cliente, então o nome da empresa vem vazio no card, na lista e no detalhe da demanda, e o seletor "Cliente" no formulário fica vazio.
- Tabela de **perfis (pessoas)**: cada usuário só lê o próprio perfil; a leitura ampla é exclusiva de gerentes. Por isso a lista de "Responsáveis" não mostra nomes (aparece "?" ou vazio) e o seletor de pessoas no formulário fica vazio.

## 2. Correção proposta

Liberar leitura mínima para usuários internos (colaboradores da agência), mantendo os clientes do portal isolados como hoje:

- Colaborador interno passa a **ler a lista de clientes** (para exibir o nome da empresa e escolher no formulário). Criar/editar/excluir cliente continua só para gerentes/admins.
- Colaborador interno passa a **ler os perfis dos colegas internos** (nome, cargo, avatar), o suficiente para exibir e escolher responsáveis. Perfis de usuários do portal do cliente continuam fora, e edição continua restrita.
- Nada muda para quem entra pelo portal do cliente: continua vendo apenas o próprio cliente e o próprio perfil.

## 3. Revisão: todos os dados da demanda em Permissões

A árvore de Permissões já lista todas as colunas reais da demanda (inclusive Título, Etapa, Equipe responsável, Data de início, Tipo de serviço, Cards de descrição, Decisão do cliente). O que falta é o **efeito prático**: alguns desses itens podem ser marcados/desmarcados mas não mudam nada na tela, e o "Editar" hoje não é aplicado em lugar nenhum.

Itens sem efeito hoje: Título, Etapa, Responsáveis, Equipe responsável, Data de início, Tipo de serviço, Cards de descrição, Decisão do cliente, Possui referência, Nome do cliente (legado).

Ajustes:
- Aplicar "Ver" nos que fazem sentido esconder: Responsáveis, Equipe responsável, Data de início, Decisão do cliente, Cards de descrição (no formulário, no detalhe, no card do Kanban e na lista).
- Aplicar "Editar": campo com "Ver" e sem "Editar" passa a aparecer em modo somente leitura no formulário da demanda (hoje aparece editável).
- Remover da árvore os itens que não existem na interface e só confundem: Nome do cliente (legado), Tipo de serviço, Possui referência (é um automático dos links de referência). Título e Etapa continuam sem chave de permissão (a demanda não existe sem eles).
- Regra atual mantida: função sem nenhuma regra cadastrada continua vendo tudo.

## Detalhes técnicos

- Migração: novas políticas de SELECT em `public.clients` e `public.profiles` para usuários internos (não presentes em `client_users`), usando função `security definer` para evitar recursão; políticas existentes preservadas.
- `src/routes/_app/projects.tsx`: aplicar `canSee`/`canEdit` nos blocos de Responsáveis, Equipe responsável, Data de início, Decisão do cliente e Cards de descrição; modo somente leitura quando `canEdit` for falso; incluir `assignees`/`team_id` no mapa de campos omitidos ao salvar.
- `src/lib/access-registry.ts`: incluir `client_name`, `service_type`, `has_reference` na lista de campos internos (fora da árvore).
- `src/lib/field-visibility.tsx`: acrescentar as chaves novas ao tipo `ProjectFieldKey`.
