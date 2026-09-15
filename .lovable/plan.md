# Responsáveis não salvam ao editar a demanda (Social Media / gerência)

## O que eu confirmei

Verifiquei no banco e no código, e o problema **não é permissão**:

- Em Perfis e Acessos, a função **Social Media** tem "Responsáveis" com **Ver** e **Editar** liberados (Designer e Vídeomaker estão só como "Ver").
- As regras de gravação do banco permitem incluir/remover responsáveis para quem tem o menu Demandas liberado — e a área "Geral" (onde Social Media está) libera esse menu. Quem é gerente também passa por outra regra.

O que sobra é o **modo como a tela salva os responsáveis**: ao salvar, o sistema primeiro **apaga todos** os responsáveis da demanda e depois **regrava a lista**. Se a regravação falhar, a demanda fica **sem nenhum responsável** e aparece só um aviso genérico de erro — exatamente a sensação de "não edita o responsável".

Duas coisas fazem a regravação falhar:
- a mesma pessoa aparecer duas vezes na lista com o mesmo cargo (inclusive com cargo em branco);
- um cargo que foi renomeado/excluído no cadastro e ficou preso na linha antiga.

Como a causa exata ainda não foi capturada na tela do usuário, o primeiro passo do plano é mostrar o erro real em vez de escondê-lo.

## O que será feito

1. **Mostrar o erro de verdade**: quando o salvamento dos responsáveis falhar, exibir a mensagem real do banco no aviso, em vez de um texto genérico.
2. **Salvar sem apagar antes**: comparar a lista atual com a nova e aplicar só as diferenças (remover quem saiu, incluir quem entrou). Assim, se algo der errado, a demanda nunca fica sem responsáveis.
3. **Impedir duplicidade na tela**: não permitir escolher a mesma pessoa duas vezes com o mesmo cargo; a opção já usada some do seletor.
4. **Cargos inválidos**: se o cargo escolhido não existir mais no cadastro, gravar sem cargo em vez de falhar.
5. **Conferir na prática**: entrar como um usuário Social Media com nível gerência, editar os responsáveis de uma demanda e confirmar que a alteração persiste após recarregar.

Nada muda nas permissões nem nas regras de acesso.

## Detalhes técnicos

- `src/routes/_app/projects.tsx` (fluxo de salvar em `NewDemandDialog`, linhas ~1045-1065): substituir o `delete` incondicional + `insert` por um diff entre os `project_assignees` atuais e os selecionados; `delete` apenas das linhas removidas (`.in("id", removedIds)`) e `insert` apenas das novas; propagar `error.message` do Supabase no toast.
- Deduplicar `assignees` por `user_id + role_id` antes do envio e filtrar `role_id` que não existam na lista de `project_roles` carregada.
- Nos seletores de responsável (linhas ~1199-1203), ocultar usuários já escolhidos com o mesmo cargo.
- Sem migração de banco; sem alteração em `specialty_field_visibility` nem nas policies.
