-- 20260916140000_140_fecha_funcoes_sem_revoke
--
-- Fecha duas funções `SECURITY DEFINER` que qualquer pessoa logada consegue
-- chamar hoje. Issue #408.
--
-- ⚠️ Função nova em Postgres nasce EXECUTÁVEL POR PUBLIC, e PUBLIC inclui o
-- `anon`. As migrations do CRM tratam isso desde a 123 — todas fazem `revoke
-- execute ... from public` antes do `grant`. Estas duas não fazem nenhum dos
-- dois, e por isso estão abertas.
--
-- ## O que estava exposto
--
-- `get_weekly_recap_candidates()` (migration 086) devolve, POR USUÁRIO DE TODA
-- A BASE: nome, identificador de chat do Telegram, número de apostas
-- liquidadas, valor total apostado, lucro total, valor da unidade, melhor
-- mercado e o lucro nele.
--
-- `get_settlement_reminder_candidates()` (migration 078) é pior em natureza,
-- porque não devolve agregado: devolve APOSTA A APOSTA de todos os pendentes,
-- com descrição, odd, valor apostado, retorno potencial, liga e mercado. Ela
-- tem `grant ... to service_role`, mas grant sem revoke não fecha nada: o
-- acesso de PUBLIC continua de pé ao lado.
--
-- ## Por que isso contradizia o resto do repositório
--
-- A migration 124 diz, no cabeçalho, que dar ao sócio uma policy de select em
-- `bets` abriria a aposta linha a linha — e existe teste que reprova quem
-- tentar. Estas duas funções faziam pela porta de trás o que aquela decisão
-- fecha pela frente, e para a base inteira em vez de para um sócio.
--
-- ## Por que o revoke não quebra nada
--
-- As duas são chamadas só por edge function — `notify-weekly-summary` e
-- `notify-settlement` —, e edge function usa a chave de service role, que não
-- passa por estes grants.
--
-- Conferência depois de aplicar:
--   select p.proname, array_to_string(p.proacl, ' ')
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('get_weekly_recap_candidates',
--                        'get_settlement_reminder_candidates');
--   -- nenhum `=X/` (que é o PUBLIC) deve aparecer no resultado.

revoke execute on function public.get_weekly_recap_candidates() from public;
grant execute on function public.get_weekly_recap_candidates() to service_role;

revoke execute on function public.get_settlement_reminder_candidates() from public;
grant execute on function public.get_settlement_reminder_candidates() to service_role;

-- ── O que NÃO entra aqui, e por quê ─────────────────────────────────────────
-- `get_bet_tags(uuid)` (migration 016) também é `security definer`, tem `grant
-- to authenticated`, e aceita QUALQUER `bet_id` sem checar se quem pergunta é o
-- dono da aposta. Ou seja: qualquer usuário logado lê as tags de qualquer
-- aposta, e tag é anotação pessoal em texto livre.
--
-- Ela fica de fora desta migration porque o conserto não é um revoke: a função
-- é chamada pelo navegador do próprio usuário, em três telas, uma vez por
-- aposta. Tirar o grant de `authenticated` derrubaria as três. O conserto certo
-- é acrescentar o gate de dono dentro dela, e isso muda comportamento — merece
-- migration própria e um olhar em quem chama. Está anotado na #408.
