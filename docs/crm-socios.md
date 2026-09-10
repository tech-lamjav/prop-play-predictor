# CRM dos sócios

> **Status:** spec aprovada em 2026-09-10 · **Branch:** `feat/crm-socios`
> **Origem:** grill de 2026-09-10. Todas as recomendações foram aceitas.

Um painel dentro do próprio site, visível só para os sócios, onde
os cadastros aparecem por dia, cada nome abre uma ficha, e a abordagem de cada
lead frio é registrada e acompanhada. O produto é um CRM mínimo para a fase de
MVP — não substitui o PostHog, que continua sendo onde o comportamento mora.

## Por que existe

A base é pequena o suficiente para abordagem um a um: o baseline de julho tinha
603 contas e 12 assinantes. Nesse tamanho, o gargalo não é escala de ferramenta,
é não ter onde registrar quem já foi abordado, o que a pessoa respondeu e por
que ela assinou. Hoje isso não existe em lugar nenhum.

## O que o banco já sabe

Levantado no código em 2026-09-10, antes de decidir qualquer coisa:

- A tabela `public.users` guarda nome, e-mail, WhatsApp, os campos de Telegram,
  a data de criação, o nome do plano em `subscription_product_type` (entrada,
  essencial, completo) e três colunas de acesso — Betinho, futebol e análises.
- O acesso de futebol **não tem** colunas de metadados (`_period_end` e
  companhia). Isso é deliberado, está documentado em `shared/concessoes.ts`.
  Consequência para a ficha: dá para mostrar o plano de um assinante Essencial,
  **não** dá para mostrar quando ele renova.
- **Não existe origem de lead.** Nenhum campo de campanha, UTM ou referência de
  entrada em lugar nenhum do banco. Isso só existe no PostHog.
- Existe uma tabela `public.waitlist` desde a primeira migration, com política
  de leitura negada para todo mundo. Ninguém sabe quantos nomes tem lá dentro.
  Fora do escopo desta spec, mas vale olhar depois.

## O que não existe e nasce aqui

Nenhuma noção de sócio, papel ou permissão elevada em nenhum lugar do
repositório. O site inteiro lê o banco direto do navegador com a chave pública,
e a regra de linha da tabela de usuários é "cada um enxerga só a própria linha".

## Decisões

**O portão é o banco, não a tela.** Uma coluna `is_socio` em `public.users`,
ligada na mão direto no banco, e políticas de leitura que dizem "a própria
linha, ou qualquer linha se quem pergunta for sócio". A rota escondida é
conveniência; a segurança de verdade está na política. Isso implica uma função
`SECURITY DEFINER` para consultar a coluna: uma política sobre `users` que
consulta `users` recursa e derruba a tabela inteira.

**A tela mora no próprio site**, numa rota fora de qualquer menu, e quem não é
sócio recebe a página de não encontrado — não uma de acesso negado, que
confirmaria que a página existe. A página é `noindex`, e fica fora do
`public-routes.json`, então não entra no sitemap. Fica **fora do robots.txt** de
propósito: listar o caminho lá é anunciá-lo.

**Cadastro é linha na tabela de usuários**, agrupada pelo dia de criação. A
lista de espera fica de fora desta primeira volta.

**O funil tem seis etapas**: novo, contatado, conversando, proposta, assinou,
sem resposta. A etapa muda na mão, e cada mudança fica registrada — para depois
dar para medir quanto tempo cada lead ficou parado onde.

**O gancho sai do banco, e pode ser corrigido na mão.** Sem PostHog, o que dá
para inferir é: qual plano tem, se sincronizou o Telegram, se registrou aposta,
se ligou os alertas de futebol. Isso já separa quem veio pelo Betinho de quem
veio pelo futebol. É palpite, e a tela precisa dizer que é palpite.

**Feedback não é campo separado.** Vai na mesma linha do tempo das anotações,
com uma etiqueta de tipo — anotação, feedback, objeção. O feedback aparece no
contexto da conversa em que nasceu, e ainda dá para filtrar só ele depois.

**O PostHog fica para depois.** É o pedaço mais caro e o único que precisa de
infraestrutura nova: a chave de consulta não pode viver no navegador, então
exige função no servidor. A ficha nasce com o lugar dele reservado.

## Modelo de dados

Uma migration, quatro objetos:

- `users.is_socio` — booleano, falso por padrão.
- `public.crm_etapa` — uma linha por pessoa: em que etapa ela está, quando mudou
  e qual sócio mudou. Quem nunca foi tocado não tem linha, e vale "novo".
- `public.crm_etapa_evento` — o histórico das mudanças, append-only.
- `public.crm_anotacao` — a linha do tempo: tipo, texto, quando, qual sócio.

As três tabelas do CRM só são legíveis e escrevíveis por sócio.

## Telas

**Lista** — cadastros agrupados por dia, do mais novo para o mais velho. Cada
linha traz nome, contato, etapa, gancho e se assinou. No topo, os contadores do
dia, da semana e de assinantes. Busca por nome, e-mail ou telefone, e filtro por
etapa.

**Ficha** — contatos, plano e acessos, datas, gancho, seletor de etapa, linha do
tempo, e o bloco da mensagem pronta com um botão que copia e outro que abre o
WhatsApp com o texto já dentro.

## Ordem de execução

Cada item é uma bala traçante: sai ponta a ponta, do banco à tela.

1. **Fundação** — migration, portão do sócio, rota escondida, e uma casca que mostra o total de cadastros. O total é a bala traçante: sem a política de linha ele viria 1, a própria linha de quem perguntou.
2. **Lista** — cadastros por dia, contadores, busca.
3. **Ficha** — contatos, plano, acessos, gancho.
4. **Funil** — etapa na ficha, histórico, filtro na lista.
5. **Linha do tempo** — anotações e feedbacks.
6. **Mensagens prontas** — modelos, copiar, abrir WhatsApp.

Fora desta spec, registrado como issue à parte: o bloco de comportamento vindo
do PostHog.
