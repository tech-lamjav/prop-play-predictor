# Alerta de oportunidade publicada — o segredo que faltava

## O que estava quebrado

A função `notify-published-opportunities` é a que promete, no onboarding, "o
Betinho te avisa quando uma oportunidade nova entrar no painel, antes do jogo
começar". Ela **nunca enviou uma única mensagem**.

Diagnóstico de 03/09/2026, medido nos dois ambientes:

- o cron roda de 10 em 10 minutos e **falhou em todas as execuções** — 183 em
  produção e 184 em staging, nos três dias anteriores;
- o erro é sempre o mesmo:
  `null value in column "url" of relation "http_request_queue" violates not-null constraint`;
- a causa é um segredo ausente no vault: **`notify_published_opportunities_url`**.
  Todos os outros jobs têm o par `<job>_url` + `<job>_cron_secret`; esse tinha só
  o cron secret (e reusa o `notify_opportunities_cron_secret`, que é o mesmo
  `CRON_SECRET` do ambiente, então isso está certo);
- as tabelas confirmam que a função nunca rodou: zero linhas em
  `futebol_publication_alerts`, `futebol_publication_alert_batches`,
  `futebol_publication_alert_deliveries` e `futebol_publication_alert_runtime`.

A edge function em si está publicada e ativa nos dois ambientes, e o código está
correto. Faltava só o endereço para o cron chamar.

## O segundo defeito, que estava escondido atrás do primeiro

Criado o segredo em staging, o cron passou a chamar a função — e ela passou a
falhar sozinha, com `column reference "opportunity_key" is ambiguous`. Ou seja,
a RPC `claim_futebol_publication_alert_batch` também nunca tinha executado com
sucesso: o segredo ausente escondia isso.

A causa é a colisão entre o parâmetro de SAÍDA `opportunity_key`, declarado no
`RETURNS TABLE`, e a coluna de mesmo nome. Dentro do corpo plpgsql o nome sem
qualificação fica ambíguo em dois lugares: o alvo do `ON CONFLICT`, que não
aceita alias, e o `RETURNING`.

Corrigido pela **migration 118**, com `#variable_conflict use_column`. Preferido
a renomear as saídas porque o contrato da RPC não muda — a edge function segue
lendo `batch_id`, `alert_id` e `opportunity_key` do JSON.

Aplicada em staging em 04/09. **Falta aplicar em produção**, junto com o segredo.

## A correção do segredo

Um `INSERT` no vault, por ambiente. **Não há migration**: o vault não é
versionado no repositório, e o segredo é diferente em cada projeto.

### Staging (`kpbjuplcwiyrymafhehz`) — feito em 03/09/2026

```sql
select vault.create_secret(
  'https://kpbjuplcwiyrymafhehz.supabase.co/functions/v1/notify-published-opportunities',
  'notify_published_opportunities_url',
  'URL da edge function do alerta de oportunidade publicada'
);
```

### Produção (`lavclmlvvfzkblrstojd`) — pendente

```sql
select vault.create_secret(
  'https://lavclmlvvfzkblrstojd.supabase.co/functions/v1/notify-published-opportunities',
  'notify_published_opportunities_url',
  'URL da edge function do alerta de oportunidade publicada'
);
```

Rodar no SQL editor do projeto certo. O `create_secret` devolve o uuid do
segredo; se ele já existir, o comando falha por nome duplicado — nesse caso o
segredo já está lá e não há nada a fazer.

## O que acontece depois

O cron pega o segredo na execução seguinte, no máximo 10 minutos depois. A
sequência é:

1. **Primeira execução — marco inicial, sem envio.** Sem linha em
   `futebol_publication_alert_runtime`, a função grava o board inteiro como "já
   avisado", cria a linha de runtime e retorna `baseline: true, sent: 0`. É essa
   guarda que impede o primeiro disparo de mandar as ~900 linhas do board de uma
   vez.
2. **Da segunda em diante**, só oportunidade que o board não tinha antes vira
   mensagem.

## Quem recebe

A RPC `get_futebol_publication_alert_recipients` já implementa o modelo de
remuneração, e foi conferida em 03/09:

```sql
telegram_chat_id IS NOT NULL
AND coalesce(futebol_publication_alerts_enabled, true) = true
AND (
  coalesce(futebol_subscription_status, 'free') = 'premium'
  OR (futebol_trial_started_at IS NOT NULL
      AND futebol_trial_started_at + interval '7 days' > now())
)
```

Ou seja: assinante recebe sempre; quem está no teste grátis recebe durante os 7
dias e **para sozinho** quando o prazo vence; volta a receber se assinar. Não há
nada a fazer para "desligar" o trial expirado — a condição é avaliada a cada
execução.

Medido em 03/09: **3 destinatários em produção** (2 premium, 1 em trial vivo),
de 120 usuários com Telegram conectado, e **1 em staging** (a conta do próprio
time).

## Como conferir que funcionou

```sql
-- o cron parou de falhar
select j.jobname, d.status, count(*), max(d.end_time)
from cron.job_run_details d join cron.job j on j.jobid = d.jobid
where j.jobname = 'notify-published-opportunities'
group by 1, 2;

-- o marco inicial foi gravado
select * from public.futebol_publication_alert_runtime;

-- o que já foi alertado e entregue
select count(*), max(detected_at) from public.futebol_publication_alerts;
select status, count(*), max(sent_at) from public.futebol_publication_alert_deliveries group by 1;

-- o log das execuções (candidatos x enviados)
select fn, ran_at, candidates, sent, errors, ok
from public.message_runs where fn = 'notify-published-opportunities'
order by ran_at desc limit 10;
```

Para um ensaio sem enviar nada, a função aceita `?mode=report`: devolve as
oportunidades novas e a contagem de destinatários, sem gravar nem mandar
mensagem.

## Validação em staging (04/09/2026)

Com o segredo mais a migration 118, a primeira execução, às 02h10 UTC:

- cron `succeeded`, e `message_runs` com `ok = true`, **340 candidatos e 0 enviados**;
- `futebol_publication_alert_runtime` ganhou a linha de marco inicial;
- 340 linhas em `futebol_publication_alerts`, 1 lote, **0 entregas**.

É exatamente o comportamento desenhado: o board inteiro entra como "já avisado"
e ninguém recebe nada. Da execução seguinte em diante, só oportunidade nova vira
mensagem.
