# Metodologia de valor — módulo Futebol (design)

> Documento de **design da metodologia própria**. Estado: discovery (não implementado além do Pilar A + v0 do Pilar B). Objetivo: definir COMO produzimos nossa probabilidade e nosso valor, antes de codar. Relacionado: `docs/futebol-direcao-produto.md`, `src/utils/futebol-value.ts` (Pilar A), `src/utils/futebol-tendencias.ts` (v0 do Pilar B).

## 0. Tese
Não vendemos "previsão de placar" nem devig de prateleira. Vendemos **gestão de risco + a nossa leitura própria do jogo**. O edge real nasce **onde a nossa projeção diverge do mercado** — não só quando uma casa mole paga acima da Pinnacle.

## 1. Os dois pilares
**Pilar A — Risco/Valor (JÁ TEMOS).** devig da linha sharp (Pinnacle) → chance justa do mercado → edge (melhor odd × chance − 1) → **Score** (Kelly + banda de odds + corroboração + sharp). É "mercado contra mercado". Bom, mas replicável.

**Pilar B — Previsibilidade (O MOAT, a construir).** Um **modelo de projeção próprio** que cospe a NOSSA probabilidade por mercado a partir dos dados (xG, forma, mando, desfalques, H2H, classificação), **independente do mercado**. Aí:
> **valor de verdade = nossa_prob × melhor_odd − 1** (e a linha sharp vira sanity-check / CLV, não a fonte da chance).

## 2. O modelo de projeção (núcleo do Pilar B)
**Saída-base:** `λ_casa` e `λ_visitante` = gols esperados de cada time **neste jogo**. De λ sai TUDO por uma matriz de placar.

**Como montar os λ** (modelo de forças relativas, família Maher/Dixon-Coles):
```
λ_casa = média_gols_liga × ataque_rel(casa, em casa) × fragilidade_def_rel(visitante, fora) × fator_mando × ajuste_desfalques(casa)
λ_visitante = média_gols_liga × ataque_rel(visitante, fora) × fragilidade_def_rel(casa, em casa) × ajuste_desfalques(visitante)
```
Componentes (e fonte):
- **Ataque/defesa relativos** por time vs média da liga, **split casa/fora** — base em **xG/xGA** (melhor preditor que gols crus) com gols como fallback. Fonte: `fact_fixture_stats` (xG), `fact_team_season_stats`.
- **Forma recente** — decaimento exponencial (últimos jogos pesam mais) sobre os mesmos indicadores. Fonte: `fact_fixtures` ordenados.
- **Mando** — fator casa estimado da liga.
- **Desfalques de titulares** — reduz ataque (ausência de criador/finalizador) ou defesa (zagueiro/goleiro). v1: ajuste simples por titular ausente; depois ponderar por minutos/peso do jogador. Fonte: `fact_injuries_snapshot` + `fact_fixture_lineups_players`.
- **H2H** — peso pequeno (estilo de confronto). Fonte: `fact_h2h`.

**Correção Dixon-Coles** (v2): Poisson independente subestima placares baixos (0-0, 1-0, 1-1); aplicar o ajuste τ pra calibrar.

## 3. Do λ aos mercados (uma matriz, todos os mercados)
Matriz de placar `P(i,j) = Poisson(i;λ_casa) × Poisson(j;λ_visitante)` (com correção DC):
- **1X2** = soma dos triângulos (i>j / i=j / i<j).
- **Over/Under (qualquer linha)** = soma das diagonais por total i+j.
- **BTTS** = P(i≥1 e j≥1).
- **Handicap / supremacia** = distribuição de **(i − j)** → resolve o ponto do **-1,5**: nós temos uma visão própria de quão "gordo" é o -1,5 do mercado.
- **Placar exato** = a própria célula.

## 4. Valor v2 e Score evoluído
- `edge = nossa_prob × melhor_odd − 1`.
- **Score** passa a combinar: nosso edge + **concordância com a linha sharp** (se o sharp também aponta, +confiança) + Kelly + guardrails. Divergência grande do sharp sem corroboração = cautela (pode ser nós errados, não o mercado).
- **CLV** (quando o t15m acumular) = juiz final: nossa pick venceu a linha de fechamento?

## 5. Papel da API predictions (task 14)
Modelo de prateleira da API. **Não é nossa resposta.** Usos:
1. **Benchmark** — se batermos a API consistentemente (Brier/log-loss), é sinal de edge.
2. **Input opcional** — blend leve de `predicted_goals` com nosso λ (com peso pequeno, só onde nosso dado é fraco).
"Segunda opinião" na UI = cross-check discreto, não protagonista.

## 6. Validação (o que torna isto honesto)
- **Backtest** contra resultado real: **calibração** (quando dizemos 60%, acontece ~60%?), Brier score, log-loss. Só expor "valor" quando o modelo estiver calibrado.
- **CLV** vs fechamento.
- **vs API** e **vs linha sharp**.
- Regra: **nada de "valor" baseado em modelo não validado** — até lá, rotular como estimativa.

## 7. Dado vs suposição (honestidade)
**Temos:** gols/resultados, **xG por jogo** (validado: `fact_fixture_stats` com xG ~100% no Brasileirão), forma, desfalques, standings, H2H, odds (forward), predictions (esparso).
**Falta confirmar / pode ser suposição:** cobertura de xG fora do Brasileirão; histórico suficiente por time pra estimar forças estáveis; peso de cada desfalque (minutos/importância); fator-mando por liga. **Seleções de Copa = pouca base** → modelo fraco lá (assumir e sinalizar).

## 8. Roadmap incremental
- **v0 (atual):** Poisson sobre média de gols da temporada (`futebol-tendencias.ts`) — fraco, só Brasileirão, cego pra Copa.
- **v1:** λ com **xG + forma (decaimento) + mando + ajuste de desfalque**; nossa prob por mercado; mostrar "nossa_prob vs mercado" no detalhe.
- **v2:** Dixon-Coles + **calibração/backtest**; handicap/supremacia; Score v2 (nosso edge + sharp).
- **v3:** CLV (t15m), blend/benchmark com API, monitor de calibração contínuo.

## 9. Armadilhas
Overfitting; dado esparso (Copa/início de temporada); confundir confiança do modelo com certeza; amostra pequena; não deixar a narrativa soar tipster. Sempre separar **estimativa** de **fato**.
