# Oportunidades do dia no Telegram (08′) — Setup

Daily automático (cron **10h BRT**, após a carga do dbt): os melhores picks do dia do
`get_futebol_value_board` — a mesma fonte do site — direto no Telegram, com Score,
faixa e evidência. **Sem nome de casa de aposta** na mensagem.

## Peças

| Peça | O que faz |
| --- | --- |
| Migration `081_notify_opportunities.sql` | Tabelas `opportunity_dispatch_state` (cadência) e `notification_clicks` (funil) + RPC `get_opportunity_recipients` + cron 13:00 UTC |
| `notify-opportunities` | O daily: board → jogos de hoje → melhor pick por jogo → top 3 (Score ≥ 40) → DM. **Dia fraco = não manda nada.** |
| `go` | Redirecionador público dos links (registra clique, zera a régua da reativação, 302 pro site) |

## Regras de público

- **A · Futebol ativo** (assinante `users.futebol_subscription_status='premium'` OU trial de 7d vigente) + Telegram → recebe sempre.
- **B · Reativação** (Telegram linkado, sem aposta há 14+ dias) → recebe **até 2 envios; sem
  nenhum clique, para**. Clique (via `go`) zera o contador. Régua ajustável na RPC.
- Respeita `settlement_reminders_muted` (o 🔕 geral do bot).

## Deploy

1. Migration + functions via CI (já listadas nos workflows).
2. **Vault** (uma vez por ambiente):
   ```sql
   select vault.create_secret('<mesmo CRON_SECRET>', 'notify_opportunities_cron_secret');
   select vault.create_secret('https://<projeto>.supabase.co/functions/v1/notify-opportunities', 'notify_opportunities_url');
   ```
3. Dependências de produto: rotas `/futebol` e `/futebol/jogo/:id` (PR #180) no ar;
   suprimento de odds (Copa hoje; Brasileirão = ondas de expansão).

## Ensaio / teste manual

```bash
# relatório: picks do dia + quem receberia (não envia nada)
curl -s -X POST "https://<projeto>.supabase.co/functions/v1/notify-opportunities?mode=report" \
  -H "x-cron-secret: <CRON_SECRET>"

# envio real (mesmo que o cron faz)
curl -s -X POST "https://<projeto>.supabase.co/functions/v1/notify-opportunities" \
  -H "x-cron-secret: <CRON_SECRET>"
```
Obs.: se o board não tiver jogo FUTURO acima do corte, a resposta é `picks: 0` e nada é
enviado — comportamento correto, não bug.

## Métricas (PostHog + banco)

- `daily_opportunities_sent` {segment, picks_count, top_score}
- `daily_opportunities_click` {destination} (disparado pelo `go`)
- Funil completo no banco: `opportunity_dispatch_state` (enviado) → `notification_clicks`
  (clicou) → `bets.channel` (registrou)
