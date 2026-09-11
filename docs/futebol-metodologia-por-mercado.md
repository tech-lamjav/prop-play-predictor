# Metodologia do futebol, mercado por mercado

Este documento descreve **o que roda hoje**: como uma linha de aposta é avaliada,
o que faz uma premissa acender, quanto cada uma pesa, e o que precisa acontecer
para virar oportunidade publicada.

Ele foi escrito lendo o código, não de memória. Cada afirmação aponta para onde
mora.

> ⚠️ Não confundir com `docs/futebol-metodologia.md`. Aquele é o **desenho de uma
> metodologia futura** (modelo de projeção próprio, lambda por time, matriz de
> placar, Dixon-Coles). Ele nunca foi construído além de um esboço, e nada do que
> está lá roda em produção. O que roda é o que está aqui.

---

## 1. O vocabulário mínimo

Os termos abaixo estão definidos em `CONTEXT.md` e são usados com precisão neste
documento.

| Termo | O que é |
|---|---|
| **Linha analisada** | Uma linha para a qual o modelo calcula premissas, mesmo sem nenhuma casa ter cotado |
| **Linha cotada** | Linha analisada que teve ao menos uma odd coletada |
| **Candidata** | Linha cotada que passou pelo funil, aprovada ou não |
| **Oportunidade** | Candidata aprovada pelas regras de publicação |
| **Premissa** | Uma característica do jogo que o modelo testa |
| **Critério** | A comparação que decide se a premissa acende: um insumo, um corte e um sentido |
| **Insumo** | O número que o critério compara |
| **Corte** | O limiar contra o qual o insumo é comparado |
| **Premissa acesa** | Premissa cujo insumo cruzou o corte |
| **Board** | Tudo que o backend publica |
| **Vitrine** | O recorte do board que o assinante de fato vê |

Uma coisa que confunde e vale repetir: **"contra" não significa evidência do lado
oposto.** É uma premissa do *mesmo* lado da aposta que não atingiu o corte. Numa
saída de Menos de 3,25 gols, uma premissa "contra" continua sendo uma premissa de
Under. O modelo só sabe dizer "acendeu" e "não acendeu"; o segundo grupo é
ausência, não oposição.

---

## 2. A virada de metodologia que explica o resto

Em 01/08/2026 a metodologia foi revista, e a conclusão inverteu a ordem do
produto. Está registrada no cabeçalho da migration `093_futebol_mapa_premissas.sql`:

> A porta de publicação passa a ser o **contexto** (2 ou mais premissas acesas) e
> o preço vira filtro de sanidade. A regra antiga (vantagem maior que zero) é a
> única das quatro testadas que perde dinheiro: R$ 100 viraram R$ 85 em 393
> apostas, contra R$ 110 de "2 premissas, sem olhar preço" em 1.087 apostas.

Duas consequências que atravessam tudo:

**O preço saiu da nota.** Desde a migration 112 (29/08/2026), o Score não soma
mais preço, corroboração nem penalidade de odd. Ele expressa só quanto do
contexto favorável está presente. A odd, a vantagem e o número de casas continuam
publicados como informação e continuam servindo de porta de segurança, mas não
compõem a nota nem destravam a publicação.

**Premissa de histórico recente não ajuda em nenhum mercado.** Foi o achado
transversal da revisão, e é o motivo de metade das premissas valerem zero ou
quase: histórico over, histórico seco, histórico de ambos marcam, confronto
direto e invicto recente são o dado mais fácil de olhar, então a casa de aposta
já olhou antes da gente. O que ajuda é sempre característica estrutural do time:
como ele defende, como ele ataca, quanto ele descansou.

Daí os dois grupos em que toda premissa cai:

- **decide** — característica estrutural, peso maior que zero
- **preço** — o mercado já cobra, peso zero ou quase

---

## 3. Como uma linha vira oportunidade

```
   linha analisada              todas as linhas de todos os mercados de um jogo
          │                     (premissas cobrem TODOS os jogos, inclusive futuros)
          │
          ▼  chega odd (só a partir de T−24h)
   linha cotada
          │
          ▼  porta de contexto: 2+ premissas acesas do lado da saída,
          │  contando só as de peso > 0
   candidata aprovada
          │
          ▼  filtros de sanidade de preço (faixa de odd, número de casas)
   oportunidade  ──── publicada no board
          │
          ▼  o mercado está na vitrine?
   aparece na tela e vai para o Telegram
```

**A porta de contexto** é `PORTA_PREMISSAS = 2`, em `src/utils/futebol-premissas.ts`.
Contam apenas as premissas que sobreviveram à recalibragem daquele mercado, ou
seja, peso maior que zero. O motivo está escrito no código: contar as antigas
deixaria a porta aberta justamente pelas premissas que foram cortadas por
atrapalhar.

**Odds só existem a partir de 24 horas antes do jogo.** As premissas, ao
contrário, cobrem todos os jogos do mart, incluindo os futuros. Por isso o mapa
de premissas é o único conteúdo analítico que existe para um jogo de amanhã, e
por isso a tela de um jogo distante mostra leitura sem mostrar aposta.

### O Score e as faixas

O Score é calculado no mart (BigQuery) e chega pronto. O frontend só rotula.

| Faixa | Corte na escala atual (`contexto_v1`) |
|---|---|
| Alta | 60 ou mais |
| Média | 30 ou mais |
| Baixa | abaixo de 30 |

Os cortes eram 25 e 55 e viraram 30 e 60 em 01/09/2026, por decisão de produto e
não por leitura de evidência. O estudo que os mediu concluiu que **nenhum par da
grade discrimina** de verdade. O que o 30/60 comprou: a faixa Alta deixou de ser
a segunda melhor e passou a ser a melhor, e o board padrão encolheu de 63,5% para
52,8% do total. O que ele não consertou: a faixa Média continua sendo o fundo do
poço. Está escrito em `src/utils/futebol-score.ts`, e vale ler literalmente —
**faixa é rótulo, não porta.**

Existe uma escala anterior, `legacy`, com cortes em 40 e 60, que somava preço.
Registros históricos gravados antes da virada permanecem nela e não são
recalculados. Qualquer medição que junte as duas escalas está somando maçã com
laranja.

---

## 4. Os cinco mercados

Em todas as tabelas: **peso** é o da recalibragem, e **grupo** é `decide` ou
`preço` conforme a seção 2.

### 4.1 Gols (mais ou menos) — `goals_over_under`

A aposta é no total de gols da partida contra uma linha. É o mercado mais
desenvolvido: é o único cujos critérios estão transcritos no repositório.

**Lado Over** (teto 34 pontos, 3 premissas contam para a porta)

| Premissa | Peso | Grupo | Critério |
|---|---:|---|---|
| Defesas frágeis dos dois lados | 12 | decide | Soma das médias de gols sofridos ≥ linha (margem zero) |
| Os dois somam muitos gols | 12 | decide | Soma das médias de gols marcados ≥ linha + 0,5 |
| Os dois criam muita chance de gol | 10 | decide | Soma dos gols esperados ≥ linha + 0,3 |
| Os dois sofrem gol quase todo jogo | 0 | preço | Cada time com menos de 35% de jogos sem sofrer gol (comparação estrita) |
| Jogo de ritmo alto | 0 | preço | não transcrito |
| Histórico de jogo com muitos gols | 0 | preço | Cada time com 3+ dos últimos 5 jogos acima da linha |

**Lado Under** (teto 40 pontos, 5 premissas contam para a porta)

| Premissa | Peso | Grupo | Critério |
|---|---:|---|---|
| Defesas firmes dos dois lados | 14 | decide | Soma das médias de gols sofridos ≤ linha − 0,3 |
| Os dois criam pouca chance de gol | 10 | decide | Soma dos gols esperados ≤ linha − 0,3 |
| Os dois passam muitos jogos sem sofrer gol | 10 | decide | Cada time com 40% ou mais de jogos sem sofrer gol |
| Ataque fraco em pelo menos um lado | 3 | preço | **Um dos dois** times com 35% ou mais de jogos sem marcar |
| Histórico de jogo com poucos gols | 3 | preço | Cada time com 3+ dos últimos 5 jogos abaixo da linha |

**Penalidade:** Linha muito longe do normal, −10 pontos.

Três detalhes que já causaram erro e estão documentados no código:

- **"Defesas frágeis" é a única premissa com margem zero.** O corte é a linha
  crua. É a única em que "fica acima da linha" é frase verdadeira; nas outras
  quatro o corte não é a linha.
- **"Ataque fraco em pelo menos um lado" é o único OU do produto.** Ela se
  chamava "Ataques fracos dos dois lados" e afirmava o que a regra não exige.
- **A contagem não sai da média.** Nas duas premissas de histórico, cada um dos
  últimos 5 jogos é comparado individualmente contra a linha. Uma média pode
  estar de um lado da linha enquanto a contagem diz o contrário.

### 4.2 Resultado — `match_winner`

A aposta é em quem ganha, ou no empate. Teto de 30 pontos; **4 premissas contam
para a porta**. As mesmas 7 valem para mandante e visitante.

| Premissa | Peso | Grupo | Observação |
|---|---:|---|---|
| Em boa fase, vem ganhando | 10 | decide | |
| O mando pesa neste jogo | 8 | decide | Rótulo muda por mando: "manda bem em casa" / "vai bem fora" |
| Bem à frente na tabela | 8 | decide | |
| Ataque forte contra defesa frágil do adversário | 4 | decide | Entende o jogo, mas o preço já cobra quase tudo |
| Cria mais chances de gol que o adversário | 0 | preço | Chance de gol prevê gols, não quem ganha |
| Leva vantagem no histórico do confronto | 0 | preço | Todo mundo olha, então já está na odd |
| Adversário com desfalque de titular importante | 0 | preço | Ver abaixo |

**Penalidades:** empate como aposta, 0 pontos (suspensa até ter amostra); time
apostado com desfalque de titular importante, −15 pontos.

**Sobre o desfalque valer zero:** não é que ele não importe. É que ele ainda não
existe quando o Score é calculado. Medido em 05/09/2026 sobre 296 partidas: nas
próximas 24 horas, 78% dos jogos já têm a lista de lesionados; até 3 dias, 47%; a
mais de 3 dias, zero. O board publica dias antes. Não é dado que falta, é dado
que chega tarde para o que a gente pergunta.

### 4.3 Handicap asiático — `asian_handicap`

A aposta é num time com vantagem ou desvantagem de gols. As premissas se dividem
por lado, e **o lado sai do sinal da linha**: mandante com linha negativa é
favorito, visitante com linha positiva também é (a linha é sempre guardada na
ótica do mandante). Handicap zero nunca acende premissa nenhuma e é excluído
explicitamente.

**Lado favorito** (35 pontos, 5 premissas contam)

| Premissa | Peso | Grupo |
|---|---:|---|
| Costuma ganhar por muitos gols | 16 | decide |
| Muito superior ao adversário | 12 | decide |
| Deve entrar com força máxima | 3 | decide |
| Adversário fraco fora de casa | 2 | preço |
| Manda muito bem em casa | 2 | preço |

**Lado azarão** (13 pontos, **só 2 premissas contam**)

| Premissa | Peso | Grupo |
|---|---:|---|
| Defesa sólida jogando fora | 10 | decide |
| Quando perde, perde apertado | 3 | decide |

**Penalidade:** handicap muito alto, 0 pontos (efeito zero nos dois testes).

Duas coisas importantes aqui:

**O azarão só passa na porta se as duas premissas acenderem.** Ele tem exatamente
duas premissas de peso, e a porta exige duas. Não é regra especial — é
consequência aritmética, e faz do azarão o lado mais difícil de publicar do
produto inteiro.

**"Quando perde, perde apertado" já quebrou na mão do usuário.** Ela se chamava
"Raramente perde por dois ou mais", e isso enuncia uma condição de aposta que só
vale em duas das sete linhas do handicap: num mais 0,5 a aposta morre em qualquer
derrota, então a margem da derrota não responde nada. O sinal é real e sobrevive
ao controle por faixa de odd acima de 1,30 — o defeito era a frase, não o
cálculo.

**Este mercado está fora da vitrine desde 01/09/2026.** Continua sendo publicado
e medido no board; só não é exibido nem alertado. A decisão está na migration 116
e a data de corte importa: as 23 linhas anteriores ao corte foram publicadas e
vistas de verdade; as 31 posteriores nunca estiveram na tela.

### 4.4 Ambos marcam — `btts`

A aposta é se os dois times marcam.

**Lado Sim** (34 pontos, 4 premissas contam)

| Premissa | Peso | Grupo |
|---|---:|---|
| Os dois costumam marcar | 12 | decide |
| Os dois atacam bem | 8 | decide |
| Defesas frágeis dos dois lados | 8 | decide |
| Nos últimos jogos, os dois marcaram | 6 | preço |

**Lado Não** (28 pontos, 3 premissas contam)

| Premissa | Peso | Grupo |
|---|---:|---|
| Defesa forte de um dos lados | 12 | decide |
| Um dos ataques costuma passar em branco | 10 | decide |
| Jogos recentes sem os dois marcarem | 6 | preço |

Sem penalidades.

⚠️ **Estes pesos foram recuperados do dado, não decididos.** O documento da
recalibragem deixou este mercado pendente. Em 05/09/2026 os pesos foram deduzidos
de volta: no board de produção, linhas com uma única premissa acesa e nenhuma
penalidade têm a soma de pontos igual ao peso daquela premissa. As sete
apareceram assim, e a soma fecha com os tetos que o Score já usava. Se algum peso
estivesse errado, a soma não fecharia — mas continua sendo engenharia reversa, e
não decisão registrada.

**Cuidado com a premissa "Defesas frágeis dos dois lados".** Ela existe em dois
mercados, com pesos diferentes (12 em Gols, 8 em Ambos marcam) e critérios de
famílias diferentes: em Gols é média de gols sofridos contra a linha, em Ambos
marcam é percentual de jogos sem sofrer gol de cada time. Qualquer agrupamento
por slug sem o mercado junto mistura as duas.

### 4.5 Dupla chance — `double_chance`

A aposta cobre dois dos três resultados. Teto de 34 pontos; 4 premissas contam
para a porta, e as mesmas valem para qualquer saída.

| Premissa | Peso | Grupo |
|---|---:|---|
| O lado coberto é forte | 12 | decide |
| Equilíbrio defensivo | 8 | decide |
| Adversário com campanha fraca | 8 | decide |
| Invicto nos últimos jogos | 6 | preço |

Sem penalidades. Mesma ressalva do Ambos marcam: pesos recuperados do dado.

---

## 5. O que vale para todos os mercados

### Avisos de preço (penalidade global)

Falam da odd, então valem para qualquer aposta. Em ordem de severidade, que é a
ordem em que devem ser oferecidos:

| Aviso | Peso |
|---|---:|
| Só uma casa paga essa odd, pode ser linha furada | −30 |
| Odd alta de zebra, entra com cautela | −15 |
| Poucas casas cotando esse mercado | −12 |
| Odd baixa, retorno pequeno pro risco | −10 |

### Evidências de preço

Também globais, e também competem por peso com as premissas do mercado:

| Evidência | Peso |
|---|---:|
| As principais casas e o modelo da API apontam o mesmo lado | 8 |
| As principais casas vêm baixando a odd desse lado | 8 |
| Modelo da API concorda com esse lado | 0 |

O modelo da API vale zero porque a recalibragem tirou os pontos dele da nota: ele
troca mando por empate errando 14 pontos.

### Premissas que existem e não vão à tela

Seis slugs são calculados e escondidos. Cinco descrevem **preço** — movimento de
linha, movimento das casas, concordância do modelo — e deixaram de ser razão
quando o preço saiu da nota. A sexta, "favorito irregular", acende em 43% das
linhas e vale zero ponto.

### O peso vira palavra na tela

O número nunca aparece para o assinante:

| Peso | Palavra |
|---|---|
| 10 ou mais | Pesa muito |
| 5 a 9 | Pesa |
| 1 a 4 | Pesa pouco |
| 0 | Não ajuda |

"Não ajuda", e não "não conta": a premissa está na lista **a favor**, porque o
modelo a acendeu. Dizer que ela não conta ao lado disso faz a tela discordar de
si mesma.

---

## 6. Onde cada peça mora

Isto importa mais do que parece, porque decide o que dá para medir e o que dá
para mudar sem release.

| Peça | Onde | Muda como |
|---|---|---|
| Se a premissa acendeu | Mart no BigQuery, tabelas `int_futebol_premissas_*` | Deploy do dbt |
| Soma de pontos e Score | Mart no BigQuery | Deploy do dbt |
| Faixa (Alta/Média/Baixa) | Mart no BigQuery | Deploy do dbt |
| **Peso de cada premissa** | **Só no frontend**, `src/utils/futebol-premissas.ts` | Release do app |
| Rótulo e copy da premissa | Frontend, e uma cópia em `futebol_premissa_copy` | Release / UPDATE |
| Critério transcrito (só Gols) | Frontend, `src/utils/futebol-criterio.ts` | Release do app |
| Quais premissas se aplicam a cada saída | **Duas cópias**: mart e migration 112 | Deploy nos dois |
| Mercado na vitrine | Tabela `futebol_mercados_ocultos` | UPDATE, sem release |
| Regra de liquidação (green/red) | **Só no navegador**, `src/utils/futebol-settlement.ts` | Release do app |

---

## 7. O que este documento não consegue dizer

Lacunas reais, encontradas ao escrever isto. Todas verificadas.

**Os critérios de quatro dos cinco mercados não estão escritos em lugar nenhum
deste repositório.** Só os do mercado de Gols foram transcritos. Para Resultado,
Handicap, Ambos marcam e Dupla chance, sabemos o nome da premissa e o peso, mas
não o número que ela compara nem contra qual corte. Isso vive só no dbt.

**O documento fonte dos pesos não existe.** O código e a migration 093 citam
`docs/premissas-recalibragem.md` como origem de tudo: pesos decididos, tetos,
achado transversal, decisão de aposentar mercado. O arquivo não está no
repositório. Toda a justificativa dos pesos chega até nós por citação em
comentário de código.

**O peso existe em duas versões que ninguém garante iguais.** O mart soma os
pontos com os pesos dele; o catálogo do frontend tem os pesos dele. Para dois
mercados o catálogo é literalmente uma dedução a partir do dado do mart. Existe
um teste de paridade entre o catálogo e a migration 122, mas ele compara a copy,
não o peso que o BigQuery aplica.

**Não existe versão nem histórico de peso.** Se um peso mudar amanhã, nada
registra quando. Só a *escala do Score* é versionada (`legacy` e `contexto_v1`),
e isso é outra coisa.

**A soma dos dois lados do handicap não bate com o comentário do código.** O
cabeçalho diz "teto equilibrado em 35 nos dois lados". Somando o catálogo, o
favorito dá 35 e o azarão dá 13. Ou o comentário descreve uma intenção que os
pesos não realizam, ou a normalização acontece no mart. Precisa ser checado antes
de qualquer comparação de Score entre os dois lados.

**O Score parece normalizado, mas a fórmula não está aqui.** A faixa Alta começa
em 60 e nenhum mercado tem teto de pontos acima de 40, então o Score não pode ser
a soma crua. Um comentário registra Score médio de 40,0 no Ambos marcam, cujo
teto é 34 — o que confirma a normalização. A conta em si está no mart.

**Nada disso é medido contra resultado.** Não existe registro persistido de que
uma oportunidade ganhou ou perdeu. A regra de liquidação existe e é boa, cobrindo
os cinco mercados incluindo o quarto de gol do handicap asiático, mas roda no
navegador e é descartada ao fechar a aba. Os ingredientes estão guardados — a odd
do momento da publicação em duas tabelas, o placar final em outras duas —, só
nunca foram cruzados fora do cliente.

---

## Fontes

- `src/utils/futebol-premissas.ts` — catálogo, pesos, grupos, porta de contexto
- `src/utils/futebol-criterio.ts` — critérios transcritos do mercado de Gols
- `src/utils/futebol-score.ts` — faixas e escalas
- `src/utils/futebol-settlement.ts` — regra de liquidação
- `supabase/migrations/093_futebol_mapa_premissas.sql` — a virada de metodologia
- `supabase/migrations/20260829120000_112_futebol_score_contexto_contrato.sql` — Score de contexto e matriz de premissas aplicáveis
- `supabase/migrations/20260901200000_116_futebol_mercados_ocultos.sql` e `20260905180000_119_futebol_vitrine_com_data.sql` — vitrine
- `CONTEXT.md` — glossário
