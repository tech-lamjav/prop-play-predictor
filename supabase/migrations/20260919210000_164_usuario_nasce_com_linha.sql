-- ============================================================================
-- 164 — a conta nasce com linha em public.users
-- ============================================================================
-- O teste grátis dizia "Teste · 48h" no cabeçalho e mantinha a lista inteira
-- cadeada ao lado. Duas respostas do mesmo banco, discordando na mesma tela.
--
-- Não era cache. São duas funções lendo coisas diferentes:
--
--   · `get_futebol_access` (o chip) calcula o teste EM MEMÓRIA e tenta gravar
--     com um UPDATE em public.users;
--   · `futebol_acesso_do_chamador` (o cadeado) só LÊ o que está gravado lá.
--
-- Sem a linha, o UPDATE não casa nada. A função devolve um teste que nunca foi
-- persistido, e a guarda — lendo o banco — bloqueia. Para sempre: cada chamada
-- cunha 48 horas novas na memória e nenhuma no disco.
--
-- A própria 136 previu isto e deixou escrito que era "decisão à parte":
--
--   ⚠️ Sem `if not found`, de propósito: se a linha não existe, o UPDATE não
--   grava nada e a função devolve um teste que ela não persistiu [...]
--
-- Esta migration resolve a CAUSA, e não a consequência. Em vez de afrouxar a
-- guarda (que reabriria o "teste perpétuo" que a 136 temia), garante a linha.
--
-- ## Por que faltava
--
-- A linha era criada pelo NAVEGADOR, depois do cadastro, em dois lugares
-- diferentes: `Auth.tsx` no fluxo de e-mail e senha, `AuthCallback.tsx` no do
-- Google. O de e-mail depende de haver sessão na hora (`getUser()`), e quando o
-- cadastro exige confirmação de e-mail não há — o insert é simplesmente pulado.
-- Qualquer falha de rede ou de política no meio do caminho tem o mesmo efeito:
-- a conta existe e a linha não.
--
-- Medido no dev em 19/09/2026: 3 de 18 contas sem linha. Não é caso de borda.
--
-- ## O desenho
--
-- O gatilho é `security definer` porque roda no contexto do cadastro, antes de
-- existir sessão. Grava apenas `id` e `email` — o resto da tabela tem padrão —,
-- e o navegador continua escrevendo nome, WhatsApp e indicação por cima, agora
-- com `upsert` em vez de `insert`.
--
-- ⚠️ `on conflict do nothing`, e não `do update`: quem manda no conteúdo é o
-- cadastro, não o gatilho. Se a linha já existe, ele sai de fininho.
--
-- ⚠️ O `if new.email is not null` existe porque `public.users.email` é NOT NULL
-- e tem índice único. Conta sem e-mail não existe hoje (conferido: zero em
-- auth.users), mas um `coalesce` para string vazia criaria colisão na segunda.
-- Preferimos não criar a linha a criar uma que impede a próxima.
--
-- Conferência depois de aplicar:
--   select count(*) from auth.users a
--    where not exists (select 1 from public.users u where u.id = a.id);
--   -- espera-se zero.
-- ============================================================================

-- ⚠️ `search_path to 'public'`, e NÃO o `''` que o resto do repositório usa.
--
-- Não é descuido: com o vazio esta migration QUEBRA TODO CADASTRO. A
-- `public.users` já tem o gatilho `generate_user_referral_code`, que chama
-- `generate_referral_code()` SEM qualificar o schema. O `search_path` de uma
-- função vale para as chamadas aninhadas dentro dela, então o insert daqui
-- fazia aquele gatilho rodar com o caminho vazio e morrer em:
--
--   ERROR: function generate_referral_code() does not exist
--
-- Descoberto provando o gatilho num insert de mentira, antes de subir. Com
-- `'public'` o nome resolve, e é o mesmo que as funções da 136 já usam.
create or replace function public.criar_linha_do_usuario()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.email is not null then
    insert into public.users (id, email)
    values (new.id, new.email)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$function$;

comment on function public.criar_linha_do_usuario() is
  'Cria a linha em public.users quando a conta nasce. Sem ela, get_futebol_access devolve um teste que nao persiste e futebol_acesso_do_chamador bloqueia para sempre.';

-- ⚠️ Fechada no MESMO arquivo que a cria. Entre criar aberta e fechar depois
-- existe uma janela, e nas duas funções da #408 essa janela foi de meses.
--
-- E revogar só de PUBLIC NÃO BASTA no Supabase: o schema `public` tem
-- privilégio padrão que dá EXECUTE explícito a anon, authenticated e
-- service_role em toda função nova, e esses três grants sobrevivem ao revoke de
-- PUBLIC. Foi assim que a 140 "fechou" as duas da #408 e elas continuaram
-- abertas em produção — ver a 143.
--
-- Não há `grant` de volta, e é de propósito: esta é função de GATILHO. Quem a
-- executa é o Postgres ao inserir em auth.users, e essa chamada não passa por
-- verificação de privilégio. Ninguém precisa poder chamá-la à mão.
revoke execute on function public.criar_linha_do_usuario() from public, anon, authenticated;

drop trigger if exists criar_linha_do_usuario on auth.users;
create trigger criar_linha_do_usuario
  after insert on auth.users
  for each row execute function public.criar_linha_do_usuario();

-- ----------------------------------------------------------------------------
-- E as contas que JÁ existem sem linha
-- ----------------------------------------------------------------------------
-- O gatilho só vale daqui para a frente. Quem se cadastrou antes e caiu no
-- buraco continuaria com o chip prometendo um teste que o cadeado nega — e sem
-- jeito de sair disso sozinho, porque o UPDATE da 136 segue não casando nada.
--
-- Recupera só o que falta, pelo `not exists`. Não toca em linha existente.
insert into public.users (id, email)
select a.id, a.email
from auth.users a
where a.email is not null
  and not exists (select 1 from public.users u where u.id = a.id)
on conflict (id) do nothing;
