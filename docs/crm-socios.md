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

**A tela mora no próprio site**, com o header do produto e uma faixa própria de
identidade, numa rota fora de qualquer menu, e quem não é
sócio recebe a página de não encontrado — não uma de acesso negado, que
confirmaria que a página existe. A página é `noindex`, e fica fora do
`public-routes.json`, então não entra no sitemap. Fica **fora do robots.txt** de
propósito: listar o caminho lá é anunciá-lo.

**Cadastro é linha na tabela de usuários**, agrupada pelo dia de criação. A
lista de espera fica de fora desta primeira volta.

**O funil tem seis etapas manuais e duas posições calculadas.** As manuais
descrevem a conversa: novo, contatado, nutrindo, boletada, interesse, sem
resposta. Elas vieram do CRM que o Victor já tinha escrito no repositório
privado `crm-smart` (migration 012), porque as genéricas de manual não falavam
de nutrição nem de boletada — e é justamente isso que o processo daqui tem de
próprio.

As duas calculadas são **em teste** e **assinante**, e o banco responde as duas.
Etapa manual para o que o banco sabe nasce desatualizada: alguém esquece de
mover quando a assinatura cai, e a tela passa a mentir. No CRM antigo elas eram
colunas arrastadas na mão porque lá o lead podia nem ter conta; aqui todo lead
já tem cadastro no produto. A posição calculada vence a manual na tela, senão o
funil somaria duas vezes a mesma pessoa.

A etapa muda na mão, e cada mudança fica registrada — para depois dar para medir
quanto tempo cada lead ficou parado onde.

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

**Painel** — na ordem em que a tela responde "com quem eu falo agora": três
números de acompanhamento (cadastros em trinta dias, conversão, abordados), a
faixa do funil com as oito posições e clicável como filtro, a busca, e **uma
lista só**.

A lista tem duas vistas, **tabela** e **kanban**, e uma chave alterna entre
elas. As duas desenham o MESMO recorte: a busca e o filtro do funil valem para
as duas, e trocar de vista muda a disposição e nunca o conteúdo. A tabela é para
trabalhar a fila; o kanban é para ver onde a base empilha.

O formato saiu de um protótipo com três opções, na branch
`prototype/painel-do-crm`. A chave que decidiu foi o TAMANHO DA BASE: com treze
cadastros qualquer formato parece bom, e é com seiscentos, dos quais 82% em
"Novo", que o kanban mostra o custo — uma coluna gigante e sete quase vazias. A
coluna tem teto de cartões e diz quantos sobraram, porque fingir que ela é
navegável seria pior que admitir o limite.

A tabela tem um **recorte** — precisa de atenção, ou todos — e uma chave
separada para agrupar por dia. "Precisa de atenção" junta duas situações numa
lista ordenada: conversa começada e sem toque há sete dias ou mais vem primeiro,
depois quem nunca saiu de "novo". As duas já eram distinguíveis pela coluna de
etapa, e separá-las em tabelas diferentes era o que fazia a tela parecer cinco
listas.

Agrupar por dia é chave à parte, e não um terceiro recorte: ela se combina com
os dois em vez de competir. É a única visão que mostra o RITMO de chegada, e
some no kanban, onde a coluna já é o agrupamento.

Os números do topo e o funil contam a base INTEIRA, e não o recorte da busca:
eles respondem como está a operação, e essa resposta não muda porque alguém
digitou um nome.

**Ficha** — abre em **modal por cima da lista**, em duas colunas: à esquerda o
que é consulta (etapa, contatos, planos, comportamento), à direita o que é
trabalho (o palpite, a mensagem pronta, a linha do tempo). O formato saiu de um
protótipo de três variações, na branch `prototype/ficha-do-lead`.

O endereço continua `/socios/<id>`, porque a ficha precisa ser compartilhável
entre os sócios. As duas rotas desenham a mesma página: a segunda é a primeira
com o modal aberto. Fechar navega de volta, e o botão voltar do navegador
funciona sozinho.

**Feedbacks** — seção própria na faixa do CRM, em `/socios/feedbacks`. Todos os
feedbacks da base numa lista, do mais recente para o mais antigo, com quem
registrou e o nome levando de volta para a ficha.

Ela existe porque são duas perguntas diferentes: a lista de leads responde "com
quem eu falo agora", e esta responde "o que estão achando do produto". O
feedback continua morando na linha do tempo de quem falou — é lá que ele tem
contexto —, e esta tela é a leitura transversal dele.

A primeira versão desta tela era só a lista por dia. O diagnóstico do Victor foi
que ela parecia um registro do que aconteceu, e não um CRM — e estava certo: uma
lista cronológica responde "o que aconteceu", não "com quem eu falo agora".

**Ficha** — contatos, plano e acessos, datas, gancho, seletor de etapa, linha do
tempo, e o bloco da mensagem pronta com um botão que copia e outro que abre o
WhatsApp com o texto já dentro.

## Acesso dado na mão

A primeira ESCRITA do CRM na tabela de usuários. Até a migration 128 o sócio só
lia; a 129 abre três interruptores de produto e o teste do futebol, na coluna
esquerda da ficha.

**O Stripe continua mandando.** O acesso dado aqui vale até o webhook falar
sobre aquela pessoa, e aí ele vence. É uma escolha, e a alternativa é pior: se o
CRM ganhasse do webhook, um clique errado viraria assinatura eterna de graça. A
tela avisa isso onde o sócio clica, porque é o tipo de coisa que só aparece três
semanas depois, quando o acesso "some sozinho".

**A função não recebe nome de coluna.** Ela recebe um produto de uma lista de
três e decide sozinha o que mexer. A versão genérica — `execute format('update
public.users set %I = ...')` — é uma linha mais curta e transforma "produto" em
qualquer coluna da tabela, `is_socio` inclusive: um sócio comprometido viraria
todos os sócios. A escada de `if` é feia e é a escolha certa.

**O teste do futebol é função à parte**, e não um quarto produto. Ele não é
status de assinatura, é um carimbo de início de onde se contam sete dias.
Juntá-lo aos outros convidaria a implementá-lo como `status = 'premium'`, que dá
acesso para sempre com cara de teste. Na tela ele tem três estados, e não dois:
nunca usou, correndo, já usou — o terceiro é o que decide se dar outro faz
sentido.

**Toda mudança vira registro na linha do tempo**, num quarto tipo, `acesso`, que
ninguém digita: ele fica fora do seletor do formulário de propósito, porque um
registro de auditoria que qualquer um forja não é registro de auditoria. Daqui a
três meses alguém vai perguntar por que essa pessoa tem o Completo sem nunca ter
pago, e a resposta precisa estar junto do resto da conversa.

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
