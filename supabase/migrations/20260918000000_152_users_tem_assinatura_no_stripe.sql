-- 20260918000000_152_users_tem_assinatura_no_stripe
--
-- O CRM passa a conseguir distinguir quem paga no gateway de quem recebeu
-- acesso na mão — sem que o identificador do Stripe saia do banco.
--
-- ## O problema
--
-- As colunas `*_subscription_status` são escritas por TRÊS caminhos que hoje
-- deixam a mesma marca:
--
--   1. o webhook do Stripe, quando alguém assina;
--   2. `crm_dar_assinatura_manual`, quando um sócio concede um plano;
--   3. `crm_definir_acesso`, quando um sócio liga um produto avulso.
--
-- Os três gravam `premium`. Então "tem premium" não diz NADA sobre origem, e a
-- tela de assinaturas não tinha como mostrar quem paga no cartão.
--
-- A inferência óbvia — "tem premium e não tem linha em `crm_assinatura_manual`,
-- logo é Stripe" — está errada, e erra num caso real e comum: quem ganhou
-- acesso avulso na mão cairia na conta do gateway, e o CRM passaria a dizer que
-- um acesso dado na mão é um cliente pagante.
--
-- ## Por que uma coluna calculada, e não o identificador
--
-- `stripe_subscription_id` responderia a pergunta com exatidão. Mas o
-- `use-cadastros` proíbe, por escrito, trazer identificador do Stripe para o
-- navegador, e a razão continua válida: a lista é escrita à mão justamente para
-- coluna sensível não entrar na tela sem ninguém decidir.
--
-- Esta coluna responde SIM ou NÃO e não carrega o segredo. É `generated always
-- ... stored`, então ela não pode divergir do campo que a origina: não há
-- gatilho para falhar, não há rotina para esquecer de rodar, e ninguém consegue
-- gravar nela um valor que contradiga a realidade.
--
-- ⚠️ NÃO é portão de acesso. Quem decide quem entra continuam sendo as colunas
-- por produto. Esta existe para a tela do CRM saber de onde veio o dinheiro.

alter table public.users
  add column if not exists tem_assinatura_no_stripe boolean
  generated always as (stripe_subscription_id is not null) stored;

comment on column public.users.tem_assinatura_no_stripe is
  'Responde SIM ou NAO para "essa pessoa tem assinatura no gateway", sem expor o identificador. Calculada pelo banco a partir de stripe_subscription_id, entao nao pode divergir dele. NAO e portao de acesso: quem decide acesso sao as colunas por produto.';
