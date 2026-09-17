# Múltiplos contatos no cadastro da empresa (Clientes)

## O que muda

No cadastro/edição de cliente (aba Diretório de `/clientes`), os campos únicos de contato (Contato, Telefone, E-mail) passam a ser o **contato principal**, e surge a área **"Outros contatos"** com botão **"+ Adicionar contato"**:

- Cada clique adiciona uma linha com: **Nome**, **Cargo/Função** (opcional), **Telefone/WhatsApp** e **E-mail**.
- Cada linha tem botão de **remover** (ícone de lixeira).
- É possível adicionar quantos contatos forem necessários; todos são salvos junto com a empresa.

## Onde os contatos aparecem

- **Diretório (tabela):** continua mostrando o contato principal; um pequeno selo "+2" indica contatos extras.
- **Detalhe/edição:** abre com todos os contatos preenchidos para editar, adicionar ou remover.
- **Botão WhatsApp no CRM:** ao clicar, se houver mais de um contato com telefone, abre uma lista para escolher para quem enviar.

## Detalhes técnicos

- **Banco:** nova coluna `contacts jsonb not null default '[]'` em `public.clients` (migration aditiva, sem risco; coluna armazena array de `{ name, role, phone, email }`). Sem tabela nova, sem mudança de RLS — as políticas de `clients` já cobrem.
- **Front (`src/routes/_app/clientes.index.tsx`):**
  - Componente `ContactsEditor` com estado local (lista de contatos), botão "+ Adicionar contato" e remoção por linha.
  - Submit passa a montar o objeto com `contacts` serializado junto ao save.
  - Tabela do Diretório: selo "+N" ao lado do contato principal quando houver extras.
  - `clients` type local atualizado com `contacts`.
- **CRM (`clientes.crm.tsx`):** botão WhatsApp usa o telefone principal; se houver contatos extras com telefone, mostra menu para escolher o destinatário.
- Compatibilidade: registros antigos sem a coluna preenchida funcionam normalmente (contato principal mantido nos campos atuais).

## Verificação

- Cadastrar nova empresa com 3 contatos, salvar, reabrir e confirmar que todos voltam.
- Editar removendo um contato e salvando.
- Conferir selo "+N" no Diretório e a escolha de destinatário no WhatsApp do CRM.
