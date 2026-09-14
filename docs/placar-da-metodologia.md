# Placar da metodologia

> **Status:** spec aprovada em 2026-09-12 · **Branch:** `feat/painel-performance`
> **Origem:** grill de 2026-09-12, continuando o de 2026-09-07. Todas as
> recomendações foram aceitas. Decisões duras em `docs/adr/0001`, `0002` e `0003`.

Uma segunda tela na área de sócios, ao lado do CRM, onde as oportunidades já
publicadas aparecem liquidadas e agrupadas — por mercado, faixa de Score, faixa
de odd e campeonato — para os sócios decidirem se o peso de uma premissa está
bom, se a premissa faz sentido e se falta premissa.

## O problema

Hoje o número não existe na tela de ninguém. Cada vez que alguém quis saber como
a metodologia está indo, refez a conta à mão — e refazer à mão é como duas
pessoas chegam a taxas diferentes para a mesma semana. Em 09/09/2026 o pedido foi
ao Mateus; em 10/09 ele respondeu que o funil do BigQuery não guarda resultado
liquidado, nem o funil nem o histórico do board, e que não existe tabela de
liquidação em lugar nenhum do dataset. O caminho ficou do nosso lado.

O que existe é o script `scripts/futebol-roi.mjs`, que mede certo mas mora no
terminal: só roda quem tem o token de produção, e o resultado não fica em lugar
nenhum. As decisões que dependem desse número — religar o handicap, mexer no
peso de uma premissa, aposentar uma premissa — são tomadas por três sócios, e
dois deles não abrem um terminal.

## A solução

O placar lê o histórico de oportunidades publicadas, liquida cada uma contra o
placar final do jogo com a regra que o site já usa, e mostra o resultado em
tabelas de **quebra**: mercado, faixa de Score, faixa de odd, campeonato. Cada
linha mostra o denominador ao lado do número, sempre, porque 4 acertos em 6
apostas e 400 em 600 não são a mesma informação.

O período é escolhido, e dois períodos podem ser comparados lado a lado. O padrão
abre na **série comparável** — de 04/09/2026 para cá —, porque antes disso a nota
está em outra escala.

Diferente do script num ponto: o placar conta mercado fora da vitrine por padrão,
com marca visível. O script responde "como foi o produto que o assinante usou"; o
placar responde "como está a metodologia", e a decisão de religar o handicap é
exatamente uma decisão que ele precisa sustentar.

## O que o Postgres sabe, e o que ele não sabe

Levantado no código em 2026-09-12, antes de decidir qualquer coisa.

Sabe, com fidelidade histórica, por oportunidade publicada:
`futebol.fact_value_opportunities_hist` guarda mercado, saída, linha, campeonato,
a odd da publicação, `score`, `faixa`, `score_versao`, `pts_premissas`,
`penalidades`, `premissas_sem_dado`, `modelo_api_concorda`,
`linha_sharp_confirma` e os quatro `pen_*`, cada registro com validade
(`dbt_valid_from` / `dbt_valid_to`). O placar final vem de
`futebol.fact_fixtures`.

**Sabe quais premissas acenderam** — e esta parte da spec estava errada na
primeira versão. As cinco tabelas de premissa do mart existem neste banco, uma
linha por candidata com uma coluna booleana por premissa, e casam com o board
publicado em **100% das 1.683 linhas liquidadas** desde 04/09, nos cinco
mercados. O que me enganou foi a RPC da migration 093, que atende um jogo por
chamada; a tabela por trás dela é consultável em lote, e a migration 134 fez
isso com uma view.

O limite que sobra, e a tela diz: a flag é recalculada todo dia, a partir de
janelas anteriores ao apito. Para jogo passado o valor é estável, porque os
insumos estão congelados — mas mudar o critério de uma premissa reescreve o
passado. Não é registro point-in-time.

**Não sabe por QUANTO a premissa acendeu.** O insumo e a janela de cada premissa
existem no mart desde as entregas de 08 e 10/09/2026 e não vieram no sync. Sem
eles dá para separar acesa de apagada, e não dá para separar "acendeu raspando"
de "acendeu com folga". É o pedido que sai desta spec: colunas numa tabela que já
é sincronizada, não pipeline nova.

⚠️ E a medição só significa algo DENTRO DO LADO do mercado. Medido em 12/09 em
Gols: "defesas vazáveis acesa rende 33,5% contra −13,4% apagada" — e quase toda
essa diferença era o lado. O Over rendia +15,7% em 259 apostas e o Under −24,1%
em 263. Dentro do Over a premissa informa de verdade (+33,5% em 101 contra +4,3%
em 158); dentro do Under, defesas firmes acesa dá −24,3% contra −24,0% apagada,
ou seja, nada.

## Histórias de usuário

1. Como sócio, quero entrar em `/socios/metodologia` pelo menu que já me leva ao
   CRM, para chegar no placar sem decorar endereço.
2. Como sócio, quero que quem não é sócio receba 404 nessa rota, para a área
   interna não se anunciar.
3. Como sócio, quero encontrar o CRM em `/socios/crm` com as três seções que ele
   já tinha, para nada do que eu uso hoje ter se perdido.
4. Como sócio, quero que o link antigo de `/socios` me leve ao CRM, para meus
   favoritos continuarem funcionando.
5. Como sócio, quero que o link antigo da ficha de um lead continue abrindo a
   ficha daquele lead, para uma conversa em andamento não quebrar.
6. Como sócio, quero alternar entre CRM e placar por uma navegação no topo da
   área, para trocar de assunto sem voltar ao menu da conta.
7. Como sócio, quero ver quantas oportunidades foram liquidadas no período, para
   saber de que tamanho é a base do que estou olhando.
8. Como sócio, quero ver a taxa de acerto e o ROI do período inteiro, para ter a
   linha de base contra a qual comparar qualquer quebra.
9. Como sócio, quero ver o ROI por mercado, para saber onde a metodologia está
   ganhando e onde está perdendo.
10. Como sócio, quero ver a taxa de acerto por mercado ao lado do ROI, para
    distinguir o mercado que acerta pouco e paga bem do que acerta muito e paga
    mal.
11. Como sócio, quero o denominador ao lado de cada número, para não tirar
    conclusão de seis apostas.
12. Como sócio, quero uma medida de incerteza em cada linha, para saber quando a
    diferença entre duas linhas é ruído.
13. Como sócio, quero ver o ROI por faixa de Score, para saber se a nota ordena o
    resultado — que é a promessa central do método.
14. Como sócio, quero ver o ROI por faixa de odd, para testar a suspeita de que
    odd alta e odd baixa se comportam diferente.
15. Como sócio, quero ver o ROI por campeonato, para testar a suspeita de que
    Brasileirão e Copa não se parecem.
16. Como sócio, quero escolher o período, para olhar a semana, o mês ou a série
    inteira.
17. Como sócio, quero que o período padrão seja a série comparável, para não
    somar notas de escalas diferentes sem perceber.
18. Como sócio, quero um aviso na tela quando o período que eu escolhi atravessa
    a virada do denominador, para eu saber que o Score daquele trecho não é
    comparável.
19. Como sócio, quero comparar dois períodos lado a lado, para ver se uma mudança
    que a gente fez melhorou ou piorou o resultado.
20. Como sócio, quero escolher se o período conta pelo dia do jogo ou pelo dia da
    detecção, porque uma pergunta é sobre o resultado da semana e a outra é sobre
    a régua que publicou.
21. Como sócio, quero ver oportunidades de mercado fora da vitrine por padrão,
    com marca dizendo que é oculto, para decidir sobre o handicap com o dado dele
    à vista.
22. Como sócio, quero poder restringir a conta à vitrine, para responder à outra
    pergunta: como foi o produto que o assinante usou.
23. Como sócio, quero ver quantas oportunidades do período ainda estão pendentes,
    para saber que a conta vai mudar quando os jogos terminarem.
24. Como sócio, quero ver a contagem de anuladas separada, para entender por que
    taxa de acerto e ROI têm denominadores diferentes.
25. Como sócio, quero ver, para cada lado de cada mercado, o ROI de cada premissa
    quando ela acendeu e quando não acendeu, para decidir peso e catálogo.
26. Como sócio, quero ver a quebra por premissas sem dado, para saber se publicar
    com evidência faltando sai caro.
27. Como sócio, quero ver a quebra por corroboração do modelo e por confirmação
    da linha sharp, para saber se esses dois sinais valem o que a gente supõe.
28. Como sócio, quero ver a quebra por penalidade aplicada, para saber se a
    penalidade está protegendo ou só cortando aposta boa.
29. Como sócio, quero ler na tela que o corte por premissa não está aqui e por
    que, para não confundir a quebra por pontos com a pergunta que eu fiz.
30. Como sócio, quero que o placar diga que mede a foto de nascimento da
    oportunidade, para eu não comparar o número dele com o histórico do
    assinante e achar que um dos dois está errado.
31. Como sócio, quero que o placar dê o mesmo número que o script, para o
    terminal e a tela nunca discordarem.
32. Como sócio, quero a tela legível no celular, porque é de onde eu mais olho.

## Decisões de implementação

- **Dois andares na área de sócios.** `/socios` deixa de ser tela e vira casca:
  redireciona para `/socios/crm` e hospeda a navegação entre os dois contextos. O
  CRM leva suas três seções e sua ficha para baixo de `/socios/crm`. A ficha
  antiga em `/socios/:id` sobrevive como redirecionamento. Detalhe e motivo em
  `docs/adr/0001`.
- **O porteiro é o mesmo do CRM.** `PortaoDoSocio` na rota, `public.eh_socio()`
  dentro da RPC, 404 para quem não é sócio. Nenhuma porta nova.
- **Uma RPC nova, própria do placar.** Ela devolve, para um intervalo de datas, a
  **foto de nascimento** de cada oportunidade do histórico junto com o placar
  final do jogo e o estado dele. É restrita a sócio, porque devolve o board
  inteiro, inclusive mercado oculto. Não reusamos `get_futebol_value_history`
  porque ela responde outra pergunta — motivo em `docs/adr/0003`.
- **A liquidação continua sendo a regra do site.** `settleFutebol` é a única
  fonte; o placar a chama, não a copia. Motivo e consequências em
  `docs/adr/0002`.
- **A agregação é um módulo puro.** Recebe as linhas já liquidadas e uma quebra,
  devolve as células da tabela: n, acertos, anuladas, pendentes, taxa, ROI e
  erro-padrão. Toda a aritmética do placar vive aí, sem tela e sem rede.
- **Unidade fixa.** Toda oportunidade vale 1. Green paga a odd menos 1, meio
  green paga metade disso, anulada paga 0, meio red custa 0,5, red custa 1.
- **A tela abre simulando.** Decisão de 14/09/2026, depois da primeira leitura
  no celular: o padrão é zero unidade na faixa Baixa, meia na Média e uma nas
  duas Altas, que é o tamanho de aposta que os sócios usam. A tela avisa que é
  simulação desde o primeiro carregamento, e o número em unidade fixa continua
  sendo o medido — ele volta com todas as faixas em 1.
- **Taxa de acerto exclui anulada do denominador; ROI não.** São denominadores
  diferentes de propósito, e a tela mostra os dois lados.
- **Faixas iguais às do script.** Score em Baixa, Média, Alta e Alta 80+; odd em
  1,25–1,59, 1,60–1,99, 2,00–2,59 e 2,60–4,00. Divergir daria duas verdades.
- **Mercado oculto entra por padrão**, com marca, e existe o botão para ver só a
  vitrine. A lista de ocultos é a que já está no banco.
- **Pendente nunca entra em conta**, só é contado e mostrado à parte.
- **O período padrão é a série comparável**, e a tela avisa quando a escolha do
  sócio atravessa a virada de 04/09/2026.
- **Só lê.** Nenhuma edição de peso pela tela. O peso vive em duas cópias hoje,
  uma no mart e outra no catálogo do front, e editar antes de resolver isso é
  editar o número errado.
- **A tela mora em `src/components/placar/`**, com a página em `src/pages/`. O
  vocabulário dela é o do futebol, não o do CRM, e o mapa de contextos registra
  isso.

## Decisões de teste

Um teste bom aqui prova comportamento externo: dada uma lista de oportunidades
com placar, a agregação devolve tais células. Nada de espiar estado interno nem
montar a tela para conferir aritmética.

- **O módulo de agregação é o alvo principal.** Casos: lista vazia; uma aposta só;
  green, meio green, anulada, meio red e red no mesmo grupo; pendente ignorada
  na conta e contada à parte; taxa e ROI com denominadores diferentes quando
  existe anulada; erro-padrão de um grupo de tamanho um; quebra com grupo vazio.
  Prior art: os módulos `crm-*.ts` com `.test.ts` ao lado, e `futebol-score.ts`.
- **Paridade com o script.** Um teste compara a agregação da tela com a do
  `scripts/futebol-roi.mjs` sobre a mesma entrada, célula por célula. Prior art
  exata: `src/utils/futebol-roi-script.test.ts`, que já faz isso para a regra de
  liquidação.
- **As faixas** de Score e de odd têm teste de fronteira: 29,9 e 30; 1,99 e 2,00.
- **A rota** ganha teste de estrutura no arquivo que já guarda a rota do CRM:
  toda rota da área tem porteiro, o placar está declarado antes do coringa da
  ficha, e a página nova está na lista fechada de páginas da área.
- **Os redirecionamentos** têm teste: `/socios` chega no CRM, `/socios/<id>`
  chega na ficha daquele lead.
- **A tela** tem teste de comportamento, não de pixel: com dados de exemplo,
  mostra o denominador junto do número, mostra o aviso de escala quando o
  período atravessa a virada, e mostra a marca de oculto.
- Serviço e hook não ganham teste unitário, seguindo a convenção do repositório.

## Fora de escopo

- **O insumo e a janela de cada premissa** — por quanto ela acendeu. Existe no
  mart, não veio no sync; sai como pedido ao Mateus.
- **A candidata recusada.** O funil vive no BigQuery e o app não o alcança. Sem
  ela, o placar não responde "o corte está apertado demais" nem "falta
  premissa", e a tela precisa dizer isso.
- **Gravar a liquidação** em tabela.
- **Editar peso** pela tela.
- **Exportar** para planilha.
- **Gráfico de evolução.** Tabela primeiro; curva quando houver série para ela.
- **O caderno de apostas do assinante.** Outro assunto, outro número.

## Notas

O script continua existindo e continua sendo a referência de terminal. Ele e o
placar precisam concordar, e o teste de paridade é o que garante isso — quando um
dos dois mudar de conta, o teste quebra e alguém decide qual está certo.

Duas armadilhas herdadas, ambas já escritas no cabeçalho do script: o dia
03/09/2026 concentra o board inteiro num snapshot só, e por isso distorce
qualquer leitura por dia de detecção; e a data de detecção não é a data do jogo.
