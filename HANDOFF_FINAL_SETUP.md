# Passagem de bastão do dia da final (H1) — DM de encerramento

No dia **19/jul**, depois da final encerrar, cada membro de bolão com Telegram recebe
**uma DM** com sua posição definitiva + as duas portas: Betinho (casual) e análise de
futebol (frequente). Par da peça web: `BolaoHandoffCard` (aba Ranking, aparece sozinho
quando a final encerra).

**Não tem cron.** Execução manual em 2 passos, no dia da final:

```bash
URL="https://<projeto>.supabase.co/functions/v1/notify-handoff"
SECRET="<CRON_SECRET do painel>"

# 1) RELATÓRIO — lista quem receberia e a posição em cada bolão. Não envia nada.
curl -s -X POST "$URL?mode=report" -H "x-cron-secret: $SECRET"

# 2) ENVIA — 1 DM por usuário (idempotente via bolao_handoff_notifications)
curl -s -X POST "$URL?mode=send" -H "x-cron-secret: $SECRET"
```

**Guarda de segurança:** a função recusa (`412`) enquanto a final não estiver
`is_finished` em `wc_matches` — impossível disparar antes da hora. Em staging,
`&force=true` pula a guarda pra ensaio.

O rank da DM vem de `get_bolao_ranking()` — a mesma função do site; nunca diverge.
Respeita `settlement_reminders_muted`. Métricas: `bolao_handoff_dm_sent` {boloes_count,
best_rank} + `bolao_handoff_view/click` (peça web) → taxa de reconquista H1.

Dependência de rota: `/futebol/comecar` entra com o PR #188.
