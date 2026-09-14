# Revisão do handicap asiático

> **Status:** medição concluída em 2026-09-10 · **Branch:** `analise/futebol-handicap`
> **Pergunta:** por que as premissas do handicap não performam, e o que precisa
> mudar para o mercado voltar à vitrine.
> **Reprodução:** `node scripts/futebol-handicap-premissas.mjs`

O handicap saiu da vitrine em 01/09/2026 e continua sendo publicado e medido no
board. Este documento mede as premissas dele contra resultado, separando lado,
tamanho da linha, preço, mando e campeonato, e responde o que precisa ser
arrumado antes de religar.

---

## 0. A causa raiz

**O produto publica pagando pior que a referência sharp, e a odd longa multiplica
esse erro. Não há nada além disso.**

A média de vantagem das 604 oportunidades de handicap publicadas é −2,74%, e só
49 delas têm vantagem positiva. Isso não é acidente de execução: é a consequência
direta da revisão de 01/08/2026, que tirou o preço da nota **de propósito** e o
rebaixou a filtro de sanidade. A porta de publicação passou a ser contexto puro.
Uma porta que não olha preço publica descorrelacionada do preço, e o board cai
onde cair.

O quanto isso custa depende de onde a linha cai, e é aí que o handicap entra:

| Vantagem sobre a linha sharp | odd < 2,00 | odd ≥ 2,00 |
|---|---:|---:|
| acima de −2% | +16,3% (n=60) | +27,5% (n=33) |
| abaixo de −2% | −6,3% (n=95) | −23,2% (n=186) |

E a mesma tabela só com o que foi detectado **depois do tombamento** de 04/09
14h35, que é a régua de hoje (ver a seção 1 sobre por que isso precisa ser
separado):

| Vantagem sobre a linha sharp | odd < 2,00 | odd ≥ 2,00 |
|---|---:|---:|
| acima de −2% | +23,8% (n=25) | +59,2% (n=9) |
| abaixo de −2% | −7,3% (n=32) | −36,1% (n=60) |

A tabela se lê pelas linhas. **Com preço bom, a odd longa não atrapalha** — ela
até ajuda, porque ganhar pagando bem paga mais. **Com preço ruim, a faixa de odd
decide tudo** — de −6% para −23% no board inteiro, e de −7% para −36% na metade
recente. A odd longa não causa prejuízo: ela multiplica o prejuízo de ter pago
mal. O handicap é o pior mercado do board porque é o que vive nas odds longas, e
não porque as premissas dele sejam piores que as dos outros.

### O que NÃO é causa

Três recortes que parecem vazamento e são o preço aparecendo com outro nome. O
teste é sempre o mesmo: segurar a faixa de odd e ver se a diferença sobrevive.

| Recorte | Diferença bruta | Controlada por preço |
|---|---:|---:|
| favorito contra azarão | −11,9pp | **+12,2pp** |
| handicap de 1,5 ou mais contra 0,5 | −5,6pp | **+0,4pp** |
| mandante contra visitante | −5,8pp | −4,9pp |

O lado **inverte de sinal**. Na tabela bruta o azarão parece muito melhor que o
favorito; dentro da mesma faixa de odd o favorito rende 12,2pp a mais. A vantagem
aparente do azarão era composição: favorito vive em odd longa, azarão em odd
curta. O tamanho do handicap **evapora**, de −5,6pp para nada, porque handicap
grande e odd longa são a mesma variável dita duas vezes. Só o mando sobrevive, e
fraco.

### O que é causa secundária, e de tamanho errado para resolver

As premissas carregam sinal próprio, e ele **sobrevive** ao controle de preço:

| Premissa | Controlando tamanho da linha | Controlando preço |
|---|---:|---:|
| `supremacia` | +13,4pp ± 8,2 | +10,8pp ± 7,5 |
| `tende_golear` | +11,6pp ± 10,1 | +10,5pp ± 9,7 |
| `sem_rodizio` | +6,7pp ± 8,1 | +6,2pp ± 8,2 |
| `favorito_irregular` | +5,0pp ± 3,3 | +4,2pp ± 2,5 |
| `raramente_perde_por_2` | +3,4pp ± 3,2 | +1,7pp ± 2,4 |
| `mando_forte` | −3,2pp ± 8,0 | −4,6pp ± 7,1 |
| `defesa_fora_solida` | −2,1pp ± 2,8 | −3,8pp ± 2,4 |
| `adversario_fragil_fora` | −5,5pp ± 7,8 | −6,3pp ± 7,1 |

Então o método não está errado, está subdimensionado. Os defeitos de encanamento
da seção 2 — peso divergente entre mart e catálogo, premissa que a tela não
conhece, porta que não é porta — são reais e valem consertar, mas mexem nesses 5
a 10 pontos. Não encostam nos 25 que o preço custa.

### Por que nada disso apareceu antes

Até 09/09/2026 nada era medido contra resultado: a regra de liquidação rodava no
navegador e era descartada ao fechar a aba, e o script que fecha essa malha tem
cinco dias (#388). Num sistema sem malha fechada toda regra é decidida por
argumento, e nada denuncia o desacordo. É por isso que a recalibragem de agosto
pôde chegar ao frontend e não ao mart e durar um mês, e é por isso que
`linha_sharp_confirma` está `false` em 100% das 2.371 publicações desde sempre
sem ninguém notar.

---

## 1. O que foi medido

Duas populações diferentes, e a diferença entre elas é o ponto de partida.

**O board** são as 604 oportunidades de handicap publicadas na escala
`contexto_v1`, das quais 374 já têm placar. Os dois números crescem a cada rodada
do dbt — subiram de 600 e 344 no meio da escrita deste documento —, então qualquer
total aqui é a foto de 10/09/2026 e o script vai devolver outro. É o que
`scripts/futebol-roi.mjs` já media. Serve para dizer quanto o produto rendeu, e não serve para avaliar
premissa: toda linha ali dentro já passou pela porta, então a amostra é o próprio
filtro que se quer julgar.

O board tem um problema de composição que precisa ser dito antes de qualquer
número dele: **248 das 374 linhas liquidadas vêm de um único dia**. Em 03/09 o
snapshot capturou o board inteiro de uma vez, e essa captura responde por dois
terços da amostra. Além disso, em 04/09 às 14h35 UTC o denominador da nota trocou
do p95 para o teto de pontos, e linha anterior a isso tem Score em outra escala.
Por isso toda tabela de board neste documento sai duas vezes: o board inteiro, e
só o que foi detectado depois do tombamento.

A vantagem sobre a linha sharp **não** foi afetada pela troca de escala — ela é
estável em todos os dias, entre −2,4% e −3,3%. É por isso que as duas metades
respondem a mesma pergunta, e é por isso que o achado da seção 0 sobrevive: ele
aparece nas duas, e mais forte na metade recente.

**O universo** são as 5.208 linhas de handicap de meio gol que tiveram preço
coletado a T−24h em pelo menos três casas, com jogo encerrado, entre 16/06 e
10/09/2026 — publicadas ou não. É quinze vezes o board, e é a única população em
que a pergunta "esta premissa separa?" tem resposta, porque inclui as linhas que
a porta recusou.

O preço do universo foi reconstruído de `fact_odds_snapshot`, que é imutável.
`int_futebol_odds_devig` **não serve**: ela é recalculada a cada rodada do dbt, e
contra as linhas já liquidadas a odd dela está em média 0,75 acima da que foi
publicada, o que sozinho transforma um ROI de −10,6% em +33%. A reconstrução foi
conferida contra o board: em 598 das 600 linhas publicadas, a melhor odd
reconstruída bate com a que foi ao ar.

Duas leituras de preço saem em toda tabela. A **melhor odd** entre as casas é o
que o assinante consegue, e é o número do produto. A **mediana** é o mercado, e é
a régua para comparar recortes sem que o vencedor de cada um seja "quem teve uma
casa fora da curva". No universo inteiro: taxa 49,5%, ROI −9,7% na melhor odd e
−13,2% na mediana.

---

## 2. Três defeitos de encanamento, antes de qualquer discussão de método

Estes não são achados estatísticos. São divergências verificáveis entre o que o
mart calcula e o que `src/utils/futebol-premissas.ts` descreve, e qualquer
recalibragem feita antes de resolvê-los recalibra o arquivo errado.

**Os pesos do mart não são os pesos do catálogo.** Recuperados do dado pelo mesmo
método que o comentário do catálogo já usa para Ambos marcam e Dupla chance —
linha com uma única premissa acesa e nenhuma penalidade tem `pts_premissas` igual
ao peso daquela premissa:

| Premissa | Peso no mart | Peso no catálogo | Lado |
|---|---:|---:|---|
| `supremacia` | 12 | 12 | favorito |
| `tende_golear` | 10 | **16** | favorito |
| `adversario_fragil_fora` | 8 | **2** | favorito |
| `mando_forte` | 6 | **2** | favorito |
| `sem_rodizio` | 4 | **3** | favorito |
| `raramente_perde_por_2` | 12 | **3** | azarão |
| `defesa_fora_solida` | 10 | 10 | azarão |
| `favorito_irregular` | 8 | **não existe** | azarão |
| `handicap_alto` (penalidade) | −12 | **0** | ambos |

O mart aplica uma escada genérica de 12/10/8/6/4 e a soma dos dois lados dá 40 e
30, não os 35 e 13 que o catálogo descreve. A recalibragem de 01/08/2026 — a que
concluiu que histórico recente não ajuda e que característica estrutural ajuda —
**chegou ao frontend e não chegou ao mart**. A nota que gera, ordena e publica o
handicap é anterior a ela.

**Existe uma nona premissa que a tela não conhece.** `favorito_irregular` acende
em 1.725 das 2.575 linhas de azarão do universo, vale 8 pontos no mart, e não
está no catálogo. Consequência direta: uma linha publicada por causa dela mostra
menos premissas na tela do que o backend usou para publicá-la, e o azarão — que
o catálogo descreve como "só passa se as duas acenderem, o lado mais difícil de
publicar do produto inteiro" — na verdade tem três premissas e passa com
folga. Os 144 azarões liquidados no board contra 200 favoritos confirmam: o lado
supostamente impossível publica quase tanto quanto o outro.

**A penalidade de handicap alto existe e pesa 12.** O catálogo registra peso 0
com o motivo "efeito zero nos dois testes". No mart ela desconta 12 pontos, o que
é o segundo maior número do mercado.

---

## 3. As tabelas brutas, e por que elas enganam

Esta seção existe para registrar o que se vê antes de controlar por preço, porque
é o que qualquer um vai ver ao abrir o dado pela primeira vez — e porque duas
destas três leituras estão erradas, do jeito descrito na seção 0.

### O lado, e o tamanho da linha (artefato de preço)

| Recorte | n | taxa | ROI (melhor odd) | erro-padrão |
|---|---:|---:|---:|---:|
| azarão | 2.575 | 73,3% | −3,6% | ±1,3pp |
| favorito | 2.633 | 26,2% | −15,6% | ±3,5pp |
| handicap −1,5 | 970 | 20,1% | −25,0% | ±5,7pp |
| handicap −0,5 | 965 | 40,5% | −7,5% | ±4,1pp |
| handicap +1,5 | 946 | 79,4% | −2,2% | ±1,8pp |

Lido assim, o favorito perde quatro vezes mais que o azarão e o buraco todo está
no handicap de 1,5 gol. **Está errado.** Dentro da mesma faixa de odd o favorito
rende 12,2pp a MAIS que o azarão, e o handicap grande some junto, porque handicap
grande e odd longa são a mesma coisa dita duas vezes. O que estas duas tabelas
medem é a faixa de preço em que cada lado costuma viver.

### O preço (a causa)

| Faixa de odd | n | taxa | ROI (melhor odd) | erro-padrão |
|---|---:|---:|---:|---:|
| 1,00–1,39 | 1.718 | 85,7% | −0,9% | ±1,0pp |
| 1,40–1,59 | 361 | 68,7% | +1,8% | ±3,6pp |
| 1,60–1,99 | 546 | 58,2% | +3,2% | ±3,8pp |
| 2,00–2,59 | 490 | 39,8% | −10,6% | ±5,0pp |
| 2,60–3,99 | 665 | 26,5% | −14,7% | ±5,6pp |
| 4,00+ | 1.428 | 11,8% | −25,3% | ±5,8pp |

Monótona, com erro-padrão pequeno, em 5.208 linhas. Acima de 2,00 o mercado
sangra, e abaixo de 2,00 ele é neutro ou levemente positivo. O produto publica
handicap entre 1,50 e 4,00, ou seja, **a faixa de publicação atravessa a fronteira
e pega os dois lados dela**. No board de 344 linhas liquidadas, 201 estão acima de
2,00.

### O mando (sobrevive, e é pequeno)

| Recorte | n | taxa | ROI | erro-padrão |
|---|---:|---:|---:|---:|
| mandante | 2.608 | 47,2% | −12,6% | ±2,7pp |
| visitante | 2.600 | 51,8% | −6,7% | ±2,7pp |

Este é o único dos três recortes brutos que sobra depois do controle: a diferença
cai de 5,8pp para 4,9pp quando se segura a faixa de odd. Apostar no time de casa
é de fato um pouco pior. Isso conversa com a seção 4: as duas premissas do
catálogo que falam de mando (`mando_forte` e `adversario_fragil_fora`) são as duas
que não medem nada.

---

## 4. O que cada premissa vale de fato

A coluna que decide é a **diferença estratificada**: acesa contra apagada dentro
de cada tamanho de handicap, e só depois somada. Sem estratificar, a comparação
mede o tamanho da linha e chama isso de premissa, porque as premissas do favorito
acendem mais nos handicaps grandes, que são os que mais perdem.

**Favorito** (2.633 linhas, ROI base −15,6%)

| Premissa | n acesa | ROI acesa | ROI apagada | Diferença estratificada | Peso no mart |
|---|---:|---:|---:|---:|---:|
| `supremacia` | 761 | −5,4% | −19,7% | **+13,4pp ± 8,2** | 12 |
| `tende_golear` | 378 | −4,2% | −17,5% | **+11,6pp ± 10,1** | 10 |
| `sem_rodizio` | 673 | −10,7% | −17,2% | +6,7pp ± 8,1 | 4 |
| `adversario_fragil_fora` | 791 | −18,4% | −14,4% | −5,5pp ± 7,8 | 8 |
| `mando_forte` | 782 | −16,3% | −15,2% | −3,2pp ± 8,0 | 6 |

**Azarão** (2.575 linhas, ROI base −3,6%)

| Premissa | n acesa | ROI acesa | ROI apagada | Diferença estratificada | Peso no mart |
|---|---:|---:|---:|---:|---:|
| `favorito_irregular` | 1.725 | −2,0% | −6,9% | **+5,0pp ± 3,3** | 8 |
| `raramente_perde_por_2` | 1.623 | −2,5% | −5,6% | **+3,4pp ± 3,2** | 12 |
| `defesa_fora_solida` | 1.049 | −4,9% | −2,7% | −2,1pp ± 2,8 | 10 |

Quatro leituras:

**As premissas separam.** Cinco das oito apontam na direção certa, e duas de cada
lado chegam a 1,5 erro-padrão em amostra de milhares de linhas. Isso é mais do que
a metodologia escrita concede ao mercado, e é o argumento contra aposentá-lo.

**O catálogo acertou o favorito e errou o azarão.** No lado do favorito, o
catálogo já sabia que `mando_forte` e `adversario_fragil_fora` são preço — deu 2 a
cada uma — e a medição confirma: as duas não separam nada. No lado do azarão ele
errou nas três: deu 10 a `defesa_fora_solida`, a única do lado que não separa;
deu 3 a `raramente_perde_por_2` com o motivo
"sinal quase nulo, mas é o que abre a porta do azarão", e ela mede; e não
registrou `favorito_irregular`, que é a premissa mais forte do lado.

**O mart erra onde o catálogo acerta, e vice-versa.** O mart dá 8 e 6 às duas
premissas de mando que não medem nada, e dá 12 a `raramente_perde_por_2`, que
mede. Nenhuma das duas réguas está certa; elas estão erradas em lugares
diferentes.

**Empilhar ajuda até certo ponto:**

| Recorte | n | taxa | ROI | erro-padrão |
|---|---:|---:|---:|---:|
| azarão, `favorito_irregular` + `raramente_perde_por_2` | 1.297 | 77,4% | −0,8% | ±1,7pp |
| as duas, odd entre 1,40 e 2,00 | 298 | 64,1% | +4,4% | ±4,6pp |
| as duas, odd 1,40–2,00, visitante | 227 | 64,3% | +6,4% | ±5,4pp |
| favorito, `supremacia` + `tende_golear` | 124 | 46,8% | +10,5% | ±13,3pp |

As duas premissas do azarão, sozinhas, tiram o lado do vermelho em 1.297 linhas.
Com o filtro de preço ele vira positivo, e com o recorte de visitante fica em
+6,4% — a 1,2 erro-padrão, o que é promissor e não é prova. O empilhamento do
favorito parece melhor mas tem 124 linhas e ±13,3pp: não decide nada.

---

## 5. A premissa que falta é o preço

Esta seção é a seção 0 vista de perto: o mesmo achado, com os números que o
sustentam e o que mais veio junto.

A revisão de 01/08/2026 tirou o preço da nota e o transformou em filtro de
sanidade, com o argumento de que a regra antiga "vantagem maior que zero" era a
única das quatro testadas que perdia dinheiro. No handicap, o dado de hoje diz o
contrário do que essa decisão supõe:

| Board inteiro, por vantagem sobre a linha da Pinnacle | n | taxa | ROI | erro-padrão |
|---|---:|---:|---:|---:|
| vantagem acima de zero | 30 | 70,0% | +32,0% | ±17,0pp |
| vantagem entre −2% e zero | 63 | 58,7% | +14,7% | ±13,1pp |
| vantagem abaixo de −2% | 281 | 37,7% | −17,5% | ±6,7pp |

| Só depois do tombamento | n | taxa | ROI | erro-padrão |
|---|---:|---:|---:|---:|
| vantagem acima de zero | 15 | 73,3% | +34,5% | ±22,7pp |
| vantagem entre −2% e zero | 19 | 63,2% | +32,1% | ±27,0pp |
| vantagem abaixo de −2% | 92 | 34,8% | −26,1% | ±11,4pp |

É a separação mais forte que este documento encontrou em qualquer recorte, e o
número que a produz é o único que a nota decidiu não olhar.

O que explica a contradição com a revisão de agosto é a diferença entre **usar o
preço como porta** e **usar o preço como corte de exclusão**. A regra antiga
publicava tudo que tinha vantagem positiva, e vantagem positiva contra uma linha
mal estimada é uma armadilha. O que a tabela acima mostra é o outro uso: vantagem
muito negativa é motivo para **não** publicar. São 260 das 344 linhas liquidadas —
três quartos do board de handicap está no pedaço que perde 17,5%.

E há um número que resume o mercado inteiro: das 604 oportunidades de handicap
publicadas, **49 têm vantagem positiva** e a média é de −2,74%. O produto publica,
em média, linhas cotadas quase três por cento pior do que a referência sharp. Isso
não é específico do handicap — os cinco mercados publicam com vantagem média
negativa, entre −1,87% e −4,62% —, mas o handicap é onde dói mais, porque é o
mercado que vive nas odds longas, e é lá que o preço ruim cobra caro.

Dois outros achados de encanamento na mesma família:

**`linha_sharp_confirma` nunca acendeu.** É `false` nas 2.371 oportunidades
publicadas de todos os mercados, sem exceção. Ela está no catálogo como evidência
global de peso 8, que é o peso que define onde ela entra na fila de cada mercado,
e nunca entrou em fila nenhuma.

**`modelo_api_concorda` só existe no Resultado.** Acende em 285 das 390 linhas de
`match_winner` e em zero linha dos outros quatro mercados, handicap incluído.

**A porta de contexto não é a porta.** 61 das 604 oportunidades de handicap foram
publicadas com `pts_premissas` igual a zero, ou seja, sem nenhuma premissa acesa.
A `PORTA_PREMISSAS = 2` que a metodologia descreve como porta de publicação vive
em `src/utils/futebol-premissas.ts` e não governa o que o mart publica. Nos outros
mercados o buraco é maior: 42,8% das linhas de Resultado e 25,4% das de Ambos
marcam são publicadas sem premissa nenhuma.

---

## 6. O que precisa acontecer para religar

A ordem é por tamanho de efeito, não por facilidade. Os dois primeiros itens
mexem na causa; os outros quatro mexem em consequências, e nenhum deles salva o
mercado sozinho.

**Primeiro, o que vale os 25 pontos:**

1. **Vantagem mínima como porta de exclusão.** Não publicar o que está muito
   abaixo da linha sharp. É o inverso da regra que a revisão de agosto aposentou:
   aquela usava preço como porta de ENTRADA, e publicar tudo que tem vantagem
   positiva contra uma linha mal estimada é armadilha. Esta usa preço como corte
   de SAÍDA, e é a única mudança grande o suficiente para inverter o sinal do
   mercado. Vale para os cinco mercados — os cinco publicam com vantagem média
   negativa, entre −1,87% e −4,62%.
2. **Fechar a malha antes de mudar qualquer peso.** O script de #388 e o deste
   documento medem, mas nada roda sozinho e nada alerta. Enquanto a medição for um
   comando que alguém lembra de rodar, a próxima divergência entre mart e frontend
   vai durar o mesmo mês que esta durou.

**Depois, o que vale os 5 a 10 pontos** — e que só compensa fazer porque é barato,
não porque decide:

3. **Sincronizar peso entre mart e catálogo, e versionar a régua.** Enquanto as
   duas existirem em desacordo, nenhuma recalibragem tem onde pousar. Bloqueia os
   dois itens seguintes.
4. **Registrar `favorito_irregular` no catálogo.** Ela é a premissa mais forte do
   lado do azarão e a tela não sabe que ela existe. Precisa de nome, frase,
   negativo e evidência, como qualquer outra.
5. **Trocar os pesos do azarão pelo que a medição mostra.** `favorito_irregular` e
   `raramente_perde_por_2` na frente, `defesa_fora_solida` para o grupo de preço.
6. **Reconciliar a porta de contexto com o que o mart faz.** Ou o mart passa a
   exigir duas premissas, ou a metodologia para de dizer que ele exige.

O que **não** está nesta lista, e estava na primeira versão deste documento:
estreitar a faixa de odd. A odd longa não é causa — ela multiplica o erro de
preço, e com preço bom não custa nada (+18,1% abaixo de 2,00 contra +20,7% acima).
Cortar odd longa sem corrigir preço joga fora metade do board para tratar o
sintoma; corrigir preço torna o corte desnecessário.

Só depois do item 1 a pergunta "o handicap volta à vitrine?" tem como ser
respondida, porque só depois dele o mercado que voltaria é outro.

---

## 7. O que este documento não consegue dizer

**Os critérios continuam sem transcrição.** Sabemos o nome, o peso e agora o
efeito de cada premissa do handicap. Continuamos sem saber qual número ela compara
e contra qual corte: isso vive no dbt, e nenhuma das nove premissas tem critério
escrito neste repositório. Sem isso, "arrumar a premissa" só pode significar
mudar peso, nunca mudar corte.

**Não dá para propor premissa nova a partir daqui.** Testar um sinal que ainda
não existe exige calcular o insumo, e os insumos moram no mart. O que este
documento consegue afirmar é que as premissas existentes separam, que duas delas
atrapalham, e que o preço separa mais que todas — não que exista um sinal
estrutural ausente.

**A janela é de três meses e uma delas é atípica.** O universo vai de 16/06 a
10/09/2026 e inclui 842 linhas de `copa_mundo`, que é competição de seleção e não
de clube. Nenhum recorte por campeonato deste documento tem tamanho para decidir
sozinho.

**O board tem uma semana útil de vida, e dois terços dela são um dia só.** Tudo
que depende de `edge` — ou seja, a causa raiz da seção 0 e o de-para da seção 6 —
mede 374 linhas, das quais 248 vieram da captura em massa de 03/09. Separado, o
que veio depois do tombamento são 126 linhas, e o recorte de vantagem boa dentro
delas tem 34. O achado aparece nas duas metades e é grande nas duas, mas 34 linhas
com erro-padrão de ±17,9pp não fixam o tamanho do efeito — fixam o sinal dele.
Nada disso vale para as conclusões de premissa, que vivem no universo de 5.208
linhas e não dependem do board.

**O universo usa T−24h para todas as linhas.** O produto escolhe a janela por
linha, e as publicadas usaram janelas variadas. Contra o board a reconstrução
bate, mas para as linhas nunca publicadas a odd é a de 24 horas antes, e não a que
o produto teria escolhido.

**Erro-padrão maior que a diferença entre dois recortes significa que a diferença
ainda não existe.** Vale para a tabela do favorito empilhado, e vale para todo
recorte de campeonato.

---

## Fontes

- `scripts/futebol-handicap-premissas.mjs` — a medição deste documento
- `scripts/futebol-roi.mjs` — taxa e ROI do board, e a regra de liquidação
- `futebol.int_futebol_premissas_ah` — as nove premissas, linha a linha
- `futebol.fact_odds_snapshot` — o preço imutável, por casa e por janela
- `src/utils/futebol-premissas.ts` — o catálogo de pesos do frontend
- `docs/futebol-metodologia-por-mercado.md` — a metodologia que este documento revisa
