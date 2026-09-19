# Catálogo de eventos — jornada do Futebol e campanhas do Telegram

O que cada evento significa, quando dispara e o que ele carrega. Este arquivo é
a fonte para montar funil no PostHog; o código que o implementa vive em
`src/lib/analytics/` (site) e `supabase/functions/shared/atribuicao.ts` (bot).

Convenções que valem para tudo:

- **`distinct_id` é sempre o `auth.users.id` do Supabase.** É o mesmo número nas
  três pontas: `public.users.id` É o id do auth (a RLS da tabela é
  `auth.uid() = id`), e o backend já usava `user_id` como `distinctId`. Não use
  e-mail, telefone, `chat_id` nem `telegram_user_id` como identidade.
- **Sem dado pessoal nas propriedades.** O `distinct_id` já identifica. A lista
  de chaves proibidas está em `CHAVES_PESSOAIS` e é verificada em teste.
- **Nome de evento com histórico não se renomeia.** Os `opportunity_*` não
  seguem o prefixo por produto da §7 do `plano-metricas-retencao.md`, e isso é
  deliberado: `opportunity_bet_registered` já nasceu assim no bot, e manter a
  família junta vale mais que a convenção.

## Identidade da oportunidade

**Não existe um `opportunity_id` de coluna única no domínio.** A identidade é
composta e vem de `opportunityKey` (`src/utils/futebol-history.ts`):

```
<fixture_id>|<market>|<outcome>|<line_value>
```

O `dest` que o bot põe no link é `jogo-<fixture>|<market>|<outcome>|<linha>` — a
mesma composição com um prefixo. Por isso site e Telegram casam sem tradutor.

Três traduções de nome acontecem na borda, e estão travadas por teste:

| Propriedade do evento | Campo do domínio | Por quê |
|---|---|---|
| `game_id` | `fixture_id` | Só existe UM identificador de jogo. Não mandamos os dois. |
| `selection` | `outcome` | `outcome` é o nome do lado da saída no domínio. |
| `confidence_band` | `faixa` | Alta / Média / Baixa. |
| `competition` | `competition` | **Não existe `league_id`.** Liga é string (`type Competition = string`). |

## Propriedades comuns da oportunidade

Todo evento `opportunity_*` carrega este bloco, montado por
`propsDaOportunidade`:

`opportunity_id` · `game_id` · `market` · `selection` · `confidence_band` ·
`score` · `competition` · `source` · `subscription_status` · `position` (quando
há lista)

Valores controlados (fora da lista vira `other`, nunca um valor solto):

- **`source`**: `home_featured` · `home_games` · `games_list` · `opportunities` ·
  `telegram` · `direct` · `other`
- **`open_mode`**: `card` · `modal` · `game_detail` · `other`
- **`action`**: `register_bet` · `open_bookmaker` · `open_game` · `subscribe` ·
  `other`
- **`campaign_type`**: `daily_opportunities` · `published_opportunities` ·
  `weekly_summary` · `other`
- **`subscription_status`**: `anon` · `trial` · `expired` · `subscribed` ·
  `unknown`

## A tabela

| Evento | Momento do disparo | Propriedades obrigatórias | Plataforma |
|---|---|---|---|
| `$pageview` | Mudança real de rota (`pathname` + `search`). Não conta remontagem no mesmo endereço. | `path`, `$current_url` | Site |
| `futebol_game_clicked` | No clique que inicia a navegação para o detalhe de um jogo, antes de navegar. | `game_id`, `source`, `is_featured`, `destination_path` | Site |
| `opportunity_impression` | Cartão com **metade visível por ~1s**. No máximo uma vez por `opportunity_id` a cada carregamento da página. | comuns | Site |
| `opportunity_opened` | A pessoa abre/seleciona a oportunidade. | comuns + `open_mode` | Site |
| `opportunity_reason_expanded` | A pessoa **abre** uma premissa no jogo a jogo (só na abertura, não ao fechar). | comuns + `reason_type`, `reason_count`, `premissa` | Site |
| `opportunity_analysis_opened` | Clique num dos caminhos para a análise completa. | comuns + `analysis_type`, `destination_path` | Site |
| `opportunity_cta_clicked` | Ação principal da oportunidade (hoje: abrir o modal de registro). | comuns + `action` | Site |
| `opportunity_bet_registered` | Aposta gravada **com sucesso** no banco. | comuns + `via`, `channel` | Site **e** bot |
| `telegram_opportunity_landing_opened` | O site abriu por um link de oportunidade do Telegram. Uma vez por abertura, sobrevivendo ao login. | `delivery_id`, `batch_id`, `link_id`, `campaign_type`, `landing_path`, `is_authenticated` | Site |
| `daily_opportunities_sent` | Telegram **aceitou** a mensagem do diário e o estado foi gravado. | `delivery_id`, `batch_id`, `campaign_type`, `segment`, `picks_count`, `top_score`, `sent_status` | Bot |
| `published_opportunities_sent` | Idem, para o alerta de publicação. | `delivery_id`, `batch_id`, `campaign_type`, `picks_count`, `top_score`, `sent_status` | Bot |
| `daily_opportunities_click` | Clique no link, registrado pelo redirecionador `go` (assinatura válida). | `delivery_id`, `batch_id`, `link_id`, `campaign_type`, `destination` | Bot |
| `published_opportunities_click` | Idem, campanha de publicação. | mesmas | Bot |

### `sent_status` não é "lido"

`sent_status = success` significa **o Telegram aceitou o envio** — nada mais. A
API não dá confirmação de leitura nem de recebimento, e nomear o campo assim
convidaria a ler o número como audiência.

## As jornadas

```
Home do Futebol → jogo → detalhe
  futebol_game_clicked (source=home_featured | home_games)
    → $pageview (/futebol/jogo/:id)

Oportunidades → abriu → expandiu motivos → abriu análise → CTA → aposta
  opportunity_impression
    → opportunity_opened
      → opportunity_reason_expanded
        → opportunity_analysis_opened
          → opportunity_cta_clicked (action=register_bet)
            → opportunity_bet_registered (channel=web)

Telegram enviado → link clicado → site aberto → oportunidade/jogo → ação
  daily|published_opportunities_sent   (delivery_id nasce aqui)
    → daily|published_opportunities_click   (mesmo delivery_id)
      → telegram_opportunity_landing_opened (mesmo delivery_id)
        → opportunity_opened / futebol_game_clicked
          → opportunity_bet_registered
```

## A corrente da atribuição

`delivery_id` é a **chave canônica**: uma entrega, para uma pessoa, numa
campanha. Ele liga os três eventos do bot.

Antes disto o funil se partia no meio: o `trace_id` do envio nascia **uma vez
por rodada do cron** (o mesmo para centenas de pessoas) e o `go` gerava um
`trace_id` **novo** no clique. Os dois nunca coincidiam — casá-los no PostHog só
dava por `distinct_id` mais horário, que é adivinhação.

As três chaves são **determinísticas**, derivadas por digest de dados estáveis
(`supabase/functions/shared/atribuicao.ts`):

| Chave | Derivada de | Por que determinística |
|---|---|---|
| `batch_id` | campanha + lote | O lote é o `batch_id` da tabela de entregas (publicação) ou o **dia BRT** (diário). |
| `delivery_id` | campanha + lote + `user_id` | `deliverPending` **retoma** entregas de rodadas anteriores. Com id aleatório, a mesma tentativa lógica viraria duas entregas e toda taxa de clique cairia pela metade. |
| `link_id` | `delivery_id` + destino | Uma mensagem leva vários links. Sem isto, "qual pick funcionou" fica sem resposta. |

### O que viaja no link

O link da mensagem aponta para o `go` com `dl`, `bt` e `lk` (nomes curtos porque
vão numa URL). O `go` valida a assinatura, registra o clique e redireciona para
o site com o contrato completo:

`utm_source=telegram` · `utm_medium=bot` · `utm_campaign` · `utm_content` ·
`delivery_id` · `batch_id` · `link_id` · `campaign_id` · `campaign_type` ·
`segment` · `sent_at` · `opportunity_id`

**A assinatura HMAC não mudou**: continua sendo sobre `<user>:<dest>`. Isso é
deliberado — link já entregue no celular de alguém não se atualiza, e assinar
campo novo invalidaria todas as mensagens antigas de uma vez. Os parâmetros de
atribuição são de **medição**, não de autorização: forjá-los suja um relatório,
não dá acesso a nada.

### A atribuição atravessa o login

Quem chega deslogado numa rota protegida vai para `/auth`, sai para o Google e
volta em `/auth/callback` — e a query original não sobrevive. A atribuição é
guardada em `sessionStorage` com **validade de 2 horas** e uma marca de
"chegada já reportada", que é o que impede as três rotas de contarem três
chegadas. Atribuição vencida é apagada na leitura: creditar ao Telegram uma
visita de ontem é pior que não creditar nada.

## Limitações conhecidas

- **`opportunity_impression` só existe onde há lista**: a home (`/futebol`) e a
  tela de Oportunidades. O destaque da home não emite impressão própria.
- **`opportunity_reason_expanded` e `opportunity_analysis_opened` não existem na
  tela de Oportunidades**, porque lá não há "expandir motivos" nem "ver análise
  completa" — esses comportamentos vivem na agenda (`/futebol/jogos`) e na tela
  do jogo. Nenhuma UI foi criada para preencher a lacuna.
- **Os motivos do destaque da home já nascem abertos**, sem alternador. Não há
  expansão a medir ali.
- **`bookmaker` não é emitido**: as telas não mostram casa de aposta (decisão de
  produto de 08/07), então não há valor honesto para o campo.
- **`signed_in` / `signed_up` continuam mandando `email`** na propriedade, como
  sempre mandaram. Não foram tocados para não quebrar painel existente — a
  decisão de limpar é de produto, não desta camada.
- **O `opportunity_bet_registered` do BOT não carrega `opportunity_id`.** Ele
  ganhou `game_id`, `market` e `competition`, mas não a chave canônica — e isso
  é limitação do domínio, não esquecimento. A chave é
  `fixture|mercado|saída|linha`, e a tabela `daily_opportunity_picks`
  (migration 085) guarda `betting_market` como texto e a saída dentro de
  `bet_description`, em texto livre: não há `outcome` nem `line_value`
  estruturados de onde montá-la. Fechar essa lacuna exige **migration** para
  estruturar saída e linha na tabela — trabalho de modelagem, não de
  instrumentação. Até lá, o funil "aposta registrada" costura por `game_id` no
  bot e por `opportunity_id` na web.
- **`campaign_id` é o slug da campanha, igual ao `campaign_type`.** O domínio
  não tem instância de campanha: não existe tabela de campanhas com id próprio.
  Quem identifica a rodada específica é o `batch_id`. O campo existe porque a
  spec o pede, e fica documentado assim para ninguém procurar um id que não há.
