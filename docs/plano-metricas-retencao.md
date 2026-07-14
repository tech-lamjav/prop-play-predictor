# Plano de Métricas de Retenção — Smart Betting

> **Status:** proposta para revisão com os sócios · **Data:** 2026-07-06 · **Baseline real puxado do banco prod em 2026-07-08** (ver §1.1).
> **Contexto:** desdobramento da reunião de sócios (04/jul) sobre o plano de retenção. Tese nº 1: *ainda não medimos de forma aprofundada*. Este documento define **o que** medir, **onde** os dados nascem e **como** executar a instrumentação em fases.
> **Documentos-irmãos:** `smart-betting-retencao.html` (diagnóstico + roadmap em 4 marcos) · PR #180 (módulo Futebol) · `docs/futebol-prod-deploy.md` (repo principal).
> **Rastreio ao vivo:** dashboard PostHog [Retenção — Starter](https://us.posthog.com/project/242542/dashboard/1814242) (proxies de comportamento já rodando; liquidação entra quando `bet_settled` existir — Fase 1).

---

## 1. Tese de medição

O diagnóstico (banco prod, jun/2026) mostrou que o estágio quebrado do nosso loop é a **recompensa variável**: 72% das últimas apostas nunca foram liquidadas, 67% dos usuários somem após 1 dia, e o funil 603 contas → 12 premium afunila cedo demais.

Toda melhoria do roadmap (nudge, notificação de resultado, winback, lançamento do futebol) existe para consertar esse loop. Logo, **a régua de sucesso de qualquer implementação é: moveu uma métrica deste plano ou não moveu**. Cada experimento deve nascer com hipótese do tipo *"X vai subir a métrica Y de A para B"*. Se não move nenhuma, não prioriza.

## 1.1. Retrato real (baseline do banco prod, 2026-07-08)

Ao puxar o baseline antes de instrumentar, dois fatos mudaram a leitura do diagnóstico de junho:

**a) A base ativa é minúscula — e este é o gargalo nº 1, não a liquidação.** 110 usuários já apostaram na história toda (desde out/2025); **apenas 6 ativos nos últimos 30 dias, 16 nos últimos 90**. Uso ultra-concentrado: 7 power users concentram 78% de todas as apostas.

**b) A taxa de liquidação "melhorou" por VIÉS DE SOBREVIVÊNCIA, não por melhoria de produto.** A liquidação agregada subiu (mar–jul 2026 em 90%+) exatamente quando a aquisição do Betinho foi cortada. Não é o produto ficando melhor — é a base se filtrando para quem já liquidava. A prova está na liquidação por intensidade de uso:

| Perfil do usuário | Usuários | Apostas | % liquidada |
|---|---|---|---|
| 1 aposta só | 36 | 36 | **16,7%** |
| 2–9 apostas | 55 | 219 | 40,2% |
| 10–49 | 12 | 186 | 71,5% |
| 50+ apostas | 7 | 1.539 | **96,2%** |

O hook quebrado do diagnóstico **continua**: um usuário novo tem 16,7% de chance de um dia liquidar a 1ª aposta. Cortar tráfego só tirou os casos ruins do numerador. (Houve um backfill real em 31/jan/2026 — 435 liquidações num dia — mas ele não é o motor da alta de mar–jul; a composição é.)

**Duas consequências que atravessam todo o plano:**
1. **Liquidação tem que ser medida por coorte de novos, nunca no agregado** (o agregado é vaidade — paradoxo de Simpson). As métricas E2 e B1 abaixo já refletem isso.
2. **Ordem de operações:** reabrir aquisição (futebol, handoff do bolão) vai derrubar a taxa agregada de novo se o loop do novato não for consertado antes/junto. **Marco 0 tampa o furo; futebol/bolão enchem o balde.** Medir só um dos dois engana.

**Princípio de portfólio:** não medimos "o produto" — medimos **3 produtos + 1 ecossistema**, com o mesmo esqueleto (ação-núcleo → ativação → curva de coorte → frequência) e ações-núcleo diferentes:

| Produto | Fase | Ação-núcleo (o que é "usar de verdade") |
|---|---|---|
| **Futebol** | lançamento (Marco 1) | Registrar aposta a partir de uma oportunidade do board |
| **NBA** | maduro, sazonal (volta out/2026) | Consultar análise (360 / props / jogo) em dia de jogo |
| **Betinho** | transversal | Aposta registrada **e liquidada** |
| **Bolão** | sazonal, morre 19/jul | (não otimizar — só medir o handoff) |

---

## 2. Métricas do Ecossistema (visão dos sócios)

A camada que responde "a empresa está reter melhor?" — imune à sazonalidade de cada produto.

| # | Métrica | Definição | Fonte | Cadência |
|---|---|---|---|---|
| E1 | **North Star: usuários com ≥1 aposta liquidada/semana** (em qualquer produto) | `bets` com `status` final na semana, distinct `user_id` | SQL (`bets`) | semanal |
| E2 | **Taxa de liquidação de novos (coorte)** | % da **1ª aposta de usuários novos** que chega a status final em ≤7 dias — **NÃO** a taxa agregada (vaidade, viés de sobrevivência — ver §1.1) | SQL (`bets`) | semanal |
| E3 | **Multi-produto** | % dos ativos da semana com atividade em 2+ produtos (`channel` distintos em `bets` + eventos NBA) | SQL + PostHog | mensal |
| E4 | **Migração sazonal** | Coorte "ativos no bolão em jul" → % ativos em Futebol/NBA em ago/set | PostHog Cohorts | mensal (crítico pós-19/jul) |
| E5 | **Curva de coorte de novos usuários** (D1/D7/D30) | Das contas criadas na semana X, % que retorna | PostHog Retention | semanal |

- **Meta do Marco 0:** liquidação da **1ª aposta de novos em ≤7 dias** de ~17% (baseline §1.1) → ≥60%. *(A antiga meta "28%→60% agregada" foi aposentada: o agregado hoje já marca 90%+ por viés de sobrevivência, sem que o produto do novato tenha melhorado.)*
- **E1 é a métrica-mãe** porque exige o loop completo (apostou → liquidou → recompensa) e soma os produtos: futebol e Betinho gravam na mesma tabela `bets` com `channel` diferente (decisão do PR #180), NBA alimenta via Betinho.
- **Hipótese a validar com E3:** usuário multi-produto retém múltiplas vezes mais. Se confirmar, é o argumento quantitativo de todo o investimento em cross-sell.

---

## 3. Futebol — métricas de lançamento (4 camadas)

Produto novo não se pergunta "a retenção está boa?", e sim **"existe retenção?"** (sinal de product-market fit). Referência de telas/mecânica: PR #180 (Hoje, Oportunidades, Jogos, Jogo, Time, `/futebol/assinar`; reverse trial 7 dias sem cartão; blur FOMO no pick; `RegistrarAposta` → `bets.channel='futebol'`).

### Camada 0 — Supply (pré-requisito; olhar diário)

Ninguém retém em marketplace vazio. Limitação conhecida do pipeline: odds chegam aos poucos e o dbt reconstrói 1x de madrugada.

| # | Métrica | Fonte |
|---|---|---|
| F0.1 | Oportunidades ativas no board por dia | SQL (`fact_value_opportunities` / `get_futebol_value_board()`) |
| F0.2 | % de jogos do dia com odds cobertas | SQL (`fact_odds_snapshot` × `fact_fixtures`) |

> Quando qualquer métrica de retenção do futebol cair, **primeiro descartar queda de supply** antes de concluir "problema de produto".

### Camada 1 — Funil reverse trial (lifecycle/monetização)

`anon (blur) → signup/trial start → ativado no trial → dia 7 → { assina | free-engajado | some }`

| # | Métrica | Definição | Fonte |
|---|---|---|---|
| F1.1 | Conversão trial → pago | % de trials iniciados que assinam (R$ 29,90 / R$ 299) | SQL (`users.futebol_subscription_status` + `futebol_trial_started_at`) |
| F1.2 | **Ativação no trial** | % de trials com ≥1 aposta via RegistrarAposta em ≤7 dias | SQL (`bets.channel='futebol'` × trial window) |
| F1.3 | Pós-expiração engajado | % de expirados que seguem visitando o board borrado (pool de winback) | PostHog (`futebol_board_viewed` filtrado por `access_state='expired'`) |
| F1.4 | Efeito urgência | Conversões nos dias 6–7 (chip âmbar) vs. dias 1–5 | SQL |

> **F1.2 é o preditor.** Quem prova o loop completo dentro do trial converte; quem só olha, não. É a métrica que diz se o onboarding do trial funciona.

### Camada 2 — Loop de uso (a retenção em si)

`board visto → oportunidade aberta → "O que olhar" → aposta registrada → auto-liquidada → resultado visto`

| # | Métrica | Definição | Fonte |
|---|---|---|---|
| F2.1 | Conversão oportunidade → aposta | % de oportunidades abertas que viram `bets.channel='futebol'` | PostHog Funnel + SQL |
| F2.2 | **Retorno pós-liquidação** | % de apostas liquidadas cujo dono reabre o app em ≤48h | PostHog (liquidação → próximo evento do usuário) |
| F2.3 | Coorte semanal W1/W2/W4 | % da coorte de signup que refaz a ação-núcleo | PostHog Retention |
| F2.4 | Curva achatou? | A W4 estabiliza em um patamar > 0? | leitura da F2.3 |

> **F2.4 é o teste de PMF**: curva que despenca a zero = sem fit; curva que achata (mesmo em 20%) = existe núcleo, o jogo vira crescer o patamar. **F2.2 é o teste da tese central** — o futebol nasce com auto-liquidação justamente onde o bolão quebrou.

### Camada 3 — Retenção por superfície

Retention filtrado por tela: o retido volta pelo **board** (value bet puro) ou pela **análise** (Raio-X, modelo de gols, H2H)? Decide onde investir conteúdo. Mesma régua aplicada ao NBA (§4.3) → comparação direta entre produtos.

### Cross-sell (one-shot 19/jul)

Funil já semi-instrumentado: `crosssell_futebol_cta_click` → `futebol_early_access_signup` → conta → trial → ativado (F1.2). Medir por origem (`source`) para saber quanto o handoff do bolão rendeu.

---

## 4. NBA — métricas de produto maduro

**Pegadinha sazonal:** estamos em julho = offseason. Medir retenção NBA agora dá número distorcido; a temporada 26-27 começa em outubro (= Marco 3). Até lá, só baseline.

| # | Métrica | Definição | Observação |
|---|---|---|---|
| N1 | Coorte D7/D30 **dentro da temporada** | idem E5, filtrado por eventos `nba_*` | nunca comparar coorte de playoffs com coorte de janeiro sem contexto |
| N2 | **Ressurreição pós-offseason** | % dos ativos da temporada 25-26 que voltam nas 4 primeiras semanas da 26-27 | a métrica mais valiosa de outubro — mede se o produto deixou saudade |
| N3 | Retenção por feature | Retention filtrado por `Análise 360` vs `Picks` vs `Games/props` | diz onde investir e o que cortar |
| N4 | DAU/WAU **em dias de jogo** | frequência com denominador correto para produto de consulta pré-jogo | dias sem jogo não contam contra |
| N5 | Churn premium | cancelamentos/mês da base pagante | com N≈12, cada cancelamento merece **entrevista**, não só métrica |

Superfícies a instrumentar: `HomeNBA`, `Analise360List/Detail`, `Picks`, `Games/GameDetail`, `PlayerSelection`.

---

## 5. Betinho — o motor transversal

| # | Métrica | Definição | Fonte |
|---|---|---|---|
| B1 | Taxa de liquidação **por coorte de novos** | % da 1ª aposta de usuários novos que sai de `pending` em ≤7 dias (agregado = vaidade, ver §1.1) | SQL |
| B2 | Tempo até liquidar | mediana criação → status final | SQL |
| B3 | Ativação | % de novos usuários com 1ª aposta **liquidada** em ≤7 dias da conta | SQL |
| B4 | Apostas/usuário ativo/semana | intensidade de uso | SQL |
| B5 | Registro por canal | telegram vs web vs futebol (`channel`; WhatsApp descontinuado — legado tem canal nulo) | SQL |

> **Fricção estrutural encontrada no código:** a liquidação do Betinho é **manual** — o usuário atualiza o status em lote na UI web (`Bets.tsx`). O `bet_created` chega por 3 canais, mas a recompensa exige disciplina manual. Isso explica mecanicamente por que o novato liquida só 17% (§1.1): sem o hábito, ninguém volta pra fechar a aposta. Reforça as apostas do roadmap (nudge de resultado, liquidação em lote no winback, auto-liquidação por liga no futebol) — todas atacam justamente essa disciplina manual.

### Bolão (só o handoff)

Não otimizar produto que morre em 13 dias. Medir apenas: participação no ranking final (19/jul), cliques no CTA de handoff (H1) e E4 (migração). Eventos de bolão existentes já bastam; adicionar só `bolao_handoff_cta_clicked` se o H1 entrar.

---

## 6. Inventário — o que já existe vs. o que falta

### Já instrumentado hoje

| Onde | Eventos |
|---|---|
| Front (`posthog-js`, `main.tsx`) | `$pageview` (manual via `PostHogPageView`), `$pageleave`, `signed_up`, `signed_in` |
| Front — bolão/cross-sell | `landing_bolao_viewed`, `landing_bolao_cta_clicked`, `crosssell_futebol_{shown, preview_open, step_view, cta_click, dismissed, opted_out}`, `futebol_lp_viewed`, `futebol_early_access_signup` |
| Edge — Telegram/WhatsApp | `bet_created` ✅ (os dois webhooks), `bet_legs_saved`, operacionais (`bet_extraction_*`, `daily_limit_*`, `processing_error`, `openai_api_error`), `$ai_generation`, `$identify` |

### Lacunas (em ordem de dor)

1. **`bet_created` via web não existe** — `createBet` em `Bets.tsx` insere direto no Supabase sem evento. O funil por canal fica cego no web.
2. **Liquidação não emite evento em lugar nenhum** — nem a manual (`Bets.tsx`, update em lote) nem a automática do bolão (`ingest-wc-scores`). **É a métrica central do plano e hoje é invisível no PostHog** (só recuperável por SQL).
3. **NBA: zero eventos.** Nenhuma tela de análise rastreada.
4. **Bolão: palpite salvo não é evento** (`use-bolao.ts` upsert) — retenção do bolão só por pageview, impreciso.
5. **Futebol: eventos do produto real** ainda não existem (o PR #180 não inclui analytics de produto) — precisam nascer **junto com o lançamento**, não depois.
6. **Identify consistente:** conferir que o `distinct_id` dos webhooks (server) é o mesmo `auth.users.id` do front — senão funis cross-canal quebram. (Verificação da Fase 1.)

> **Atualização (2026-07-08, branch `feat/metrics-fase1`):** lacunas **1, 2 e 4 fechadas** — `bet_created` web; `bet_settled` nos 4 caminhos da web **+ settle ✅/❌ do bot (`telegram-webhook`) + `winback-backfill` (auto)**, os dois caminhos server-side que a revisão de código pegou como invisíveis. Lacuna **3 (NBA) instrumentada** (4 telas, capturas só logado). **5 segue no PR #180.** **6 verificada** (ambos usam `auth.users.id`). Notas: WhatsApp foi **descontinuado** (webhook legado permanece, sem apostas novas); **cadastro só existe no web** — o bot exige conta vinculada (`telegram_user_missing`), então `signed_up` cobre 100% da aquisição.

---

## 7. Spec de instrumentação

### Convenções

- **Prefixo por produto:** `futebol_*`, `nba_*`, `betinho_*`, `bolao_*`. Exceção: `bet_created` (server) **mantém o nome** — tem histórico; padronizamos via propriedade.
- **Propriedades comuns em todo evento:** `product` (`futebol|nba|betinho|bolao`), `channel` quando aplicável (`telegram|web|futebol` — WhatsApp descontinuado; apostas legadas têm `channel` nulo).
- **`distinct_id` = `auth.users.id`** em front e edge, sempre.
- **Nunca renomear evento com histórico**; deprecia e cria novo se precisar.
- Snake_case, verbo no particípio (`_viewed`, `_created`, `_settled`).

### Eventos novos — Betinho/core (Fase 1)

*(Tabela reflete o **implementado** na branch `feat/metrics-fase1` — é o contrato dos dashboards.)*

| Evento | Propriedades | Dispara em | Camada |
|---|---|---|---|
| `bet_created` (estendido ao web) | `product:'betinho'`, `channel:'web'`, `bet_type`, `sport`, `is_credit_bet` | `Bets.tsx` → `createBet` (sucesso do insert). *Sem `has_odds`: odds inválida lança antes do insert, a prop seria sempre true.* | front |
| `bet_settled` ⭐ | `product`, `channel`, `status` (6 finais = `SETTLED`), `days_to_settle`, `settled_by:'user_manual\|auto'`, `batch`, `count` (nº que **realmente** liquidou na ação), `via` (`bot_reminder\|winback_backfill`, só edge) | helper único `captureBetSettled` em `Bets.tsx` (4 caminhos: linha, lote, edição, cashout) · settle ✅/❌ do bot (`telegram-webhook`) · `winback-backfill` (`auto`) | front + edge |
| `bolao_palpite_saved` | `product:'bolao'`, `mode:'single\|batch'`, `count`, `bolao_id` | `use-bolao.ts` → onSuccess das mutations. *Undo do Quick Pick passa `silent` e não conta como engajamento.* | front |
| `bolao_palpite_settled` | — | **descartado por decisão**: bolão encerra 19/jul; a recompensa já é observável via `bolao_ranking_viewed` e exigiria query por-usuário no edge | — |
| `bolao_ranking_viewed` | `product:'bolao'`, `bolao_id` | `BolaoDetail` (aba Ranking) — **1x por bolão/visita, só participante com ranking carregado** (não-membro/id inválido não contamina a coorte E4; troca de aba não re-dispara) | front |

⭐ = destrava a métrica central (E2, B1, F2.2). O bot mantém o evento legado `settlement_settled_via_bot` por continuidade de histórico.

### Eventos novos — NBA (Fase 3, antes de outubro)

| Evento | Propriedades | Dispara em |
|---|---|---|
| `nba_analise360_viewed` | `product:'nba'`, `player_id` | `Analise360Detail` |
| `nba_game_viewed` | `product:'nba'`, `game_id` | `GameDetail` |
| `nba_picks_viewed` | `product:'nba'` | `Picks` |
| `nba_home_viewed` | `product:'nba'` | `HomeNBA` |

*(4 eventos bastam para N1–N3; **todos capturam só logado** — `/home-nba` e `/game/:id` são rotas públicas, e sem esse gate os denominadores das 4 superfícies ficariam incomparáveis. Props ricas — `game_day`, `picks_count`, `entry_point` — ficam pra quando a temporada voltar, se fizerem falta: as capturas são de mount, antes dos dados carregarem. N4 (`game_day`) por ora sai por SQL/calendário de jogos.)*

### Eventos novos — Futebol (Fase 2, embarca no lançamento / PR #180)

| Evento | Propriedades | Dispara em |
|---|---|---|
| `futebol_board_viewed` | `access_state:'anon\|trial\|expired\|subscribed'`, `opportunities_count`, `filters` | Oportunidades |
| `futebol_opportunity_opened` | `fixture_id`, `market`, `score_range`, `access_state` | board → detalhe/“O que olhar” |
| `futebol_gate_hit` | `surface`, `access_state` | `FutebolGate` (blur renderizado p/ locked) |
| `futebol_trial_started` | `source` | `useFutebolAccess` / `get_futebol_access` 1º acesso |
| `futebol_bet_registered` | `fixture_id`, `market`, `odd`, `from:'jogo\|oportunidades'` | `RegistrarAposta` sucesso (além do insert em `bets`) |
| `futebol_subscribe_page_viewed` / `futebol_subscribed` | `plan:'mensal\|anual'`, `trial_day` | `/futebol/assinar` / webhook de pagamento (Abacate, Fase 2 do billing) |

### Métricas por SQL (não dependem de PostHog — funcionam HOJE)

Colunas validadas contra o schema prod (`public.bets`): `user_id`, `status` (`won|lost|void|cashout|half_won|half_lost|pending`), `channel` (`telegram|web|null` legado), `created_at`, `updated_at`.

```sql
-- E2/B1: taxa de liquidação POR COORTE DE NOVOS (1ª aposta liquidada em ≤7d),
-- por semana de entrada do usuário. NÃO usar taxa agregada (viés de sobrevivência, §1.1).
with primeira_aposta as (
  select user_id,
         min(created_at) as entrada,
         (array_agg(status order by created_at))[1] as status_1a,
         (array_agg(updated_at order by created_at))[1] as updated_1a,
         (array_agg(created_at order by created_at))[1] as created_1a
  from public.bets group by user_id
)
select date_trunc('week', entrada)::date as semana_entrada,
       count(*) as novos,
       count(*) filter (where status_1a <> 'pending'
         and updated_1a <= created_1a + interval '7 days') as liquidaram_1a_7d,
       round(100.0 * count(*) filter (where status_1a <> 'pending'
         and updated_1a <= created_1a + interval '7 days') / count(*), 1) as pct
from primeira_aposta group by 1 order by 1 desc;

-- Retrato de viés de sobrevivência: liquidação por intensidade (§1.1)
with u as (
  select user_id, count(*) total,
         count(*) filter (where status <> 'pending') settled
  from public.bets group by user_id
)
select case when total>=50 then 'd) 50+' when total>=10 then 'c) 10-49'
            when total>=2 then 'b) 2-9' else 'a) 1' end as perfil,
       count(*) usuarios, sum(total) apostas,
       round(100.0*sum(settled)/sum(total),1) pct_liquidada
from u group by 1 order by 1;

-- E1: North Star — usuários com ≥1 aposta liquidada na semana, por canal
select date_trunc('week', updated_at)::date as semana, coalesce(channel,'(legado)') as canal,
       count(distinct user_id) as usuarios_ns
from public.bets where status in ('won','lost','void','half_won','half_lost','cashout')
group by 1, 2 order by 1 desc;

-- B3: ativação — 1ª aposta liquidada em ≤7 dias da conta
-- F1.1/F1.2: trial→pago e ativação no trial (users.futebol_* × bets.channel='futebol')
-- F0.1: supply — oportunidades/dia (fact_value_opportunities)
-- (queries versionadas em analytics/retencao.sql)
```

> ⚠️ **`days_to_settle` histórico está contaminado** pelo backfill de 31/jan/2026 (`updated_at` reescrito em lote). A janela "≤7d" só é confiável para apostas criadas **após** essa data — daqui pra frente, com `bet_settled` emitindo `settled_by` (`user_manual|auto`), a medição fica limpa.

---

## 8. Dashboards PostHog (montagem na UI, sem código)

O PostHog **já está configurado** (front + edge). Visualização é point-and-click na UI — **não precisamos de API nem de nada manual**. A API HogQL fica como opção futura se quisermos dashboard próprio.

| Dashboard | Insights (tipo nativo do PostHog) |
|---|---|
| **1. Ecossistema** (sócios, semanal) | E5 Retention (signup → retorno) · E1/E2 via Trends de `bet_settled` · Lifecycle (new/returning/resurrecting/dormant) · E4 Cohorts bolão→futebol |
| **2. Futebol — lançamento** | Funnel anon→signup→trial→`futebol_bet_registered` · Retention W1–W4 (F2.3) · Trends `futebol_board_viewed` por `access_state` (F1.3) · Funnel cross-sell completo |
| **3. Betinho — loop** | Funnel `bet_created`→`bet_settled` por `channel` · Trends `days_to_settle` · Stickiness |
| **4. NBA** (montar em set) | Retention por feature (N3) · Trends `nba_*_viewed` · Stickiness em dias de jogo |

Cohorts a criar: **Sharp** (ativo em futebol/NBA), **Casual** (só bolão), **Trial ativo**, **Trial expirado engajado**.

---

## 9. Plano de execução

### Fase 1 — Instrumentar o core (esta semana, ~1–2 dias de dev)
*Destrava a medição do Marco 0 antes da Copa acabar.*

- [x] **`distinct_id` consistente verificado (lacuna 6):** front chama `posthog.identify(user.id)` (`Auth.tsx`) e webhooks usam `distinctId = userId` → ambos = `auth.users.id`. Web e bot contam como a mesma pessoa. *(Spot-check pendente: confirmar que o `userId` passado nos webhooks é o uuid do `auth.users`, não um id de chat.)*
- [x] **`bet_created` web + `bet_settled` instrumentados** (aguardam verificação live no PostHog): schema único via helper `captureBetSettled` (`Bets.tsx`, 4 caminhos: linha, lote, edição, cashout) **+ settle do bot (`telegram-webhook`) + `winback-backfill` com `settled_by:'auto'`** — props conforme tabela §7 (`product`, `count` correto, sem `batch_size`). tsc + eslint limpos.
- [x] **`bolao_palpite_saved`** (`use-bolao.ts`, single+batch; Undo do Quick Pick é `silent`) — `bolao_palpite_settled` **descartado por decisão** (ver §7).
- [x] **`bolao_ranking_viewed`** (`BolaoDetail`, 1x por bolão/visita, só participante).
- [x] **Eventos `nba_*`** antecipados da Fase 3 (4 telas, capturas só logado).
- [x] **Baseline registrado (§1.1)** — puxado do banco prod 2026-07-08: base 110 users / 6 ativos 30d; liquidação de novos ~17% (o número que importa); viés de sobrevivência documentado.
- [x] **Dashboard PostHog starter no ar** ([id 1814242](https://us.posthog.com/project/242542/dashboard/1814242)): pulso de apostas, aquisição web, retenção de apostadores, apostadores únicos/sem, nº do mês + cartão de baseline honesto.
- [x] **Pasta `analytics/` criada** com as queries versionadas (`analytics/retencao.sql`, validadas contra o schema prod).
- [x] **Revisão de código pré-PR** (8 ângulos + verificação independente): 10 achados corrigidos — incluindo os 2 caminhos server-side de liquidação que estavam invisíveis (bot e winback).
- **Pronto quando:** eventos `bet_settled`/web aparecendo no PostHog Live Events (pendente: exige deploy das edge functions `telegram-webhook` e `winback-backfill` + front em produção); aí a coorte de liquidação de novos passa a atualizar sozinha.

### Fase 2 — Dashboards + futebol (semana de 13/jul, antes do lançamento)
- [ ] Montar Dashboards 1 e 3 na UI do PostHog + Cohorts
- [ ] Adicionar os eventos `futebol_*` na branch do PR #180 (nascem com o produto, não depois)
- [ ] Definir com o Mateus a métrica de supply F0.1/F0.2 (query sobre `fact_value_opportunities`)
- [ ] `bolao_handoff_cta_clicked` se o H1 (19/jul) entrar
- **Pronto quando:** dashboard do ecossistema mostra a semana atual sem query manual; futebol lança instrumentado no dia 1.

### Fase 3 — NBA + ritual (agosto)
- [x] 4 eventos `nba_*` (antecipados na Fase 1) — falta só o Dashboard 4 (baseline no offseason, régua pronta pra outubro)
- [ ] Preparar coorte de ressurreição N2 (ativos 25-26)
- [ ] **Instituir o ritual semanal** (30 min, toda segunda): E1, E2, curva da última coorte, funil do futebol, supply. Uma pergunta fixa: *"o que lançamos semana passada moveu qual métrica?"*
- **Pronto quando:** primeira revisão semanal feita com dados, não com feeling.

### Fase 4 — Temporada NBA (outubro, junto do Marco 3)
- [ ] Acompanhar N2 (ressurreição) nas 4 primeiras semanas da temporada
- [ ] Entrevistar todo churn premium (N5)
- [ ] Revisar este plano: aposentar métrica que ninguém olhou, promover a que decidiu algo

### Fora de escopo (por decisão)
- API/HogQL e dashboards custom — a UI resolve; reavaliar só se os sócios pedirem visão fora do PostHog.
- A/B testing formal e feature flags — base pequena demais (n≈centenas); experimentos são antes/depois com baseline.
- Micro-eventos de UI (scroll, hover) — ruído a este tamanho de base.

---

## 10. Glossário rápido (para a conversa com os sócios)

- **Coorte:** grupo que começou na mesma semana; acompanhamos cada grupo separadamente para comparar "safras".
- **D1/D7/D30 (W1/W4):** % da coorte que volta 1/7/30 dias (1/4 semanas) depois.
- **Curva achatar:** a % de retorno para de cair e estabiliza — sinal de que existe um núcleo retido (PMF).
- **Stickiness (DAU/WAU):** de quantos dias da semana o usuário ativo de fato usa — mede hábito.
- **Ressurreição:** usuário dormente que volta (ex.: pós-offseason da NBA).
- **Reverse trial:** começa com tudo liberado 7 dias → downgrade para free com pick borrado (FOMO) → conversão.
- **North Star:** a métrica única que melhor representa valor entregue — aqui, **aposta liquidada por usuário/semana**, porque exige o loop completo funcionando.
