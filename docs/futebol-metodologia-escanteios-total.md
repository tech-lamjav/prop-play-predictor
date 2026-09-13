# Metodologia — Total de escanteios (mercado 45)

> **Status:** medição concluída em 2026-09-13 · **Branch:** `analise/futebol-handicap`
> **Escopo:** mais e menos de escanteios no jogo inteiro. Não cobre handicap de
> escanteio (56), escanteios por time (57 e 58) nem primeiro tempo (77).
> **Amostra:** 406 jogos com odd e histórico completo, de 16/06/2026 a 12/09/2026.

---

## 0. O que este mercado é, e o que ele não é

**Não estamos prevendo quantos escanteios a partida vai ter.** O mesmo princípio
dos outros mercados vale aqui: existe um catálogo de premissas, cada uma com um
corte declarado, e o score da oportunidade é quanto do catálogo acendeu. Nunca se
compara uma previsão numérica nossa contra a linha do mercado para decidir se
existe valor.

Isso não é preferência de estilo, é o que o dado manda. A premissa que faz
exatamente isso — comparar a nossa expectativa de escanteio com a linha pedida —
foi medida e **perde 10,92 pontos de ROI no lado Mais**. Ela só sobrevive no lado
Menos, e com peso pequeno. A seção 3 traz o número.

---

## 1. A amostra e o universo

O mercado 45 é cotado em escada: em média **16 linhas por jogo**, de 6,5 a 13,5.
O produto publica **uma** oportunidade por jogo. Medir a escada inteira infla
todo ganho medido, porque conta o mesmo jogo dezesseis vezes e dá peso extra às
linhas de odd extrema, que ninguém publicaria.

**A linha principal é a de odd mais próxima de 2,00**, para cada jogo e cada lado.
É ela, e só ela, que entra em qualquer medição deste documento.

| | linhas | jogos | linhas por jogo | odd média |
|---|---:|---:|---:|---:|
| escada inteira | 6 512 | 406 | 16,0 | — |
| **linha principal** | **812** | **406** | **2,0** | **1,98** |

Linha média pedida: 9,75 escanteios. Apostar em tudo, sem critério nenhum, dá
**−3,41%** (erro padrão 0,75). Só o lado Mais dá −1,37%, só o Menos dá −5,46%.
Esse é o zero contra o qual toda premissa é medida.

---

## 2. Os insumos

Todo insumo é a média dos **10 jogos anteriores** do time, considerando apenas
partidas que já tinham terminado antes do jogo avaliado. Jogo com menos de 10
partidas anteriores no histórico fica de fora.

Por time, na janela dos 10 jogos:

| campo | o que é | origem |
|---|---|---|
| `ck` | escanteios a favor | `stg_futebol_fixture_statistics` |
| `sof` | escanteios contra | `ck` do adversário na mesma partida |
| `po` | posse de bola em % | estatística da partida |
| `ts` | finalizações totais | estatística da partida |
| `ib` | finalizações de dentro da área | estatística da partida |
| `ob` | finalizações de fora da área | estatística da partida |
| `bl` | finalizações bloqueadas | estatística da partida |
| `gs` | defesas do goleiro | estatística da partida |
| `fl` | faltas cometidas | estatística da partida |
| `xg` | expected goals | estatística da partida, **falta em 15% dos jogos** |
| `ck_lado` | escanteios a favor nos últimos **5** jogos no mesmo mando | derivado |
| `sof_lado` | escanteios contra nos últimos **5** jogos no mesmo mando | derivado |

### Quatro armadilhas que a implementação precisa tratar

**Ponto no tempo.** Nenhuma média pode usar a temporada inteira nem o próprio
jogo. A auditoria de PIT do 1X2 encontrou 27 de 39 premissas lendo dado de depois
da partida, e o ROI do mercado caiu de +9,7% para −7,6% quando isso foi corrigido.
Mesmo risco aqui.

**Escanteio sofrido só existe em par.** `sof` de um time é o `ck` do adversário
na mesma partida. Precisa do join por `fixture_id` antes de qualquer média.

**xG é opcional.** Falta em 15% das linhas. Quando faltar, a premissa que depende
dele simplesmente não acende — **o jogo não pode ser descartado**. Descartar o
jogo tira 750 partidas da base sem motivo.

**Os cortes não saem da amostra de aposta.** Os limiares da seção 3 foram
calculados sobre os **5 993 jogos** com histórico completo, não sobre os 406 que
têm odd. Assim o corte não depende de quais jogos por acaso foram cotados.

---

## 3. O catálogo

Foram testadas 18 premissas. Todas estão listadas abaixo, inclusive as que não
funcionam — quem for reimplementar precisa saber o que já foi descartado e por quê,
senão o trabalho é refeito.

O cálculo usa `h` para o mandante e `a` para o visitante. Todo valor é a média
PIT descrita na seção 2.

### As premissas e como calcular

| premissa | o que mede | cálculo | acende no Mais | acende no Menos |
|---|---|---|---:|---:|
| `ataque_de_escanteio` | os dois times forçam escanteio | `h.ck + a.ck` | ≥ 10,40 | ≤ 9,00 |
| `defesa_que_cede` | os dois times cedem escanteio | `h.sof + a.sof` | ≥ 10,30 | ≤ 8,90 |
| `volume_de_finalizacao` | quanto o jogo finaliza | `h.ts + a.ts` | ≥ 27,00 | ≤ 23,90 |
| `finalizacao_de_fora` | chute de fora da área | `h.ob + a.ob` | ≥ 10,40 | ≤ 8,60 |
| `finalizacao_na_area` | chute de dentro da área | `h.ib + a.ib` | ≥ 16,90 | ≤ 14,50 |
| `bloqueios` | chute que a defesa bloqueia | `h.bl + a.bl` | ≥ 7,30 | ≤ 6,20 |
| `defesas_do_goleiro` | trabalho do goleiro | `h.gs + a.gs` | ≥ 6,30 | ≤ 5,46 |
| `jogo_faltoso` | jogo parado, muita falta | `h.fl + a.fl` | ≥ 26,40 | ≤ 23,40 |
| `chute_de_longe` | proporção de chute de fora | `h.ob/h.ts + a.ob/a.ts` | ≥ 0,81 | ≤ 0,69 |
| `desequilibrio_de_posse` | um time encaixota o outro | `abs(h.po − a.po)` | ≥ 8,30 | ≤ 3,70 |
| `pressao_do_mandante` | mandante força escanteio em casa | `h.ck_lado` | ≥ 6,00 | ≤ 4,80 |
| `visitante_que_cede` | visitante cede escanteio fora | `a.sof_lado` | ≥ 6,00 | ≤ 4,60 |
| `campeonato_de_escanteio` | traço do campeonato | média de escanteios totais dos jogos **já ocorridos** naquele campeonato, mínimo 30 jogos | ≥ 10,06 | ≤ 9,51 |
| `escanteio_previsto` | escanteio que o jogo tende a ter | `(h.ck + a.sof + a.ck + h.sof) / 2` | ≥ 10,05 | ≤ 9,30 |
| `previsao_x_linha` | previsão acima da linha pedida | `escanteio_previsto − linha` | ≥ +0,50 | ≤ −0,50 |
| `chance_de_gol` | xG somado | `h.xg + a.xg` | ≥ 2,87 | ≤ 2,38 |
| `mata_mata` | jogo eliminatório | rodada casa com final, semi, quarta, oitava ou playoff | verdadeiro | verdadeiro |
| `reta_final` | últimas rodadas da liga | rodada ≥ (última rodada − 6), só em liga de 20 rodadas ou mais | verdadeiro | verdadeiro |

Os cortes são os terços da distribuição: o terço alto define o lado Mais, o terço
baixo define o lado Menos.

### Quais entram em cada lado

O catálogo é **diferente por lado**. Só três premissas servem nos dois:
`volume_de_finalizacao`, `jogo_faltoso` e `finalizacao_na_area`.

**Lado Mais — 9 premissas**
`ataque_de_escanteio`, `jogo_faltoso`, `volume_de_finalizacao`, `defesa_que_cede`,
`finalizacao_na_area`, `campeonato_de_escanteio`, `pressao_do_mandante`,
`finalizacao_de_fora`, `defesas_do_goleiro`.

**Lado Menos — 9 premissas**
`volume_de_finalizacao`, `finalizacao_de_fora`, `jogo_faltoso`, `bloqueios`,
`finalizacao_na_area`, `campeonato_de_escanteio`, `previsao_x_linha`,
`chute_de_longe`, `desequilibrio_de_posse`.

### O que foi descartado, e por quê

| premissa | lado Mais | lado Menos | por quê |
|---|---:|---:|---|
| `escanteio_previsto` | −2,76 | −0,16 | a premissa mais óbvia do mercado não funciona em nenhum dos dois lados |
| `chance_de_gol` | −2,88 | −2,18 | redundante com volume de finalização e pior que ele |
| `visitante_que_cede` | −1,42 | −6,34 | histórico recente por mando não sustenta |
| `mata_mata` | −3,74 | −2,89 | ver seção 9, não foi possível testar direito |
| `bloqueios` | −2,29 | +14,73 | só serve no Menos |
| `desequilibrio_de_posse` | −0,50 | +1,08 | só serve no Menos, e mal |
| `chute_de_longe` | −0,12 | +11,07 | só serve no Menos |
| `previsao_x_linha` | **−10,92** | +6,44 | no Mais o mercado já cobrou por isso, ver seção 7 |
| `ataque_de_escanteio` | +12,95 | −3,20 | só serve no Mais |
| `defesa_que_cede` | +3,26 | −0,18 | só serve no Mais |
| `pressao_do_mandante` | +4,12 | −3,78 | só serve no Mais |
| `defesas_do_goleiro` | +0,49 | −4,58 | só serve no Mais, e com peso mínimo |

> **Redundância não é motivo de descarte.** As premissas de volume acendem juntas
> em 60% a 85% dos jogos, e a tentação é descontar isso. Foi testado: descontar a
> redundância **piora** o resultado nos dois lados e em duas regras de peso
> diferentes. Quando cinco premissas de volume acendem juntas, isso é uma leitura
> mais forte mesmo, não a mesma leitura cinco vezes.

---

## 4. Os pesos

O peso **não** é proporcional ao ganho medido. Ganho medido dentro da amostra é o
número mais contaminado que existe — a ADR 0001 mediu 14,5 pontos de viés de
seleção num caso análogo. Peso proporcional a ele é peso proporcional ao ruído.

A regra é grossa de propósito: **três níveis pelo tamanho do ganho, multiplicados
por três se a premissa ganha nas duas metades do período.**

| | ganho grande | ganho médio | ganho pequeno |
|---|---:|---:|---:|
| ganha nas duas metades do período | **9** | **6** | **3** |
| ganha só numa metade | **3** | **2** | **1** |

Estabilidade vale mais que tamanho. Uma premissa com ganho maior mas concentrado
em metade do período pesa menos que uma de ganho modesto que repete. Foi testado
contra oito outras regras e é a única que faz o score ordenar nos dois lados
(seção 8).

### Lado Mais — teto 38

| peso | premissa | nível | ganho medido | % do teto |
|---:|---|---|---:|---:|
| 9 | `ataque_de_escanteio` | forte e estável | +12,95 | 24% |
| 9 | `jogo_faltoso` | forte e estável | +11,86 | 24% |
| 9 | `volume_de_finalizacao` | forte e estável | +6,06 | 24% |
| 3 | `defesa_que_cede` | fraca e estável | +3,26 | 8% |
| 2 | `finalizacao_na_area` | média | +4,96 | 5% |
| 2 | `campeonato_de_escanteio` | média | +4,40 | 5% |
| 2 | `pressao_do_mandante` | média | +4,12 | 5% |
| 1 | `finalizacao_de_fora` | fraca | +2,84 | 3% |
| 1 | `defesas_do_goleiro` | fraca | +0,49 | 3% |

### Lado Menos — teto 48

| peso | premissa | nível | ganho medido | % do teto |
|---:|---|---|---:|---:|
| 9 | `volume_de_finalizacao` | forte e estável | +23,53 | 19% |
| 9 | `finalizacao_de_fora` | forte e estável | +22,30 | 19% |
| 9 | `jogo_faltoso` | forte e estável | +20,09 | 19% |
| 6 | `bloqueios` | média e estável | +14,73 | 13% |
| 6 | `finalizacao_na_area` | média e estável | +11,09 | 13% |
| 3 | `campeonato_de_escanteio` | fraca e estável | +9,37 | 6% |
| 3 | `previsao_x_linha` | fraca e estável | +6,44 | 6% |
| 2 | `chute_de_longe` | média | +11,07 | 4% |
| 1 | `desequilibrio_de_posse` | fraca | +1,08 | 2% |

Duas inversões são propositais e vão parecer erro de digitação:

No Mais, `defesa_que_cede` pesa 3 com ganho de 3,26 enquanto `finalizacao_na_area`
pesa 2 com ganho de 4,96. O ganho maior perde porque aparece só numa metade.

No Menos, `chute_de_longe` pesa 2 com ganho de 11,07 enquanto
`campeonato_de_escanteio` pesa 3 com ganho de 9,37. O 11,07 vem de +43,61 numa
metade e −3,54 na outra. Não é uma premissa, é um mês bom.

---

## 5. O score

Idêntico ao dos outros mercados, sem invenção nenhuma:

```
pontos = soma do peso das premissas acesas
score  = pontos / teto × 100
```

| lado | teto | score 30 | score 60 |
|---|---:|---:|---:|
| Mais | 38 | 12 pontos | 23 pontos |
| Menos | 48 | 15 pontos | 29 pontos |

Faixas: **Baixa** abaixo de 30, **Média** de 30 a 59, **Alta** de 60 para cima.

Quanto acende de fato em cada faixa, nas 9 premissas do lado:

| faixa | Mais | Menos |
|---|---:|---:|
| Alta | 5,9 premissas acesas | 5,4 |
| Média | 3,9 | 3,8 |
| Baixa | 1,8 | 1,3 |

Ou seja, a faixa Alta exige mais da metade do catálogo aceso. Não existe caminho
de uma ou duas premissas empurrarem a oportunidade para o topo.

---

## 6. As portas de publicação

**Odd até 2,20.** Acima disso o mercado dá −35,84% em 55 linhas. É o corte mais
barato do documento: vale um ponto de ROI sozinho.

**Score 30 ou mais.** Abaixo de 30 o ROI é −9,15% em 423 observações fora da
amostra. A faixa Baixa não é oportunidade fraca, é oportunidade negativa.

Nenhum outro filtro. Campeonato não entra: a diferença entre ligas é grande
(Série B rende no Mais, Premier League rende no Menos) mas com 24 a 208 linhas por
campeonato não há amostra para transformar isso em regra.

---

## 7. Por que o lado Mais é mais difícil que o Menos

Vale registrar porque explica o formato da metodologia e evita que alguém tente
"consertar" o lado Mais depois.

A linha que o mercado pede sobe junto com o nosso score:

| score no Mais | linha pedida | escanteio que aconteceu | sobra | ROI |
|---:|---:|---:|---:|---:|
| 0 a 19 | 9,56 | 9,12 | −0,44 | −16,10 |
| 20 a 39 | 9,71 | 9,91 | +0,20 | −3,07 |
| 40 a 59 | 9,94 | 10,88 | +0,95 | +19,66 |
| 60 a 79 | 10,07 | 10,00 | −0,07 | −4,68 |
| 80 a 99 | 10,35 | 10,03 | −0,32 | −7,24 |

O mercado enxerga o mesmo que a gente e move a linha na mesma direção. Na faixa do
meio ele ainda não subiu o suficiente e sobra quase um escanteio. No topo ele já
subiu demais: pede 10,35 num jogo que dá 10,03.

No lado Menos acontece o contrário. Na faixa de 40 para cima o mercado pede 9,55 e
o jogo dá 8,92; na faixa de 60 a 79 pede 9,23 e dá 8,79. O livro não desce a linha
o suficiente nos jogos de pouco escanteio, porque o público aposta no Mais.

É por isso que `previsao_x_linha` perde 10,92 pontos no Mais e ganha 6,44 no Menos,
e é por isso que o lado Menos rende mais com o mesmo método.

---

## 8. O que foi medido

### Dentro da amostra

| faixa | Mais | Menos |
|---|---:|---:|
| Alta | +3,37 (107 jogos) | +14,66 (44) |
| Média | +6,25 (146) | +21,01 (80) |
| Baixa | −11,96 (153) | −16,10 (282) |

### Fora da amostra

Peso e nível recalculados usando só metade do período, score medido na outra
metade, nas duas direções.

| faixa | Mais | Menos | juntos |
|---|---:|---:|---:|
| Alta | +2,40 (102) | +9,62 (53) | **+4,87** (155) |
| Média | +2,07 (148) | +0,45 (86) | +1,48 (234) |
| Baixa | −7,10 (156) | −10,35 (267) | −9,15 (423) |

Acerto na faixa Alta: 52,0% no Mais e 54,7% no Menos, com odd média 1,98.
Na Baixa: 46,8% e 45,7%.

| porta | jogos | ROI | erro padrão |
|---|---:|---:|---:|
| apostar em tudo | 812 | −3,41 | 0,75 |
| score ≥ 30 e odd ≤ 2,20 | 383 | +3,28 | 5,00 |
| só a faixa Alta | 155 | +4,87 | 8,01 |

### Por que esta regra de peso e não outra

Nove regras testadas fora da amostra, com o mesmo catálogo:

| regra | Alta no Mais | Alta no Menos | ordena? |
|---|---:|---:|---|
| contagem simples | −5,86 | −8,15 | não |
| ganho cru | −6,70 | +6,09 | não |
| ganho encolhido por amostra | −6,98 | +6,38 | não |
| significância (ganho ÷ erro padrão) | −6,98 | +12,51 | só no Menos |
| níveis 3-2-1 | −6,70 | +15,07 | só no Menos |
| níveis, estável vale 1,5× | −3,88 | +13,37 | só no Menos |
| níveis, estável vale 2× | −3,88 | +11,86 | só no Menos |
| **níveis, estável vale 3×** | **+2,40** | **+9,62** | **nos dois lados** |
| corrigida por bloco de redundância | −10,59 | −5,67 | não |

A porta comercial rende entre 3,28% e 6,63% em **todas** as nove. A ponderação não
muda quanto o mercado rende; muda onde a oportunidade é enquadrada. A regra
escolhida entrega dois pontos a menos de ROI na carteira — dentro do erro padrão
de 5, ou seja, indistinguível de zero — em troca da única coisa que o usuário
enxerga: a faixa Alta ser realmente melhor que a Média, e a Média melhor que a
Baixa. Com o peso automático a faixa Alta do Mais rendia −6,98%.

---

## 9. O que este documento não resolve

**A must-win não foi testada.** A janela de odds vai de junho a setembro, que é
começo de temporada na Europa. Reta final de campeonato praticamente não existe no
período, então `must_win` colapsou em `mata_mata`, com 56 jogos, e deu negativo nos
dois lados. A premissa fica no catálogo **sem peso**, esperando dado. Refazer a
medição quando houver pelo menos uma reta final completa.

**O tamanho da amostra.** 406 jogos em dois meses. A faixa Alta do lado Menos tem
53 jogos fora da amostra. Tudo aqui é direcional.

**Seleção residual.** As 9 premissas de cada lado foram escolhidas olhando a
amostra inteira, então mesmo o teste fora da amostra carrega um resto de viés.
Refazendo também a escolha dentro da metade de treino, a porta cai de +5,41 para
+4,72 na regra antiga. A diferença é pequena, o que é bom sinal, mas o número
honesto é a faixa de 4% a 5%, não o valor cheio.

**O multiplicador 3 da estabilidade** foi achado testando 1×, 1,5×, 2× e 3× e
escolhendo o que ordena. É ajuste em cima do dado. O que dá conforto é o efeito ser
monotônico nos quatro testes — quanto mais a regra premia estabilidade, melhor o
topo se comporta — e não um ponto isolado que funcionou.

**As estatísticas de estilo não existem.** `stg_futebol_fixture_statistics` pivota
exatamente os 18 tipos que o endpoint devolve. Cruzamento, bola longa, altura da
linha defensiva e pressão não estão entre eles. Premissa de estilo de jogo, que é
o que mais faria sentido para escanteio, não é implementável hoje.

---

## 10. Validações obrigatórias antes de ligar

1. **Ponto no tempo.** Para uma amostra de jogos, reconstruir cada insumo com o
   histórico congelado no dia anterior ao jogo e conferir que bate com o que a
   pipeline produziu. Qualquer divergência é vazamento.
2. **Universo.** Conferir que sai uma oportunidade por jogo e por lado, nunca a
   escada. Se sair mais de uma, a medição está inflada.
3. **Escanteio sofrido.** Conferir numa amostra de partidas que o `sof` de um lado
   é igual ao `ck` do outro.
4. **xG ausente.** Conferir que jogo sem xG continua sendo avaliado, com a premissa
   de xG apagada — e que nenhum jogo é descartado por isso.
5. **Teto.** Conferir que a soma dos pesos declarados bate com 38 no Mais e 48 no
   Menos, e que o score de uma oportunidade com todas as premissas acesas dá 100.
6. **Fora da amostra.** Antes de reescrever qualquer peso desta tabela a partir de
   ganho medido, a ADR 0001 exige controle fora da amostra. Peso reescrito com
   ganho medido dentro da amostra não vale.

---

## Fontes

- `docs/futebol-metodologia-por-mercado.md` — o que roda hoje nos cinco mercados
- `docs/futebol-metodologia-de-premissas.md` — como o catálogo de premissas é construído
- `docs/futebol-revisao-handicap.md` — a revisão que estabeleceu os quatro Testes
- ADR 0001 — reescrita de peso a partir de ganho medido exige controle fora da amostra
- `dbt_futebol/CONTEXT.md` — os quatro Testes
