-- ============================================================================
-- 154 — o índice da sessão do bolão perde o predicado, e o upsert volta a gravar
-- ============================================================================
-- Issue #473.
--
-- A 042 criou o índice que garante uma linha por sessão do Stripe, e criou-o
-- PARCIAL:
--
--   create unique index bolao_subscriptions_stripe_session_id_unique
--     on public.bolao_subscriptions (stripe_session_id)
--     where stripe_session_id is not null;
--
-- O predicado não era necessário: no Postgres, NULL é distinto de NULL num
-- índice único, então um índice comum já permite quantas linhas sem sessão
-- existirem. E cobrava caro: o Postgres só aceita um índice parcial como
-- árbitro de `on conflict` se a cláusula repetir o predicado, e o PostgREST não
-- tem como mandá-lo.
--
-- O QUE ISSO CAUSAVA. O webhook grava a compra com
-- `.upsert({...}, { onConflict: 'stripe_session_id' })`. Sem árbitro válido, a
-- gravação falha com 42P10, o erro cai num `console.error`, o `break` segue e o
-- webhook responde 200 — o Stripe considera entregue. Ou seja: a compra podia
-- não ser registrada, em silêncio, e a idempotência que a 042 prometeu nunca
-- existiu de fato.
--
-- É o mesmo defeito que a 151 evitou no `idx_crm_pagamento_fatura_unica`, onde
-- o motivo já está escrito. Aqui ele é anterior, e independente daquela obra.
--
-- ⚠️ TROCA SEM JANELA DESCOBERTA. O índice novo é criado ANTES de o antigo
-- sair, então em nenhum instante a tabela fica sem a garantia de unicidade —
-- que é a única coisa que impede duas entregas da mesma sessão virarem duas
-- linhas. A criação falharia se houvesse duplicata, e não há: o índice parcial
-- já as impedia desde a 042.
-- ============================================================================

create unique index if not exists bolao_subscriptions_sessao_unica
  on public.bolao_subscriptions (stripe_session_id);

comment on index public.bolao_subscriptions_sessao_unica is
  'Uma linha por sessão do Stripe. SEM predicado de propósito: índice parcial não serve de árbitro de on conflict via PostgREST, e NULL já é distinto de NULL num índice único (issue #473).';

drop index if exists public.bolao_subscriptions_stripe_session_id_unique;
