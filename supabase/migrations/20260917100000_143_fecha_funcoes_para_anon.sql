-- 20260917100000_143_fecha_funcoes_para_anon
--
-- A 140 fechou as duas funções da #408 para PUBLIC, e elas continuaram abertas.
--
-- Conferido em produção e em staging em 2026-09-15, DEPOIS de a 140 estar
-- aplicada nos dois: `has_function_privilege('anon', ..., 'execute')` devolve
-- TRUE nas duas funções, e o ACL mostra por quê:
--
--   {postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}
--
-- ⚠️ NO SUPABASE, `revoke ... from public` NÃO FECHA PARA `anon`.
-- O schema `public` tem privilégio padrão (`pg_default_acl`, dono `postgres`)
-- que dá EXECUTE explícito a `anon`, `authenticated` e `service_role` em TODA
-- função nova. O revoke de PUBLIC tira só o `=X` de PUBLIC; os três grants
-- explícitos continuam de pé ao lado, e `anon` é o papel da chave pública que
-- vai dentro do bundle do site.
--
-- Ou seja: o conserto da #408 subiu para produção e o vazamento continuou.
--
-- ## O que estava (e seguia) exposto
--
-- `get_weekly_recap_candidates()` (migration 086): por usuário de TODA A BASE —
-- nome, identificador de chat do Telegram, apostas liquidadas, valor apostado,
-- lucro total, valor da unidade, melhor mercado e o lucro nele.
--
-- `get_settlement_reminder_candidates()` (migration 078): aposta a aposta de
-- todos os pendentes, com descrição, odd, valor apostado e retorno potencial.
--
-- ## Por que fechar não quebra nada
--
-- Os dois únicos chamadores são edge functions que rodam com `service_role`:
-- `supabase/functions/notify-weekly-summary/index.ts` e
-- `supabase/functions/notify-settlement/index.ts`. Nenhuma tela chama. O grant
-- de `service_role` abaixo é redundante com o privilégio padrão, e está aqui
-- de propósito: torna explícito quem pode chamar, em vez de depender do padrão.
--
-- Conferência depois de aplicar (espera FALSE, FALSE, TRUE nas duas):
--   select p.proname,
--          has_function_privilege('anon', p.oid, 'execute') anon,
--          has_function_privilege('authenticated', p.oid, 'execute') autenticado,
--          has_function_privilege('service_role', p.oid, 'execute') servico
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('get_weekly_recap_candidates', 'get_settlement_reminder_candidates');

revoke execute on function public.get_weekly_recap_candidates() from public, anon, authenticated;
grant  execute on function public.get_weekly_recap_candidates() to service_role;

revoke execute on function public.get_settlement_reminder_candidates() from public, anon, authenticated;
grant  execute on function public.get_settlement_reminder_candidates() to service_role;
