# Como uma premissa nasce, é medida e morre

Este documento responde a uma pergunta de memória — **como a gente definiu as
premissas de cada mercado?** — e transforma a resposta num procedimento, para
que o próximo mercado não dependa de ninguém lembrar.

Ele tem duas metades. A primeira reconstrói o que foi feito de fato, com data e
fonte. A segunda propõe o método para um mercado novo, e o aplica a escanteios.

> Não confundir com os outros dois. `docs/futebol-metodologia.md` é o desenho de
> um modelo de projeção que nunca foi construído.
> `docs/futebol-metodologia-por-mercado.md` descreve o que roda hoje, mercado a
> mercado. Este aqui é sobre **o processo**: de onde vem uma premissa, o que
> decide o peso dela, e o que a mata.

---

## 0. Por que este documento existe

Três documentos são citados como a origem de tudo, em comentário de código e em
cabeçalho de migration. **Nenhum dos três jamais esteve neste repositório**, e
não estão no histórico do git:

| Documento citado | Citado por | O que ele guardava |
|---|---|---|
| `docs/futebol-metodologia-premissas.md` | épico do Motor de Score, 19/06/2026 | o playbook: premissas, pesos, limiares, fontes |
| `docs/futebol-metodologia-benchmark.md` | mesmo épico | a fundamentação: pesquisa de mercado e benchmark |
| `docs/premissas-recalibragem.md` | migration 093 e o catálogo do front | a revisão de 01/08/2026 que inverteu a ordem do produto |

O que sobreviveu foi a descrição das tasks no ClickUp, as issues do
analytics-engineering e as ADRs do dbt. É bastante — dá para reconstruir o
método inteiro —, mas está espalhado em três sistemas e nenhum deles é o
repositório onde o código mora.

Este documento é a correção disso.

---

## 1. Onde a memória está hoje

Tudo abaixo foi conferido, não lembrado.

| O quê | Onde | Responde |
|---|---|---|
| O catálogo original, 39 premissas | ClickUp `86aj4p7b5` e as cinco filhas, 19/06/2026 | regra, limiar, fonte e peso inicial de cada uma |
| A fórmula do Score original | ClickUp `86aj4p7b5` | como premissa virava nota |
| A virada de 01/08 | migration `093_futebol_mapa_premissas.sql`, cabeçalho | por que o contexto virou porta e o preço virou filtro |
| A auditoria point-in-time | ClickUp `wdx6zev64w` (task [0]) | 27 das 39 liam dado posterior ao jogo |
| O vocabulário dos quatro Testes | `dbt_futebol/CONTEXT.md`, seção Measurement and calibration | qual medição pode justificar um peso |
| A remedição na base limpa | ClickUp `wdx6zevfgf` e issues #3 a #10 | o ganho medido de cada premissa, mercado a mercado |
| O ranking medido das 39 | ClickUp `wdx6zev64y` (task [B]) | quais funcionam, quais perdem, quais eram artefato |
| Como o histórico entra | issues #49 a #59 (task [F]) | escopo e recorte do passado de cada time |
| As decisões de método | `dbt_futebol/docs/adr/0001` a `0015` | por que cada regra é o que é |

**A lacuna que sobra é uma só, e é justamente a que você não lembra:** a regra e
o limiar de cada uma das 39 premissas estão registrados, mas **o motivo de cada
limiar não está em lugar nenhum**. Por que `supremacia` pede oito posições de
diferença e não seis. Por que `defesa_fora_solida` corta em 1,1 gol sofrido.
Isso vivia no playbook e no benchmark, e os dois sumiram.

Na prática isso importa menos do que parece, porque a medição depois passou por
cima: hoje o que decide o peso é o ganho medido, não o argumento original. Mas
importa para o mercado novo, e é o que a seção 4 conserta.

---

## 2. O que foi feito de fato

Cinco movimentos, em três meses.

### 2.1 O catálogo exaustivo, escrito à mão (19/06/2026)

Você lembrou certo: a origem foi **exaustiva de propósito**. Cinco tasks, uma
por mercado, com 39 premissas no total, cada uma com quatro campos — nome, regra
com limiar, tabela de origem e peso.

O peso inicial **foi decidido no olho**, e a task diz isso com todas as letras:

> Pesos/thresholds são ponto de partida → calibrar depois com RPS/calibração +
> CLV (quando o t15m acumular).

A distribuição de pesos também seguia uma intuição simples: força estrutural do
time valia 12, sinal indireto valia 8, histórico recente valia 6, desempate
valia 4. O Handicap, por exemplo, nasceu com `supremacia` 12, `tende_golear` 10,
`adversario_fragil_fora` 8, `mando_forte` 6, `sem_rodizio` 4.

Junto vieram três coisas que hoje não existem mais: o preço somava até 30 pontos
na nota, a corroboração somava 15, e a publicação exigia vantagem positiva.

### 2.2 A virada: o preço sai da porta (01/08/2026)

A revisão comparou quatro regras de publicação em backtest. A regra antiga —
vantagem maior que zero — foi a única que perdeu dinheiro: R$ 100 viraram R$ 85
em 393 apostas, contra R$ 110 de "duas premissas, sem olhar preço" em 1.087
apostas.

O produto inverteu: o contexto virou a porta, o preço virou filtro de sanidade.

### 2.3 A auditoria que matou o número (task [0])

Antes de reescrever qualquer peso, alguém perguntou se as premissas liam só
informação anterior ao jogo. **27 das 39 não liam.** A correção point-in-time
levou o ROI de +9,7% para −7,6%.

Esse é o achado mais caro do projeto inteiro, e é a razão de tudo que veio
depois ser tão cauteloso. O sinal que sustentava a revisão não existia.

### 2.4 Os quatro Testes, e qual deles vale (task [0.1])

Aqui o método virou vocabulário. Cada Teste responde uma pergunta diferente, e
**só um deles pode justificar um peso**:

| Teste | Pergunta | Precisa de odds? |
|---|---|---|
| **Teste 1** | a premissa acerta mais que a média das linhas parecidas? | não |
| **Teste 2** | a premissa acerta mais do que o preço já dizia? | sim |
| **Teste 3** | uma regra de contagem seleciona aposta? | sim |
| **Teste 4** | a nota ordena aposta? | sim |

Teste 1 mede se a premissa **prevê a linha**. Teste 2 mede se ela **bate o
preço**. A diferença é a diferença entre saber futebol e ganhar dinheiro: uma
premissa pode acertar 70% e ser inútil, se a odd já pagava como 70%.

Daí saiu a regra de peso, com encolhimento por amostra:

```
peso = max(ganho_teste2, 0) × n / (n + k)        k = 50
```

O encolhimento não é preferência estética. É defesa contra o modo de falha
medido na task [0]: **amostra curta fabrica sinal**. Os +9,7% vinham inteiros de
competições de mata-mata, onde os times tinham de 0,8 a 2,4 jogos de histórico.
Peso proporcional ao ganho cru premiaria exatamente essas.

### 2.5 O achado transversal, e o que ele fez com metade do catálogo

Medidas todas as 39 na base limpa, apareceu um padrão que atravessa os cinco
mercados:

> **Premissa de histórico recente não ajuda em nenhum mercado.** Histórico over,
> histórico seco, histórico de ambos marcam, confronto direto, invicto recente.
> O que ajuda é sempre característica estrutural: como o time defende, como ele
> ataca, quanto ele descansou.

A explicação é econômica, não estatística: histórico recente é o dado mais fácil
de olhar, então a casa de aposta já olhou antes da gente. Ele está no preço.

Foi isso que criou os dois grupos que o produto usa hoje — **decide** e
**preço** — e que zerou metade do catálogo.

Vale ver o placar do plano original contra o medido, só no mercado de Gols,
porque ele é a melhor defesa que existe contra escrever peso na mão:

| Premissa | O plano mandava | O medido disse |
|---|---|---|
| ambos_vazam | zerar | −3,7 · acertou |
| ritmo_alto | zerar | −5,3 · acertou |
| linha_subindo | zerar | −1,5 · acertou |
| historico_over | zerar | −0,5 · acertou |
| linha_descendo | zerar | +3,1 · **errou, ela funciona** |
| defesas_vazaveis | subir de 10 para 12 | −5,0 · **errou, ela perde** |
| xg_combinado_alto | subir de 8 para 10 | −2,6 · **errou, ela perde** |
| ataque_combinado | manter em 12 | −3,6 · **errou, ela perde** |
| clean_sheets_altos | manter, "melhor sinal" | +17,1 sem piso, −1,7 com piso · **era artefato** |

Quatro acertos e cinco erros, num mercado só.

---

## 3. As sete regras que sobreviveram

Isto é a metodologia. Tudo abaixo foi pago com erro.

**R1 — Só "bate o preço" justifica peso.** Teste 1 é peneira barata e serve para
descartar cedo. Ele nunca vira peso. (ADR 0001)

**R2 — Estrutural ganha de histórico.** Antes de propor uma premissa, pergunte
se ela é característica do time ou notícia da semana. Notícia da semana já está
na odd.

**R3 — Amostra curta fabrica sinal.** Todo ganho vem com o `n` ao lado e com o
percentual de linhas cujos times tinham menos de cinco jogos de histórico. Peso
encolhe com `n / (n + 50)`.

**R4 — Point-in-time ou não é medição.** Qualquer agregado do time é reconstruído
só com partidas que começaram antes do jogo avaliado.

**R5 — Peso escrito na mesma amostra em que foi medido é overfit.** O Mateus
mediu o tamanho disso: o filtro "exigir ao menos uma premissa forte" rende +8,3%
com "forte" definido na própria amostra e −6,2% com "forte" definido só na
primeira metade. **14,5 pontos de viés puro.** Reescrever peso exige controle
fora da amostra.

**R6 — O número tem que voltar igual.** Média é `SAFE_DIVIDE(SUM, COUNT)`, nunca
`AVG` — o BigQuery paraleliza e a última casa decimal muda entre execuções. Uma
premissa que compara média contra limiar muda a própria contagem entre builds do
mesmo código.

**R7 — O nome da premissa tem que dizer o que a regra faz.** "Raramente perde
por dois ou mais" enunciava uma condição de aposta que só vale em duas das sete
linhas do handicap. O cálculo estava certo; a frase mentia. Toda premissa nova
passa por essa leitura antes de ir para a tela.

---

## 4. O método proposto para um mercado novo

Sete fases, cada uma com uma porta explícita. A porta é o que faltou da primeira
vez: em 19/06 o catálogo foi direto do papel para o código, e a primeira medição
honesta só veio seis semanas depois.

### Fase 0 — Viabilidade de dado

Antes de pensar em premissa, três perguntas com resposta numérica:

1. **Temos o resultado?** A estatística que liquida a aposta existe na base, por
   jogo, e com que cobertura por competição.
2. **Temos o insumo?** As colunas que alimentariam as premissas existem com a
   mesma cobertura.
3. **Temos ou teremos preço?** Sem odds não há Teste 2, e sem Teste 2 não há
   peso. Se o preço ainda não existe, a fase 5 tem data, não pressa.

**Porta:** cobertura abaixo de 90% nas competições da vitrine mata o mercado ou
reduz o escopo dele a quem tem dado.

### Fase 1 — O retrato do mercado, antes de qualquer premissa

Quatro medições que decidem se vale a pena, e que custam um dia:

| Medição | O que responde |
|---|---|
| Média, desvio e percentis do total por jogo | onde as linhas vão cair |
| Dispersão entre times | quanto o time explica |
| **Persistência** (metade 1 contra metade 2 dos jogos do time) | isso é traço do time ou é ruído? |
| Separação por faixa prevista, point-in-time | o quanto dá para ordenar jogo |

A persistência é a que manda. Se o que o time faz na primeira metade da
temporada não prevê o que ele faz na segunda, **não existe premissa estrutural
possível** e o mercado não é para a gente.

**Porta:** persistência abaixo de 0,4 encerra o assunto. Entre 0,4 e 0,6, segue
com expectativa baixa. A régua está na seção 5.

### Fase 2 — O catálogo exaustivo

Aqui sim, escrever muita premissa de propósito, como foi feito em 19/06. Quatro
campos obrigatórios por premissa, e agora **um quinto**:

| Campo | Obrigatório desde |
|---|---|
| nome que descreve a regra (R7) | sempre |
| regra com limiar | sempre |
| tabela e coluna de origem | sempre |
| grupo esperado: decide ou preço (R2) | **novo** |
| **por que este limiar** | **novo** |

O quinto campo é a lição da seção 0. Uma linha basta: "a mediana da liga", "o
p75 da distribuição", "chute, a ser medido". Chute declarado é honesto; chute
esquecido vira folclore.

**Porta:** nenhuma. Exaustividade é barata nesta fase.

### Fase 3 — Teste 1, a peneira barata

Roda sem odds, sobre o histórico inteiro, point-in-time. Corta o que não prevê
nem a própria linha.

**Porta:** premissa que não bate a média das linhas comparáveis sai do catálogo
antes de custar uma linha de dbt.

### Fase 4 — A janela de odds

O mercado entra no mart, o preço começa a acumular. A janela é **fixada antes de
olhar resultado** (ADR 0004: uma observação por linha; três preços do mesmo
palpite são liquidados pelo mesmo placar e não multiplicam amostra).

**Porta:** a janela tem que ter tamanho declarado antes de começar. A régua que
a task [B] usa é 400 jogos encerrados e precificados, 300 deles acima do piso de
cinco jogos de histórico, e zero Copa do Mundo.

### Fase 5 — Teste 2 e o peso

A tabela premissa a premissa, com as colunas que a [0.1] fixou:

```
Mercado | Premissa | n | benchmark de preço | A odd dava | Aconteceu | Diferença
```

O benchmark tem que estar declarado por mercado, porque a Pinnacle não cota
tudo. Escanteios vão cair em consenso, que é o grau mais fraco — e isso entra na
tabela como coluna, não como rodapé.

Peso sai de `max(ganho, 0) × n / (n + 50)`, com controle fora da amostra (R5).

**Porta:** premissa com ganho negativo ou com `n` pequeno demais nasce com peso
zero. Peso zero não é morte: ela continua sendo calculada e continua aparecendo
como leitura, só não abre porta.

### Fase 6 — Teste 3 e Teste 4, a porta de publicação

Teste 3 diz se contar premissa seleciona aposta. Teste 4 diz se a nota ordena. O
segundo é a pergunta de produto; o primeiro nunca a fez.

**Porta:** se o ROI não sobe com a nota, o mercado publica por contagem simples
ou não publica.

### Fase 7 — Publicação

Mercado entra na vitrine. A partir daqui, o ciclo é o mesmo dos outros cinco:
remedição periódica, e peso que não sobrevive vira zero.

---

## 5. O retrato do mercado de escanteios

Medido em 10/09/2026 sobre `futebol.fact_fixture_stats`, jogos encerrados.
Reproduz a fase 1 do método acima.

Tudo abaixo sai de `scripts/futebol-escanteios-retrato.mjs`, que está no
repositório justamente pela lição da seção 0 — a rodada de medição anterior
ficou num diretório temporário do sistema e só é retomável hoje por sorte.

### Cobertura (fase 0)

8.125 jogos com escanteio registrado desde 07/02/2024, 481 times, 13
competições. Nos jogos encerrados de 2026:

| Competição | Cobertura | Competição | Cobertura |
|---|---:|---|---:|
| brasileirao | 100% | ligue_1 | 100% |
| la_liga | 100% | bundesliga | 100% |
| serie_a_ita | 100% | sudamericana | 100% |
| premier_league | 100% | libertadores | 100% |
| primeira_liga | 99,5% | copa_mundo | 100% |
| serie_b | 98,9% | champions_league | **72,7%** |
| copa_do_brasil | **65,8%** | | |

Onze das treze passam a porta. As duas que não passam são as mesmas que já são
problema de amostra curta em todo o resto do produto.

### O total por jogo

Média 9,72 · desvio 3,44 · mediana 9 · p10 5 · p90 14. Mandante 5,31, visitante
4,23 — a vantagem de mando em escanteio é proporcionalmente **maior** que em
gols.

Isso coloca as linhas de mercado em torno de 8,5 a 10,5, que é exatamente onde
as casas cotam.

### Dispersão entre times

Com pelo menos 15 jogos no lado, o desvio entre médias de time é 1,00 em casa e
0,69 fora, contra um desvio de 3,44 dentro do jogo. Ou seja: **a identidade do
time explica pouco do que acontece num jogo específico.** Isso não é defeito de
escanteio — gols se comportam igual.

### Persistência — a medição que decide

Metade 1 dos jogos de cada time contra a metade 2, times com 30 jogos ou mais:

| Estatística | A favor | Sofridos |
|---|---:|---:|
| posse de bola | 0,822 | 0,822 |
| gols esperados | 0,781 | 0,722 |
| finalizações | 0,756 | 0,676 |
| **gols** | **0,748** | **0,625** |
| faltas | 0,705 | 0,668 |
| cartões amarelos | 0,647 | 0,538 |
| **escanteios** | **0,589** | **0,546** |

**Escanteio é um traço menos estável do time do que gol.** Isso contraria a
intuição comum — escanteio parece estatística de volume, e estatística de volume
costuma ser mais estável. Não é o caso aqui: ele fica na parte de baixo da
tabela, acima só de cartão.

Passa a porta da fase 1 (0,589 está acima de 0,4), mas passa na faixa de
expectativa baixa.

### Separação, point-in-time

Média dos últimos 10 jogos de cada time, só com partidas anteriores, somando
ataque de um com defesa do outro. Quintis da previsão, 5.980 jogos:

| Quintil | Previsto | Real | Acima de 9,5 |
|---|---:|---:|---:|
| 1 | 8,47 | 9,26 | 45,1% |
| 2 | 9,20 | 9,50 | 48,2% |
| 3 | 9,66 | 9,65 | 48,5% |
| 4 | 10,15 | 9,95 | 53,7% |
| 5 | 10,98 | 10,24 | 55,4% |

A mesma conta, no mercado de gols, para servir de régua:

| Quintil | Previsto | Real | Acima de 2,5 |
|---|---:|---:|---:|
| 1 | 2,02 | 2,31 | 41,4% |
| 2 | 2,36 | 2,47 | 44,4% |
| 3 | 2,61 | 2,62 | 50,0% |
| 4 | 2,87 | 2,76 | 52,6% |
| 5 | 3,34 | 3,10 | 60,8% |

**Escanteio separa 10,3 pontos entre o primeiro e o último quintil. Gol separa
19,4.** Pela nossa própria régua, escanteio é cerca de metade do mercado de gols
em capacidade de ordenar jogo.

Duas leituras importam:

**A previsão encolhe para a média nos dois mercados, e mais em escanteio.** O
quintil 5 previu 10,98 e saiu 10,24; o quintil 1 previu 8,47 e saiu 9,26. A
média do time exagera nas pontas. Qualquer premissa que compare soma de médias
contra a linha crua vai acender demais nos extremos — que é, aliás, o defeito da
premissa `defesas_vazaveis` do mercado de Gols, a única com margem zero e uma
das que mediram negativo.

**Nada disso é Teste 2.** Tudo acima é Teste 1: escanteio prevê a própria linha.
Se o preço já sabe disso, não há produto. E aqui há um motivo real para esperança
que gol não tem: escanteio é cotado por **quatro casas**, contra dezenas em gols.
Mercado fino erra mais. Mas isso é hipótese até a fase 5, não argumento.

### Escanteio não é um mercado, são cinco

Isto muda a conclusão, e é o motivo de a seção 6 não ser uma lista só. Os cinco
tipos de aposta que a coleta vai trazer pedem insumos diferentes, e eles não
valem a mesma coisa:

| id | Mercado | Insumo que ele pede | Persistência do insumo |
|---:|---|---|---:|
| 56 | Handicap de escanteios | **saldo** de escanteios do time | **0,619** |
| 45 | Total do jogo | escanteios a favor e sofridos | 0,589 / 0,546 |
| 57 | Escanteios do mandante | escanteios a favor, só em casa | 0,588 |
| 58 | Escanteios do visitante | escanteios a favor, só fora | **0,435** |
| 77 | Total do primeiro tempo | escanteio por tempo | **não existe** |

Duas coisas saltam.

**O saldo persiste mais que as pontas que o formam.** 0,619 contra 0,589 e
0,546. Faz sentido: quem domina jogo força escanteio e concede pouco, e as duas
metades erram na mesma direção quando o time enfrenta um adversário forte. Na
prática, a supremacia de escanteio é o traço mais estável que este mercado tem.

**O primeiro tempo não tem insumo nenhum.** A base inteira tem uma única coluna
de escanteio, `fact_fixture_stats.corner_kicks`, e ela é do jogo completo. Não
há como escrever premissa para o id 77 — ele pode ser coletado, mas não
modelado, e não deveria ir para a vitrine.

### A separação, mercado a mercado

Quintis da previsão point-in-time, sempre ao lado da régua equivalente em gols.

**Handicap de escanteio** — mandante cobrindo o −0,5:

| Quintil | Supremacia prevista | Saldo real | Mandante cobre |
|---|---:|---:|---:|
| 1 | −1,84 | −0,43 | 41,6% |
| 2 | −0,75 | +0,40 | 47,5% |
| 3 | −0,05 | +1,28 | 57,1% |
| 4 | +0,63 | +1,67 | 61,2% |
| 5 | +1,77 | +2,84 | 70,8% |

A régua, no handicap de gols que já existe: 28,2% no primeiro quintil e 62,6% no
quinto.

| Mercado | Separação entre o 1º e o 5º quintil | Régua em gols |
|---|---:|---:|
| **Handicap de escanteio** | **29,2pp** | 34,4pp |
| Total de escanteios | 10,3pp | 19,4pp |

**O handicap de escanteio chega a 84% da separação do handicap de gols. O total
de escanteios chega a 53% da do total de gols.** Dentro da família de escanteio,
o handicap separa quase três vezes mais que o total.

Isso inverte a ordem óbvia. A intuição manda começar pelo total, que é o mercado
mais conhecido e o que tem mais casa cotando. O dado manda começar pelo
handicap.

Uma ressalva honesta: o handicap de gols é justamente o mercado que a gente
desligou. Mas a causa do desligamento foi diagnosticada e é preço, não premissa
— o board publicava com vantagem média de −2,74%. A capacidade de ordenar jogo
nunca foi o problema dele.

### A varredura: todo insumo da base contra escanteio

Isto é a fase 3 aplicada aos insumos, antes de aplicá-la às premissas. Dezesseis
colunas de `fact_fixture_stats`, todas point-in-time sobre os dez jogos
anteriores, contra 5.980 jogos.

| insumo | persistência | prevê o total | prevê o saldo |
|---|---:|---:|---:|
| passes certos | 0,900 | −0,029 | 0,256 |
| passes | 0,894 | −0,031 | 0,257 |
| posse de bola | 0,825 | −0,007 | **0,271** |
| gols esperados | 0,781 | 0,014 | **0,280** |
| chutes de fora | 0,779 | 0,071 | 0,108 |
| finalização na área | 0,766 | 0,005 | 0,259 |
| finalizações | 0,752 | 0,045 | 0,242 |
| chutes ao gol | 0,724 | 0,030 | 0,247 |
| faltas | 0,710 | −0,012 | −0,061 |
| chutes para fora | 0,672 | 0,044 | 0,147 |
| cartões amarelos | 0,651 | 0,013 | −0,074 |
| bloqueios | 0,618 | 0,033 | 0,178 |
| **escanteios** | 0,589 | 0,051 | 0,221 |
| defesas do goleiro | 0,473 | 0,063 | −0,149 |
| impedimentos | 0,281 | 0,000 | 0,018 |

Duas colunas contam histórias opostas.

**A do total é toda zero.** O melhor preditor do total de escanteios de um jogo é
chute de fora da área, com 0,071 — menos de 1% da variação explicada. Não é
escolha ruim de insumo: é que nenhum insumo que temos sabe quantos escanteios um
jogo vai ter.

**A do saldo funciona, e o escanteio é o oitavo colocado.** Gols esperados e
posse preveem a supremacia de escanteio melhor do que o próprio histórico de
escanteio.

Também medido e descartado: **árbitro**. A persistência do árbitro entre a
primeira e a segunda metade dos jogos dele é 0,128, e o poder preditivo 0,033.
Não existe árbitro de muito escanteio.

### O que o próprio mercado sabe

Antes de concluir qualquer coisa sobre o total, vale saber contra quem estamos
competindo.

| | correlação com o resultado | desvio da previsão | desvio do real |
|---|---:|---:|---:|
| nossa previsão de escanteios | 0,097 | 0,90 | 3,43 |
| **a linha do mercado de escanteios** | **0,163** | 0,57 | 3,56 |
| régua: a linha de gols prevendo gols | 0,266 | 0,36 | 1,69 |

As casas, com tudo que elas têm, chegam a 0,163 — e mexem a linha de escanteio
entre jogos com desvio de 0,57 contra um resultado que varia 3,56. O mercado
também trata o total de escanteio como quase constante.

Ou seja, a distância entre nós e o melhor previsor disponível é pequena porque o
previsível é pouco, para todo mundo. Isso muda o que "faltam dados" significa: não
é volume do que já temos.

### O que existe e ainda não foi testado

Uma correção de registro: **a coleta de eventos existe.** O
`fixture_events_extractor` bate no `/fixtures/events`, guarda um registro por
evento com minuto, time, jogador e tipo, e vira `fact_fixture_events` no
BigQuery. Não está sincronizado no Postgres.

Escanteio não é evento na API — os tipos são gol, cartão, substituição e VAR —,
então isso não dá o minuto do escanteio. Mas dá **placar minuto a minuto**, e daí
sai uma premissa pré-jogo que ninguém testou: **time que costuma estar atrás no
fim do jogo empurra e força escanteio**. É estrutural, é calculável do histórico,
e é a única hipótese viva para o mercado de mais e menos.

O que realmente não existe, conferido no `stg_futebol_fixture_statistics`: o
modelo pivota dezoito tipos, e são exatamente os dezoito que o endpoint devolve.
Não há descarte como houve nas odds. Cruzamento, entrada no terço final e ataque
pelo lado não estão nessa fonte.

---

## 6. A simulação de ROI

As odds de escanteio também estão no Postgres, sincronizadas, com histórico de
16/06 em diante. Isto é a fase 6 antecipada — Teste 3 e Teste 4 com um catálogo
provisório, feito para descobrir a forma do problema, não para fixar peso.

### A armadilha da ótica, de novo

No mercado 56 as casas cotam **"Home −4,5" e "Away −4,5" como par**, com odds
complementares. A linha é sempre na ótica do mandante, igual ao handicap de gols.
Liquidar pela leitura literal do rótulo inverte um dos lados e produz número
plausível e errado.

A validação que fecha: casa e fora têm que somar exatamente 100% em cada linha.

| linha | casa cobre | fora cobre |
|---:|---:|---:|
| −3,5 | 36,9% | 63,1% |
| −2,5 | 44,5% | 55,5% |
| −1,5 | 52,5% | 47,5% |
| −0,5 | 55,5% | 44,5% |
| +0,5 | 54,7% | 45,3% |
| +1,5 | 65,8% | 34,2% |

### O universo

1.464 linhas, 373 jogos liquidados. Meia linha, melhor odd, mínimo de três casas,
janela t24h, aposta de uma unidade.

### ROI geral e por lado

| | linhas | ROI | erro-padrão |
|---|---:|---:|---:|
| mercado inteiro | 1.464 | −3,77% | 0,45 |
| lado casa | 732 | **+1,09%** | 4,91 |
| lado fora | 732 | **−8,64%** | 4,71 |

E o corte que carrega o sinal **é o mando, não o favoritismo**:

| | ROI |
|---|---:|
| casa favorito | +1,14% |
| casa azarão | +0,88% |
| fora favorito | −5,81% |
| fora azarão | −9,24% |

Dentro de casa, favorito e azarão dão a mesma coisa. É diferente do handicap de
gols, onde o eixo é o favoritismo, e muda o desenho do catálogo.

### ROI por premissa, dentro do lado

Medir a premissa sem controlar o lado dá tudo positivo em casa e tudo negativo
fora — é o viés de lado se disfarçando de efeito de premissa, o mesmo que já
enganou no handicap de gols. Controlado:

| premissa | casa | fora | veredito |
|---|---:|---:|---|
| escanteio | **+10,80** | **+11,08** | fica nos dois lados |
| posse | +15,26 | −10,74 | só casa |
| gols esperados | +14,84 | −13,75 | só casa |
| finalização na área | +7,44 | −13,55 | só casa |
| adversário cede escanteio | −1,58 | −5,47 | sai |
| decisão (mata-mata) | −1,59 | +7,01 | só fora |

**Histórico de escanteio é a única que sobrevive nos dois lados.** Posse, gols
esperados e finalização na área rendem forte quando é o mandante que domina e
viram contra quando é o visitante.

Isto é a diferença entre Teste 1 e Teste 2 em estado puro: na varredura acima,
posse e gols esperados preveem o saldo melhor que escanteio. Contra o preço, é o
contrário.

### ROI por faixa de odd

| faixa | linhas | ROI | erro-padrão |
|---|---:|---:|---:|
| até 1,60 | 172 | −9,66% | 5,79 |
| 1,60 a 1,90 | 442 | −7,43% | 4,12 |
| **1,90 a 2,10** | 474 | **+3,85%** | 4,43 |
| 2,10 a 2,50 | 290 | −9,82% | 6,64 |
| 2,50 ou mais | 86 | +5,19% | 14,10 |

Só a faixa de linha equilibrada sobrevive.

### O Score, na régua de produção

A conta é a mesma dos cinco mercados: soma do peso das premissas acesas, dividida
pelo teto, normalizada em 0 a 100, com faixas em 30 e 60. O que muda entre as duas
versões abaixo é **de onde vem o peso**.

**Versão A — peso do Teste 1.** A força preditiva medida em 5.980 jogos, sem
olhar odd nem resultado financeiro. Mesmas quatro premissas nos dois lados: gols
esperados 14, posse 14, área 13, escanteio 11. Teto 52.

| faixa | linhas | % do board | ROI | erro-padrão |
|---|---:|---:|---:|---:|
| Alta | 250 | 17,1% | +1,09% | 9,00 |
| Média | 179 | 12,2% | −7,07% | 9,76 |
| Baixa | 1.035 | 70,7% | −4,38% | 3,64 |

Não ordena. E por lado se vê o motivo: casa Alta **+19,02%**, fora Alta
**−18,34%**. Peso simétrico num mercado assimétrico.

**Versão B — premissas e pesos por lado.** Casa com posse 15, gols esperados 15,
escanteio 11, área 7, teto 48. Fora só com escanteio 11 e decisão 7, teto 18.

| faixa | linhas | % do board | ROI | erro-padrão |
|---|---:|---:|---:|---:|
| Alta | 314 | 21,4% | +7,69% | 7,64 |
| Média | 242 | 16,5% | +1,24% | 8,27 |
| Baixa | 908 | 62,0% | −9,07% | 3,99 |

Ordena, e nos dois lados. **Mas é circular**: os pesos saíram desta amostra e o
ROI foi medido nela. O +7,69% é teto, não estimativa — a medição do próprio time
já mostrou o tamanho desse viés, com um filtro que rende +8,3% definido na mesma
amostra e −6,2% definido só na primeira metade.

O que a versão B estabelece com honestidade não é o número, é a **forma**: o
catálogo tem que ser diferente por lado. A versão A prova isso pelo avesso, ao
falhar exatamente por ser simétrica — e esse motivo não depende da circularidade.

### A armadilha do teto, que é o defeito mais grave

Na versão B o teto de casa é 48 e o de fora é 18. Para ser faixa Alta basta 60%
do teto.

| lado | pontos para ser Alta | o que basta |
|---|---:|---|
| casa | 28,8 de 48 | duas premissas |
| fora | 10,8 de 18 | **a de escanteio sozinha, que vale 11** |

O resultado é que **o lado com metade das premissas produz mais faixa Alta que o
outro**:

| lado | linhas Alta | % do lado | ROI da Alta |
|---|---:|---:|---:|
| casa | 142 | 19,4% | **+17,21%** |
| fora | 172 | 23,5% | **−0,16%** |

São 160 linhas de fora que viram Alta com uma única premissa acesa, e elas dão
−2,42%.

Cruzando com favorito e azarão, a faixa Alta de fora ainda mistura duas coisas
opostas:

| | linhas Alta | ROI |
|---|---:|---:|
| casa favorito | 142 | +17,21% |
| fora favorito | 78 | −10,51% |
| fora azarão | 94 | +8,43% |

É o mesmo defeito que o handicap de gols já tem — azarão com teto 13 contra 35 do
favorito — e que a task [A] corrigiu subindo o teto do azarão para 30. Aqui a
correção é pré-requisito de qualquer publicação: **o teto não pode premiar o lado
por ter menos premissa.**

E o eixo do catálogo provavelmente não é mando sozinho, é mando cruzado com
favoritismo, em quatro grupos. Casa favorito é o único que anda bem.

### A ressalva que vale para tudo nesta seção

Todos os erros-padrão acima estão entre 4 e 25 pontos, sobre números de 1 a 19.
São 373 jogos, e depois de partir por lado e faixa sobram de 30 a 170 linhas por
célula. **Nada aqui é significativo isoladamente.**

O que sustenta a leitura é a coerência do padrão — a inversão por lado aparece em
quatro premissas independentes, no score e na faixa, sempre na mesma direção — e
não o tamanho de nenhum número.

Não dá para escrever peso com isto. Dá para escrever hipótese.

---

## 7. A recomendação

### Por mercado

| id | mercado | decisão |
|---:|---|---|
| 56 | Corners Asian Handicap | **primeiro**, e é o único com sinal estrutural |
| 45 | Corners Over/Under (mais e menos) | **espera um teste**: a premissa de placar no fim |
| 57 | Home Corners O/U | depois do 56, reaproveita o catálogo |
| 58 | Away Corners O/U | só se o 57 medir bem — persistência 0,435 raspa o piso |
| 77 | Total 1º tempo | fora: sem insumo por tempo na base |

O mais e menos não sai por ser ruim de mercado; sai porque nenhum insumo que
temos prevê o total, e a única hipótese não testada é a de placar minuto a minuto,
vinda de `fact_fixture_events`. Se ela falhar, o mercado sai de vez. Se acertar,
ele volta com catálogo próprio.

### O catálogo do handicap, revisado pelo ROI

Quatro grupos, não dois: mando cruzado com favoritismo. O teto tem que ser
igualado entre os grupos antes de qualquer publicação.

**Casa** — as quatro de domínio mais escanteio:

| premissa | regra | por que este limiar |
|---|---|---|
| Domina a posse | diferença de posse média ≥ 5,8 pontos | p75 da distribuição simétrica |
| Cria mais chance | diferença de gols esperados ≥ 0,34 | p75 |
| Força mais escanteio | diferença de média de escanteios ≥ 1,0 | p75 |
| Ataca mais dentro da área | diferença de finalizações na área ≥ 1,6 | p75 |

**Fora** — só o que sobrevive ao controle de lado:

| premissa | regra | por que este limiar |
|---|---|---|
| Força mais escanteio | diferença de média de escanteios ≥ 1,0 | p75, e é a única positiva nos dois lados |
| Decisão | mata-mata | saldo do mandante em mata-mata é +1,95 contra +1,13 |

**Fora do catálogo, medido:** "adversário cede escanteio" dá −1,58 em casa e
−5,47 fora. Sai antes de custar uma linha de dbt.

**A medir, ainda sem número:** must win de liga — reta final com posição em jogo.
Precisa de um seed por campeonato dizendo quais posições importam, porque
`fact_standings_snapshot` traz rank, pontos e jogos mas não traz a fronteira.

---

## 8. O que este documento não resolve


**Não recupera o porquê dos 39 limiares originais.** Os dois documentos de origem
não existem, e não estão no git. O que dá para fazer é o que a seção 4 faz:
exigir o campo daqui para frente.

**Não fixa peso nenhum.** A seção 6 mede, e mede com erro-padrão maior que o
efeito. Tudo ali é hipótese nomeada, não calibragem. O peso precisa de amostra
maior e de controle fora da amostra (R5), e nenhuma das duas coisas existe hoje.

**Não testa a premissa de placar no fim.** É a única hipótese viva para o mercado
de mais e menos, depende de `fact_fixture_events`, que está no BigQuery e não no
Postgres. Não foi medida aqui.

**Não resolve o must win de liga.** O mata-mata está medido; a reta final com
posição em jogo precisa de um seed por campeonato com as fronteiras da tabela, e
esse seed não existe.

**Não iguala os tetos.** A seção 6 mostra que o teto por lado distorce a faixa, e
diz que precisa ser corrigido. Não diz em quanto — isso é decisão de produto, como
foi no handicap de gols.

**Não reabre a task [B].** A limpeza do catálogo dos cinco mercados continua
bloqueada pelos cinco termos declarados nela. Este documento não altera nenhum.

---

## Fontes

- ClickUp `86aj4p7b5` e as cinco tasks filhas — o catálogo original, 19/06/2026
- ClickUp `wdx6zev64w` — a auditoria point-in-time
- ClickUp `wdx6zevfgf` e issues tech-lamjav/analytics-engineering #3 a #10 — a remedição
- ClickUp `wdx6zev64y` — o ranking medido das 39 premissas
- issues #49 a #59 — como o histórico entra nas premissas
- `dbt_futebol/CONTEXT.md`, seção Measurement and calibration — o vocabulário dos Testes
- `dbt_futebol/docs/adr/0001`, `0004`, `0008`, `0010` — as decisões de método citadas
- `supabase/migrations/093_futebol_mapa_premissas.sql` — a virada de 01/08
- `futebol.fact_fixture_stats` e `futebol.fact_fixtures` — as medições da seção 5
- `futebol.fact_odds_snapshot` no Postgres — as odds de escanteio da simulação da seção 6
- `scripts/futebol-escanteios-retrato.mjs` — reproduz as medições da seção 5
