# Lembretes de Liquidação — Setup (Telegram)

O Betinho manda DM quando o jogo do usuário termina, com botões **[✅ Green] [❌ Red]** —
1 toque liquida a aposta. Para jogos da Copa a mensagem chega **com o placar e o veredito
sugerido** ("pelo placar, essa bateu ✅").

## Peças

| Peça | Onde | O que faz |
| --- | --- | --- |
| Migration `078_settlement_reminders.sql` | `supabase/migrations` | Colunas de cadência em `bets`, mute em `users`, placar 90' em `wc_matches`, RPC `get_settlement_reminder_candidates`, cron `notify-settlement` (15 min) |
| `notify-settlement` | `supabase/functions` | Cron: acha pendentes com jogo encerrado, casa com `wc_matches`, computa veredito e manda a DM com botões |
| `telegram-webhook` (alterado) | `supabase/functions` | Handler de `callback_query` (Green/Red/🔕) + comandos `/silenciar` e `/lembretes` |
| `ingest-wc-scores` (alterado) | `supabase/functions` | Passa a gravar `fulltime_home/away` (placar dos 90' — base da liquidação; o placar cheio inclui prorrogação) |

## Deploy (ordem)

1. **Migration**: `supabase db push` (ou aplicar `078_settlement_reminders.sql` via SQL editor).
2. **Functions**: deploy de `ingest-wc-scores`, `telegram-webhook` e `notify-settlement`
   (`notify-settlement` com `--no-verify-jwt`, igual às outras de cron/webhook).
3. **Vault** (uma vez por ambiente, igual 048/073):
   ```sql
   select vault.create_secret('<mesmo valor do env CRON_SECRET>', 'notify_settlement_cron_secret');
   select vault.create_secret('https://<projeto>.supabase.co/functions/v1/notify-settlement', 'notify_settlement_url');
   ```
4. **Secrets da função** (painel → Edge Functions): já existem para as outras —
   `TELEGRAM_BOT_TOKEN`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (automático).
5. **⚠️ setWebhook do bot**: os botões chegam como `callback_query`. Se o `setWebhook`
   foi feito com `allowed_updates` restrito a `["message"]`, os toques NÃO chegam.
   Conferir/reconfigurar:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   # se allowed_updates não incluir callback_query:
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=<url do telegram-webhook>" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
     -d 'allowed_updates=["message","edited_message","callback_query"]'
   ```

## Regras de produto (implementadas)

- **Cadência**: máx. **2 lembretes por aposta**, gap de 20h; máx. **3 mensagens por usuário por run**.
- **Copa** (casada com `wc_matches` encerrado): sai na hora do apito, com placar.
  Veredito só em mercado direto — ML/1x2, over/under de **gols**, ambas marcam —
  sempre pelo **placar dos 90'**. Múltipla, handicap, 1º tempo, classificação,
  escanteios etc. → pergunta sem afirmar. Linha exata (push) → sem veredito.
- **Genérica** (sem placar no banco): `match_date` passou há 3h+ (ou aposta com 24h+
  quando sem data de jogo), só entre **09h–23h BRT**.
- **Opt-out**: botão 🔕 na mensagem ou `/silenciar`; `/lembretes` reativa
  (`users.settlement_reminders_muted`).

## Teste manual (dev)

```bash
# disparar o cron na mão
curl -X POST "https://<projeto>.supabase.co/functions/v1/notify-settlement" \
  -H "x-cron-secret: <CRON_SECRET>"
# resposta: { ok, candidates, wc_finished_recent, due, sent, ... }
```
Pré-condições para receber a DM: usuário com `telegram_chat_id` preenchido, aposta
`pending` recente e (Copa) um `wc_matches` com `is_finished = true` cujos dois times
apareçam na descrição da aposta.

## Métricas (PostHog)

- `settlement_reminder_sent` — {kind: wc|generic, verdict, betting_market, reminder_number}
- `settlement_settled_via_bot` — {bet_id, outcome}
- `settlement_reminders_muted` / `_unmuted` — {via: button|command}

North star do Marco 0: taxa de liquidação ≥ 60% (hoje ~28%). Funil:
`settlement_reminder_sent` → `settlement_settled_via_bot`.
