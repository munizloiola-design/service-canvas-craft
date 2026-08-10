# Simplificar a Atribuição de usuários

Hoje a aba mistura duas coisas que parecem a mesma:

- **Papel principal** (Administrador / Gerente / Membro) — define o poder hierárquico: quem enxerga tudo, quem pode gerenciar outros.
- **Cargo / subfunção** (Área › Especialidade, ex.: "Social Media › Designer") — é o que realmente libera menus, abas e campos na aba Permissões.

As duas continuam sendo necessárias (a subfunção é o que alimenta toda a árvore de permissões), mas a tela pode deixar claro que uma é "nível" e a outra é "o que a pessoa faz".

## Proposta

Uma única linha por pessoa, com duas perguntas em linguagem simples:

```text
Ana Souza
  Nível de acesso:  ( ) Administrador  ( ) Gerente  (x) Colaborador
  Função:           [ Social Media › Designer  x ]  [+ adicionar função]
```

1. **"Papel principal" vira "Nível de acesso"**, com 3 opções e uma frase curta embaixo:
   - Administrador — acesso total, ignora as permissões por função.
   - Gerente — vê todas as demandas e relatórios da agência.
   - Colaborador — vê só o que a função dele libera.
2. **"Adicionar cargo" vira "Função"**, mostrado como chips (Área › Especialidade) com um botão "+ adicionar função". Some o segundo dropdown solto.
3. **Ao escolher Administrador ou Gerente**, o bloco de funções fica recolhido com o aviso "acesso total — não depende de função", já que as regras da árvore não limitam esses níveis. Continua possível expandir e atribuir uma função (útil só para relatórios e times).
4. **Colaborador sem função** ganha um alerta visível ("sem acesso a nenhum menu — escolha uma função") em vez do texto neutro atual.
5. **Lista com busca e agrupamento** por nível (Administradores, Gerentes, Colaboradores), cards mais compactos, em vez de todos em blocos iguais.

Nada muda no banco nem nas regras de acesso: continua sendo `user_roles` (nível) + `user_specialties` (função). É só a leitura da tela que fica direta.

## Detalhes técnicos

- Arquivo único: `src/routes/_app/acessos.tsx`, componente `AssignTab`.
- Mantém as mutations `setRole`, `assign`, `unassign` e as queries existentes.
- "Adicionar função" passa a ser um `Popover`/`Command` com busca, agrupado por Área, no lugar do `Select` largo.
- Regras de hierarquia atuais (`ROLE_RANK`, `canManageRole`) permanecem: você só atribui níveis abaixo do seu.
- Rótulos: Administrador / Gerente / Colaborador (o valor no banco segue `admin` / `gerente` / `membro`).
- O link `\/acessos?tab=assign&user=…` da tela Equipe continua funcionando e faz scroll até a pessoa.
