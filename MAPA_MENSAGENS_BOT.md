# Mapa de mensagens do bot — quando cada uma dispara

Toda mensagem que o Betinho pode mandar no Telegram, com gatilho, momento, teto e
opt-out. **Regra de ouro do produto: mensagem só existe se merecer existir** — dia
fraco = silêncio; usuário que ignora = para de receber.

## Recorrentes (automáticas)

| # | Mensagem | Gatilho | Quando chega | Teto anti-spam | Opt-out |
|---|---|---|---|---|---|
| 1 | **"✅ Fechei sua aposta: green/red"** (auto-liquidação) | Jogo da aposta terminou + match perfeito (mercado direto, placar no banco) | **~5–20 min após o apito** (placar entra ~5 min; carteiro roda a cada 15 min). Qualquer hora — quem apostou no jogo está acordado vendo o jogo | Compartilha o teto de **3 msgs de liquidação por usuário por rodada de 15 min** | 🔕 botão / `/silenciar` |
| 2 | **"🏁 Placar X×Y — como foi?"** (jogo casado, mercado não-computável: múltipla, prop...) | Mesmo gatilho da #1, quando o bot não pode cravar | Mesmo momento da #1 | Mesmo teto da #1 + máx **2 lembretes por aposta** (gap 20h) | 🔕 |
| 3 | **"⏱️ Seu jogo já deve ter terminado — como foi?"** (genérico, sem placar no banco) | `match_date` passou há 3h+, ou aposta com 24h+ sem data de jogo | Só entre **09h–23h BRT** | Mesmo teto da #1 + máx 2 por aposta (gap 20h) | 🔕 |
| 4 | **"⚽ As oportunidades de hoje"** (daily) | Cron diário | **10h BRT em ponto**, 1x/dia — e SÓ se houver pick acima do corte (Score ≥ 40). Sem pick = sem mensagem | Reativação (segmento B): **2 envios sem clique → para pra sempre** | 🔕 |
| 4a | **Registrar aposta** (botão "📋 Registrar" no daily #4) | Usuário toca no botão de um pick | Reativa (resposta ao toque): pergunta o valor por botões [1 unidade][½ unidade][Outro valor]; "Outro valor" = force_reply amarrado. Registra a aposta pendente → entra no loop da auto-liquidação (#1) | Reativa — só responde ao toque | n/a |
| 5 | **Confirmação de aposta registrada** | Usuário mandou print/texto | Imediato (resposta ao registro) | Reativa — só responde ao que o usuário fez | n/a |
| 6 | **Aviso de kickoff do bolão** (só pro DONO do bolão) | Jogo da Copa começando | No minuto do kickoff (:00/:30) | 1 por jogo por bolão | opt-in explícito do dono |
| 10 | **"📊 Seus últimos 7 dias"** (resumo semanal · item 04) | Cron semanal | **Segunda 9h30 BRT** (antes do daily das 10h — narrativa passado→futuro), 1x/semana — e SÓ pra quem teve **≥2 apostas liquidadas** nos últimos 7 dias (rolling). Sem apostas = sem mensagem. Faixa por resultado (positiva/neutra/negativa); lidera por resultado+ROI, SEM taxa de acerto | 1×/semana por usuário (idempotência `weekly_summary_sent_at`, gap ~6d) | Botão "Silenciar resumo" na própria DM · `/resumo` reativa |

## One-shot (disparo manual, 1x por usuário PRA SEMPRE)

| # | Mensagem | Quando dispara | Quem controla |
|---|---|---|---|
| 7 | **"📋 Atualizamos seu histórico — seu ROI real"** (winback R1) | Uma única vez, após o backfill do histórico (3 curls do runbook) | Dev, manualmente |
| 8 | **"🏆 A Copa acabou — e com ela o bolão!"** (handoff da final) | Dia 19/07, após a final encerrar (guarda técnica impede antes) | Dev, manualmente (2 curls) |

## Interno (não vai pra usuário)

| # | Mensagem | Gatilho |
|---|---|---|
| 9 | Alerta de coletor quebrado | 5 falhas consecutivas do ingest-fixtures → DM só pro admin |
| 11 | Alerta do ops-healthcheck | Cron diário 8h BRT: vault secret faltando em algum cron OU ≥3 falhas/5 execuções → DM só pro admin (`ops_config.admin_telegram_chat_id`). Sem problema = silêncio |

## O pior dia possível (teste de metralhadora)

Cenário extremo — dia da final, usuário com 3 apostas no jogo, no bolão e na lista do daily:

- 10h00 → oportunidades do dia (1 msg, se houver pick)
- ~19h20 (pós-apito) → até 3 liquidações/perguntas na primeira rodada do carteiro
- ~20h → handoff da final (1 msg, manual — o dev escolhe a hora)

**Total no pior caso: ~5 mensagens num dia de final de Copa** — todas com conteúdo
que o usuário quer receber (resultado das apostas dele + posição final dele). Em dia
normal: 0 a 2. O silêncio é parte do produto.

## Voz do Betinho (régua de escrita)

- **1:1 sobre UMA aposta do usuário** (liquidação, recibo, correção): **1ª pessoa** —
  "Fechei sua aposta", "eu fecho pra você". O Betinho é um assistente que age.
- **Relatório/análise** (daily, resumo semanal): **sóbrio-analítico**, sem 1ª pessoa —
  os números falam; nada de comemorar por ele nem lamentar por ele.
- Sempre: disciplina e controle (LC 224/2025), nunca "aposte mais"; emoji com
  parcimônia no corpo, **nunca em botão**; semana ruim = tom protetivo, sem cutucar métrica.

## Regras transversais

- `users.settlement_reminders_muted` (🔕/`/silenciar`) cala **tudo** que é recorrente
  de liquidação e o winback/handoff também respeitam. `/lembretes` reativa.
- `users.weekly_summary_muted` é opt-out **independente** do resumo semanal (#10) —
  cala só ele, não a liquidação. (Cadência semanal ≠ diária, não soma metralhadora.)
- Toda mensagem tem evento no PostHog (enviada + clicada/corrigida) — a "taxa de
  incômodo" (mute + correções) é métrica acompanhável.
- Novas mensagens DEVEM entrar neste mapa antes de ir pra develop.
