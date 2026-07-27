# Winback — fechar o histórico antigo e avisar quem sumiu (R1)

Fecha em lote as apostas **pendentes antigas** (7 dias a 1 ano) com dado verificável e
manda **uma única DM** de reconquista: *"atualizamos seu histórico — seu ROI real está pronto"*.

**Não tem cron.** A execução é manual e em 3 passos, com revisão humana entre eles.

## Pré-requisitos

- PR do lembrete de liquidação (#190/#191) **já em produção** — a DM aponta pro rail de
  botões e o público-alvo volta a receber lembretes normais dali em diante
- Function `winback-backfill` deployada (CI faz) e migration 079 aplicada (CI faz)
- Secrets da função (já existem no projeto): `CRON_SECRET`, `OPENAI_API_KEY`,
  `API_SPORTS_KEY`, `TELEGRAM_BOT_TOKEN`

## Os 3 comandos (rodar em ordem, revisando entre cada um)

```bash
URL="https://<projeto>.supabase.co/functions/v1/winback-backfill"
SECRET="<CRON_SECRET do painel>"

# 1) RELATÓRIO — não escreve nada. Salve e revise.
curl -s -X POST "$URL?mode=report" -H "x-cron-secret: $SECRET" > winback-report.json
# revisar: totals (liquidaveis/greens/reds/pulados), amostrar "liquidaveis" e
# conferir a evidência de cada veredito; olhar os skip_reason dos "pulados"

# 2) EXECUTA — liquida as aprovadas, gravando evidência em processed_data.winback
curl -s -X POST "$URL?mode=execute" -H "x-cron-secret: $SECRET"
# idempotente: só toca aposta ainda 'pending'; rodar 2x não duplica

# 3) AVISA — 1 DM por usuário afetado com Telegram (idempotente via winback_notifications)
curl -s -X POST "$URL?mode=notify" -H "x-cron-secret: $SECRET"
```

## O que o motor fecha (e o que ele se recusa a fechar)

| Fatia | Como decide |
| --- | --- |
| NBA singles (props) | GPT-4o estrutura a descrição (apelidos/typos → jogador canônico + stat + linha); código cruza com `nba_mart.ft_game_player_stats` (via RPCs da 079) e compara. |
| Futebol singles (ML, over/under gols, ambas marcam) | GPT-4o estrutura times+mercado; código busca o jogo histórico na API-Sports (`fixtures?date=` — 1 chamada por DATA, cacheada) e liquida pelo **placar dos 90'**. |
| Múltiplas, combos, handicap, escanteios, 1º tempo, props de quarto, "fg", push na linha exata, jogador que não jogou (DNP), jogo ambíguo/não achado | **skip** com motivo no relatório — ficam pendentes pro usuário resolver por botão/site. |

Custo: 1 chamada GPT-4o (lote inteiro, centavos) + ~40–80 chamadas API-Sports one-shot.

## Verificação pós-execução

```sql
-- o que o winback fechou (com evidência)
select id, bet_description, status, processed_data->'winback'->>'evidence' as evidencia
from bets where processed_data ? 'winback' order by updated_at desc;

-- quem foi avisado
select * from winback_notifications order by sent_at desc;
```

## Métricas (PostHog)

- `winback_backfill_executed` — totais do lote
- `winback_dm_sent` — por usuário {bets_settled, greens, roi, leftovers}
- Retorno = usuários com evento no site/bot nos 7 dias após `winback_dm_sent`
