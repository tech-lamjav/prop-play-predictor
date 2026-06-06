# Projeção de grupos + auto-preenchimento dos 16 avos — plano

> Status: **plano aprovado, não iniciado.** Parte do branch `fix/bolao-oitavas-round-of-16`
> (Oitavas já feitas, não committadas). Decisões de UX já tomadas (ver §5).

## 1. Objetivo

A partir dos **palpites de placar dos jogos de grupo** do usuário, projetar a classificação de
cada grupo (1º/2º/3º/4º), mostrar isso ao vivo enquanto ele palpita, e **auto-preencher os 16 avos**
(os 32 classificados) nos Palpites Especiais — com confirmação.

Reduz o atrito: hoje o usuário palpita os jogos e, separadamente, escolhe 32 seleções na mão pros
16 avos. Com a projeção, os dois ficam ligados e coerentes.

## 2. Regras oficiais Copa 2026 (pesquisadas)

- **Classificação:** 12 grupos de 4. Avançam **12 primeiros + 12 segundos + 8 melhores terceiros = 32**.
- **Desempate dentro do grupo (ordem oficial):**
  1. Pontos
  2. **Confronto direto** entre os empatados: pontos → saldo → gols (mini-tabela só com os empatados)
  3. Saldo de gols geral
  4. Gols marcados geral
  5. Fair play (conduta)
  6. **Ranking FIFA** (substituiu o sorteio em 2026)
- **Melhores terceiros (entre grupos, sem confronto direto):** pontos → saldo → gols → fair play → ranking FIFA.

Fontes: [ESPN](https://www.espn.com/soccer/story/_/id/48703925/world-cup-group-stage-explained-tiebreakers-third-place-teams),
[FIFA oficial](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/groups-how-teams-qualify-tie-breakers).

**Adaptações na simulação:**
- **Fair play é ignorado** — cartões não são palpitados. Vai direto pro ranking FIFA após os gols.
- **Ranking FIFA** = `src/data/fifa-rankings.ts` (verificar cobertura dos 48 códigos).
- Comunicar sutilmente no UI: "desempates além dos gols usam o ranking FIFA".

## 3. Motor de simulação (algoritmo)

**Entrada:** palpites do usuário (placar por match_id) + `wc_matches` (grupos, 72 jogos) + fifa-rankings.
**Saída:** por grupo, lista ordenada [1º,2º,3º,4º]; ranking dos 12 terceiros → 8 melhores; os **32 classificados**.

Passos:
1. Por grupo (4 times, 6 jogos), montar standings a partir dos placares palpitados (P/V/E/D/GP/GC/SG/Pts).
2. Ordenar com o comparador:
   - Pontos desc.
   - Empate (2+ times com mesmos pontos): montar **mini-tabela de confronto direto** só com os jogos
     entre os empatados → ordenar por h2h pts → h2h saldo → h2h gols.
   - Persistindo empate: saldo geral → gols geral → (fair play pulado) → ranking FIFA.
3. Resultado: posição 1–4 por grupo.
4. **Terceiros:** juntar os 12 terceiros, ordenar por pts → saldo → gols → ranking FIFA; top 8 entram, 4 saem.
5. **32 classificados** = 12 primeiros + 12 segundos + 8 melhores terceiros.

**Nuance do confronto direto:** se 3 times empatam e o h2h re-separa parcialmente, a regra FIFA é recursiva.
Vamos usar a simplificação padrão (ordenar os empatados por h2h pts/saldo/gols e cair pro geral/FIFA se
ainda empatados) — suficiente pra uma projeção de bolão. Documentar a simplificação.

**Palpites incompletos:** se faltam jogos num grupo, a projeção do grupo é **provisória** (marcar como
"incompleto"). O auto-preenchimento dos 16 avos só habilita com **os 72 jogos de grupo palpitados**.

## 4. Escopo do auto-preenchimento

- Auto-fill **só dos 16 avos (round_of_32 = os 32 classificados)** — derivável dos palpites de grupo.
- Oitavas/quartas/etc. **não** auto-preenchem (dependem de palpite dos jogos de mata-mata, que não
  existem — bracket TBD). Continuam manuais.

## 5. UX (decisões tomadas)

- **Projeção ao vivo no fluxo de palpites de jogo** (modo "por grupo"): a tabela do grupo se forma
  conforme o usuário preenche os placares. Verde = 1º/2º (classificados), âmbar = 3º (candidato a melhor
  terceiro), apagado = 4º (fora).
- **Nos Palpites Especiais:** a projeção vira a **fonte do auto-preenchimento** dos 16 avos + um resumo
  "ver projeção".
- **Auto-fill = sugerir com confirmação:** botão "Usar projeção nos 16 avos" (habilitado com 72/72
  palpitados) → confirma → preenche. Não sobrescreve picks manuais sem aviso.

## 6. Arquitetura e arquivos

**Novo:**
- `src/components/bolao/group-projection.ts` — função pura `computeGroupProjection(...)` + tipos
  (`ProjectedStanding`, `GroupProjection`, `ProjectionResult`). Sem dependência de React (testável).
- `src/components/bolao/GroupProjectionTable.tsx` — tabela de um grupo (reaproveita o visual/StandingEntry
  do `CopaGruposView`), com destaque de classificados.
- Migration `054_set_round_of_32_bulk.sql` — RPC `set_round_of_32_from_projection(p_bolao_id, p_codes text[])`
  atômico: valida membro + prazo, substitui os round_of_32 do usuário pelos códigos dados (≤32).

**Alterar:**
- Fluxo de palpites de jogo (`PredictionsList`/`BolaoPalpites`, modo "por grupo") — renderizar a
  `GroupProjectionTable` por grupo, alimentada pelos palpites do usuário (hook existente de predictions).
- `SpecialPredictionsModal`/`SpecialPredictionsSection` — painel de projeção + CTA "Usar nos 16 avos".
- `bolao.service.ts` + `use-bolao.ts` — método/hook pro bulk set.

**Reaproveitar:** padrão de cálculo de standings do `CopaGruposView`; `fifa-rankings.ts`.

## 7. Fases de implementação

- **Fase A — Motor (base testável).** `group-projection.ts` + testes unitários (vitest): ordenação
  simples, confronto direto (2 e 3 empatados), ranking dos terceiros, palpites incompletos. *Não toca UI.*
- **Fase B — Projeção ao vivo.** `GroupProjectionTable` + integração no modo "por grupo" dos palpites de
  jogo, atualizando ao vivo.
- **Fase C — Auto-fill nos especiais.** Painel de projeção + CTA + dialog de confirmação no modal de
  especiais; habilita com 72/72.
- **Fase D — Bulk RPC.** Migration 054 + service/hook; ligar no CTA.
- **Fase E — Polimento.** Estados vazio/parcial ("faltam X jogos"), nota sutil sobre fair play/ranking FIFA,
  responsivo.

Ordem: A → B → (C+D juntas) → E. Cada fase é testável/entregável.

## 8. Testes
- **Unitários** (Fase A — onde mora o risco): casos de desempate, terceiros, incompleto.
- **E2E (Playwright):** palpitar um grupo inteiro → ver projeção → auto-fill → conferir round_of_32 no banco.

## 9. Validações antes de codar
- Confirmar que `fifa-rankings.ts` cobre os 48 códigos da Copa 2026 (senão, completar).
- Confirmar onde os palpites de jogo do usuário são lidos no front (hook) pra alimentar o motor.

## 10. Fora de escopo (backlog)
- Auto-fill de fases além dos 16 avos (precisa de palpite de mata-mata).
- Pontuação/liquidação dos palpites especiais de seleção (ainda não existe — ver doc de jogador).
- Mostrar qual chave/cruzamento cada classificado pega (tabela de cruzamentos dos 3ºs da FIFA).
