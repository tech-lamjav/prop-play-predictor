# Coletor de placares multi-liga (F1) — Setup

Implementa o desenho aprovado no parecer da task do coletor (Kasuya, 08/07):
`fixtures?live={ids}` + confirmação de encerramento em lote + cadência adaptativa
com **1 cron só** (gate SQL) + telemetria com alerta.

## Peças

| Peça | O que faz |
| --- | --- |
| Migration `082_multi_league_collector.sql` | Tabelas `fixtures` (com halftime/fulltime/extratime/penalty + trigger updated_at), `leagues_config` (seed Ondas 1+2, IDs API-Football), `team_aliases` (pro matching v2 — F2), `collector_runs` (telemetria) + 2 crons |
| `ingest-fixtures` | `?mode=calendar` (diário 04:00 BRT, 1 chamada/liga habilitada) e `?mode=live` (2/2min SÓ quando o gate SQL detecta jogo em janela; live={ids} + `fixtures?ids=` em lote pra confirmar FT/AET/PEN e capturar o placar dos 90') |

## Custo (contra o PRO: 7.500/dia, 300/min)

Regime normal ~50–150 chamadas/dia; pico de fds cheio ~250–350 (números do parecer).
Fora de janela de jogo: **zero** invocação — o gate é SQL no próprio cron.

## Deploy

1. Migration + function via CI (workflows já atualizados).
2. **Vault** (uma vez por ambiente):
   ```sql
   select vault.create_secret('<mesmo CRON_SECRET>', 'ingest_fixtures_cron_secret');
   select vault.create_secret('https://<projeto>.supabase.co/functions/v1/ingest-fixtures', 'ingest_fixtures_url');
   ```
3. Bootstrap: rodar 1x o calendário na mão (senão o gate do live nunca abre):
   ```bash
   curl -s -X POST "https://<projeto>.supabase.co/functions/v1/ingest-fixtures?mode=calendar" \
     -H "x-cron-secret: <CRON_SECRET>"
   ```
4. (Opcional, recomendado) Alerta de falhas consecutivas: setar secrets
   `ADMIN_TELEGRAM_CHAT_ID` (chat do admin) — `TELEGRAM_BOT_TOKEN` já existe.

## Ligar/desligar ligas (dado, não deploy)

```sql
update leagues_config set enabled = true where league_id = 39; -- Premier volta 15/08
```

## Plano de rollout (dual-run — decidido no parecer)

1. **F1 (isto):** coletor grava `public.fixtures` pra todas as ligas incl. Copa,
   com `ingest-wc-scores` intocado → ~10 dias de paridade em staging.
2. **F2 (próximo PR):** `notify-settlement` troca a leitura `wc_matches`→`fixtures`
   (matching v2: `match_date ±30h`, hint de liga, `team_aliases`, veredito de
   handicap asiático com half_won/half_lost) após paridade validada.
3. **Pós-Copa:** aposentar `ingest-wc-scores` + cron da 048.
4. `wc_matches` NÃO é migrada (é do bolão, morre 19/07).
   `futebol.fact_fixtures` NÃO é fonte de settlement (latência de horas; dono é o DE).

## Monitoramento

```sql
-- saúde do coletor (últimas execuções, chamadas, quota do plano)
select ran_at, mode, live_fixtures, api_calls, quota_remaining, ok, error
from collector_runs order by ran_at desc limit 20;
```
Alerta automático: DM pro admin após 5 falhas consecutivas.

## Fora do escopo deste PR (fases seguintes do parecer)

- F2: matching v2 + AH no computeVerdict
- F3: marker de predictions vazias (lado data-engineering)
- Rotação da API key (exposta no front via VITE_API_SPORTS_KEY) — fazer no cutover
