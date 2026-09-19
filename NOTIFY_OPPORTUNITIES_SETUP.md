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

- `daily_opportunities_sent` {segment, picks_count, top_score, delivery_id, batch_id,
  campaign_id, campaign_type, opportunity_ids, sent_status, telegram_message_id}
- `daily_opportunities_click` {destination, delivery_id, batch_id, link_id, campaign_type,
  opportunity_id, segment} (disparado pelo `go`)
- `telegram_opportunity_landing_opened` {delivery_id, batch_id, link_id, landing_path,
  time_since_sent_ms, is_authenticated} (disparado pelo SITE, ao abrir pelo link)
- Funil completo no banco: `opportunity_dispatch_state` (enviado) → `notification_clicks`
  (clicou) → `bets.channel` (registrou)

**`delivery_id` é a chave que liga os três eventos.** Antes dela o funil se partia no
meio: o `trace_id` do envio nascia uma vez por rodada do cron (o mesmo para centenas de
pessoas) e o `go` gerava outro no clique — casar os dois só dava por horário, que é
adivinhação. A chave é derivada de `campanha + dia BRT + user_id`, então é a MESMA em
toda reexecução do cron no mesmo dia: reenvio não vira entrega nova no painel.

`sent_status = success` significa **o Telegram aceitou o envio**, e nada mais. A API não
dá confirmação de leitura nem de recebimento. Ver `docs/catalogo-de-eventos.md`.
