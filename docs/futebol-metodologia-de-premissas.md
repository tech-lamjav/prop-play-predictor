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

### Quando o Teste 2 fica possível

No ritmo atual — 61 jogos encerrados por semana nas 13 competições — a régua de
400 jogos precificados leva **cerca de sete semanas** depois que as odds de
escanteio entrarem no mart, se a cobertura de escanteio nas casas for parecida
com a de gols. Sendo quatro casas, é razoável esperar mais.

Isso define o calendário: catálogo e Teste 1 podem sair agora; peso, não antes
de novembro.

---

## 6. A recomendação, e o catálogo inicial

### A ordem

| Ordem | Mercado | Por quê |
|---|---|---|
| 1º | **Handicap de escanteios** (56) | melhor insumo (0,619) e melhor separação (29,2pp) da família |
| 2º | **Total do jogo** (45) | separação fraca, mas é o mercado que o assinante reconhece |
| 3º | **Escanteios do mandante** (57) | 0,588, e reaproveita o catálogo do total |
| — | **Escanteios do visitante** (58) | 0,435 raspa o piso da fase 1; entra só se o 57 medir bem |
| — | **Primeiro tempo** (77) | sem insumo na base; coletar sim, publicar não |

### Os limiares medidos

Tudo abaixo sai da base, não do olho. Times com 15 jogos ou mais no lado.

| Grandeza | Mandante | Visitante |
|---|---:|---:|
| escanteios a favor, mediana | 5,33 | 4,15 |
| escanteios sofridos, p75 | 4,90 | 5,94 |
| saldo de escanteios, p25 | −0,13 | −2,11 |
| saldo de escanteios, p75 | +2,06 | −0,41 |

Por jogo, sobre 8.125 partidas: finalizações somadas com mediana 25 e p75 29;
diferença de posse com mediana 16 pontos e p75 28.

### Catálogo do handicap de escanteios (56)

**Lado favorito** — o que dá o handicap.

| Premissa | Regra | Grupo | Por que este limiar |
|---|---|---|---|
| Domina o jogo pelo lado | saldo médio de escanteios ≥ +2,0 | decide | p75 do mandante (+2,06); é o quartil superior de supremacia |
| Encurrala o adversário | diferença de posse média ≥ 28 pontos | decide | p75 medido da diferença por jogo; a mediana (16) pegaria metade dos jogos |
| Chuta muito mais | diferença de finalizações médias ≥ 6 | decide | metade do p75 de finalizações somadas, aplicada à diferença; a medir |
| Adversário cede escanteio fora | escanteios sofridos do visitante ≥ 5,9 | decide | p75 medido de sofridos fora |
| Joga melhor pelo lado em casa | saldo em casa especificamente ≥ +2,0 | decide | mesmo corte, mas com o histórico recortado pelo mando — o mando persiste 0,588 em casa |

**Lado azarão** — o que recebe o handicap.

| Premissa | Regra | Grupo | Por que este limiar |
|---|---|---|---|
| Segura o jogo fora | saldo médio fora ≥ −0,4 | decide | p75 medido do saldo fora; é o visitante do quartil superior |
| Não se encolhe fora | posse média fora ≥ 45% | decide | chute, a medir; é o ponto em que o time deixa de ser o encurralado |
| O favorito não domina pelo lado | saldo médio do adversário ≤ +1,0 | decide | metade do p75; premissa de negação, espelha `favorito_irregular` do handicap de gols |

O lado azarão nasce com três premissas e a porta de contexto pede duas. Isso é
proposital, e é a correção do defeito conhecido do handicap de gols, onde o
azarão tem exatamente duas premissas de peso e por aritmética só publica quando
as duas acendem.

### Catálogo do total de escanteios (45)

**Lado Mais**

| Premissa | Regra | Grupo | Por que este limiar |
|---|---|---|---|
| Os dois forçam escanteio | soma das médias a favor ≥ linha + 0,5 | decide | espelha `ataque_combinado` do Gols; margem 0,5 e não zero por causa do encolhimento da seção 5 |
| Os dois cedem escanteio | soma das médias sofridas ≥ linha + 0,5 | decide | mesma margem, pelo mesmo motivo |
| Jogo de muita finalização | soma das médias de finalizações ≥ 29 | decide | p75 medido; finalização persiste 0,756, bem mais que escanteio |
| Assimetria de posse | diferença de posse média ≥ 28 pontos | decide | p75 medido; time encurralado cede escanteio |
| Mandante que pressiona | escanteios a favor do mandante em casa ≥ 5,3 | decide | mediana medida do mandante; a vantagem de mando em escanteio é 25%, maior que em gols |

**Lado Menos**

| Premissa | Regra | Grupo | Por que este limiar |
|---|---|---|---|
| Os dois forçam pouco escanteio | soma das médias a favor ≤ linha − 0,5 | decide | espelho |
| Os dois cedem pouco escanteio | soma das médias sofridas ≤ linha − 0,5 | decide | espelho |
| Jogo de pouca finalização | soma das médias de finalizações ≤ 25 | decide | mediana medida |
| Equilíbrio de posse | diferença de posse média ≤ 5 pontos | decide | chute, a medir; jogo equilibrado tende a menos pressão prolongada |

### Catálogo dos escanteios de um time (57 e 58)

As mesmas quatro, com o histórico recortado pelo mando do time apostado:
ataque próprio contra a linha, defesa do adversário contra a linha, finalizações
do time, e posse do time. O corte usa a mediana do lado — 5,33 em casa, 4,15
fora — em vez da soma dos dois.

Vale registrar que o 58 entra com expectativa pior que todo o resto: a
persistência do visitante é 0,435, e 0,4 é o piso.

### O que fica deliberadamente fora

**Histórico recente, por R2.** Nada de "três dos últimos cinco acima da linha".
O achado transversal diz que não ajuda em nenhum mercado, e não há motivo para
escanteio ser exceção. Se alguém quiser, que entre como controle — para
confirmar o achado, não para publicar.

**Escanteios por finalização, medido e cortado na fase 3.** A ideia era capturar
estilo: time que ataca pelo lado converte mais finalização em escanteio. O dado
diz que a razão quase não varia — p10 0,339, mediana 0,379, p90 0,431, desvio
0,036. É praticamente uma constante do futebol, não um traço de time. Custaria
uma linha de dbt para acender quase igual em todo mundo.

Este é o primeiro uso prático da fase 3: a premissa morreu antes de custar
código, e o motivo ficou escrito.

---

## 7. O que este documento não resolve

**Não recupera o porquê dos 39 limiares originais.** Os dois documentos de origem
não existem, e não estão no git. O que dá para fazer é o que a seção 4 faz:
exigir o campo daqui para frente.

**Não mede escanteio contra preço.** Tudo na seção 5 é Teste 1. A conclusão de
que escanteio é metade do mercado de gols vale para "prever a linha", e pode se
inverter em "bater o preço" — mercado com quatro casas é outro bicho. Só a fase 5
responde.

**Não decide se escanteio entra.** A decisão de investir nele contra outra
frente é de produto. O que este documento acrescenta é a ordem: se entrar, entra
pelo handicap, e o total vem depois com expectativa calibrada para baixo.

**Não confere os limiares contra o preço.** Os cortes da seção 6 saem da
distribuição da nossa base — p75, mediana, quartil. Isso decide quantas vezes a
premissa acende, não se ela vale. O que ela vale é a fase 5.

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
