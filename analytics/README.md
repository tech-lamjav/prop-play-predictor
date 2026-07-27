# analytics/

Queries SQL versionadas do plano de métricas de retenção (ver `docs/plano-metricas-retencao.md`).

**Banco:** projeto Supabase **"Smart Betting"** (prod, ref `lavclmlvvfzkblrstojd`). Todas são `SELECT` read-only.

Métricas que vivem no banco (não no PostHog) porque dependem de estado limpo da tabela `bets`:
liquidação, North Star (aposta liquidada/semana), ativação, tamanho da base ativa.
Comportamento (funis, retenção de telas, views) fica no PostHog via os eventos instrumentados.

| Arquivo | Métrica |
|---|---|
| `retencao.sql` | Bloco único com todas as queries, rotuladas por métrica (E1, E2/B1 coorte, viés de sobrevivência, base ativa) |

> ⚠️ `days_to_settle` histórico está contaminado pelo backfill de 31/jan/2026 (`updated_at` reescrito em lote). A janela "≤7d" só é confiável para apostas criadas após essa data. Daqui pra frente o evento `bet_settled` (com `settled_by`) dá a medição limpa no PostHog.
