-- ============================================================================
-- 151 — quem bloqueou o bot para de ser tentado
-- ============================================================================
-- Quando alguém bloqueia o bot no Telegram, a API passa a responder 403
-- ("Forbidden: bot was blocked by the user") naquele chat, para sempre. O
-- `telegram_chat_id` da pessoa continua no banco, intacto, então para o produto
-- ela segue alcançável — e todas as mensagens continuam tentando: o daily todo
-- dia, o resumo toda segunda, a liquidação de 15 em 15 minutos enquanto houver
-- aposta aberta.
--
-- Nada quebra, e é por isso que ninguém tinha percebido. O estrago é na
-- MEDIÇÃO: cada tentativa conta como "enviada" no funil, e essa pessoa nunca
-- vai clicar porque nunca recebeu. A taxa de clique de TODAS as mensagens está
-- diluída por gente que não pode receber, e a diluição cresce com o tempo.
--
-- Achado em 17/09/2026, no primeiro envio real da oferta pós-teste (#466).
--
-- ⚠️ POR QUE UMA MARCA, E NÃO APAGAR O CHAT ID.
-- Apagar faria toda consulta existente pular a pessoa sem tocar em nenhuma
-- delas, o que é tentador. Mas o webhook encontra o usuário PELO chat id da
-- mensagem que chega: sem ele, quem desbloqueasse voltaria como desconhecido, e
-- o caminho de volta morreria justamente na hora de usar. A marca preserva a
-- identidade e é reversível.
-- ============================================================================

alter table public.users
  add column if not exists telegram_bloqueado_em timestamptz;

comment on column public.users.telegram_bloqueado_em is
  'Quando o Telegram respondeu 403 para esta pessoa (ela bloqueou o bot). Null = alcançável. Escrita por quem toma o 403; limpa sozinha quando ela volta a falar com o bot, porque falar prova que desbloqueou.';

-- Índice parcial: a consulta da rodada pergunta "quem ESTÁ marcado" (`is not
-- null`), para montar o conjunto que o envio pula. O parcial indexa só essas
-- linhas — que são minoria — e por isso não pesa na escrita das outras colunas
-- de `users`, que é o que um índice cheio faria.
create index if not exists users_telegram_bloqueado_idx
  on public.users (id)
  where telegram_bloqueado_em is not null;
