# Onboarding Betinho — Redesign

> **Status:** spec aprovada para implementação · **Data:** 2026-07-08
> **Decisões travadas com o founder em 2026-07-08** (ver §2). Benchmark e diagnóstico em §1.
> **Documentos-irmãos:** `docs/plano-metricas-retencao.md` (métricas/ativação) · `smart-betting-retencao.html` (roadmap).

---

## 1. Por que mexer (diagnóstico + benchmark)

**O funil está estrangulado antes do bot.** Dados: 603 contas → 119 no Telegram (**20% — no piso do benchmark consumer, 20–30%**) → ativação (1ª aposta liquidada ≤7d) ~**17%**. Best-in-class entrega o primeiro valor em **3–5 passos e <5 min**; nosso fluxo atual tem **~10 passos** (cadastro 4 campos → tela de escolha → redigitar telefone → 4 instruções manuais → 3 toques no Telegram → 1ª aposta).

**Problemas estruturais do fluxo atual (verificados no código):**
1. **Onboarding órfão** — o redirect pós-cadastro tem fallback `/bolao` (`Auth.tsx getRedirectTarget`); ninguém é levado ao `/onboarding` naturalmente. Pós-19/jul o fallback aponta pra um produto encerrado.
2. **Passo-a-passo sem valor** — a tela não explica o que é o Betinho nem por que conectar. Zero benefício comunicado.
3. **Vínculo por matching de telefone** — usuário redigita o número (que o cadastro JÁ coleta) e o webhook casa com o contato compartilhado no Telegram. Se o número do Telegram ≠ número digitado → "Não encontrei sua conta" → beco sem saída.
4. **"Finalizar" cego** — navega pra `/bets` sem verificar o vínculo; quem não conectou cai numa tabela vazia.
5. **Zero eventos de analytics** no fluxo (o topo do funil de ativação é invisível no PostHog).
6. **3 estéticas** no mesmo fluxo (terminal escuro + shadcn claro + nav do rebrand).

**Referências:** ativação consumer 20–30% típica; >98% dos usuários que não atingem marco de valor em 2 semanas churnam; cada campo extra de formulário ≈ −7% conversão; deep-linking com token é o padrão oficial do Telegram para account linking (core.telegram.org/api/links); Pikkit (líder em bet tracking) estrutura onboarding como login → sync → dashboard pronto — o sync é o aha deles, o nosso é **bot conectado + 1ª aposta**.

## 2. Decisões travadas (2026-07-08)

| # | Decisão |
|---|---|
| D1 | **Rota pós-cadastro → onboarding do Betinho** (fallback do `getRedirectTarget` muda de `/bolao` para `/onboarding`; `state.from` explícito continua vencendo — fluxos vindos de LP específica não quebram). |
| D2 | **Telefone continua no cadastro** (ativo de CRM: ativação ativa + coleta de feedback), **mas sai do caminho de vínculo** — o passo "confirme seu número" morre. Vínculo passa a ser por **deep-link com token**. |
| D3 | **Tela de escolha ("O que você quer fazer primeiro?") sai do onboarding.** A navegação (AnalyticsNav com dropdowns por produto) já cumpre o papel de atalho. |
| D4 | **Funil novo nasce instrumentado** (eventos §6). |

**Reposicionamento (narrativa das telas):** Betinho = (a) **gestão de apostas** — ROI real, liquidação, banca; (b) **canal de relacionamento** — oportunidades do dia (08′), notícias e avisos direto no Telegram. Não é "um bot de registrar aposta"; é onde o produto conversa com o usuário.

## 3. O fluxo novo — 3 momentos

```
cadastro (mantém 4 campos, telefone incluso)
   └→ /onboarding  [Momento 1 — VALOR]
        1 tela, Direção A: "Conheça o Betinho" com os 3 benefícios
        CTA único: [Conectar meu Telegram]
             └→ [Momento 2 — CONEXÃO, 1 clique]
                  abre t.me/<bot>?start=link_<token>
                  usuário toca START → webhook vincula por chat_id
                  tela web em polling → vira "✓ Conectado!" sozinha
                  fallback: "Não uso Telegram → registrar pela web" (vai pra /bets, sem beco)
                       └→ [Momento 3 — PRIMEIRA VITÓRIA, no bot]
                            welcome curto + pedido explícito da 1ª aposta
                            com exemplo copiável; lembrete de liquidação
                            (PR #191) fecha o loop depois
```

**Meta:** cadastro → 1ª aposta em **<5 min**, em **≤5 passos**.

### Momento 1 — tela de valor (rebrand Direção A, `theme-bolao`)
- Título: **"Conheça o Betinho"** + subtítulo de posicionamento.
- 3 cards de benefício: 📸 *Registre por print, texto ou áudio* · 📊 *Seu ROI real, liquidação e banca na palma* · 📬 *Oportunidades do dia e avisos direto no seu Telegram*.
- CTA primário: **Conectar meu Telegram**. Secundário (discreto): *Prefiro registrar pela web*.

### Momento 2 — conexão por deep-link
- Ao clicar, o front obtém o token (RPC, §4), monta `https://t.me/<bot>?start=link_<token>` e abre.
- A tela entra em estado "aguardando conexão" com polling (a cada ~3s, timeout ~60s) do estado de vínculo; ao confirmar: **"✓ Conectado!"** + botão *Ver minhas apostas*.
- Timeout → mantém o link + instrução curta + fallback web. **Nunca** um botão "Finalizar" que não verifica nada.
- O fluxo antigo por compartilhamento de contato **permanece como fallback** no webhook (zero regressão pra quem chega no bot sem token).

### Momento 3 — primeira vitória (bot)
- `sendWelcomeMessageTelegram` quebra em **2 mensagens**: (1) boas-vindas + o que o Betinho faz por ele (3 linhas); (2) **"manda sua 1ª aposta agora"** com exemplo copiável (`Flamengo x Palmeiras - Flamengo vence - Odd 1.85 - R$ 50`) e a dica do print.

## 4. Mecânica do token (design técnico)

- **Armazenamento:** tabela `telegram_link_tokens` (`token uuid pk default gen_random_uuid()`, `user_id uuid fk`, `created_at`, `expires_at default now()+interval '24 hours'`, `used_at`). Token de **uso único** com expiry — não usar o `user_id` cru no link (link vazado não pode vincular a conta de terceiro pra sempre).
- **Emissão:** RPC `get_telegram_link_token()` (security definer, auth required) — invalida tokens anteriores do usuário e emite novo. Payload do `/start` aceita ≤64 chars base64url → uuid (36) cabe com o prefixo `link_`.
- **Webhook (`telegram-webhook`):** novo ramo no handler de `/start` (o parsing de parâmetro já existe — `force_contact`): `link_<token>` → busca token válido/não usado → seta `telegram_chat_id`, `telegram_user_id`, `telegram_synced_at`, `telegram_sync_source:'deep_link'`, marca `used_at` → `sendWelcomeMessageTelegram` → `trackEvent('telegram_sync_success', {sync_source:'deep_link'})`. Token inválido/expirado → mensagem gentil + fallback pro fluxo de contato.
- **Polling do front:** select do próprio usuário (`telegram_synced_at is not null`) ou RPC booleana `is_telegram_synced()`.
- ⚠️ **Coordenação:** este arquivo (`telegram-webhook`) também recebe mudanças da frente de auto-liquidação em sessão paralela — sincronizar antes de mergear.

## 5. O que acontece com o código atual

| Peça atual | Destino |
|---|---|
| Step 0 (tela de escolha) | **Removido** do onboarding (D3). Navegação já cobre o atalho. |
| Step 1 (redigitar telefone) | **Morto** (D2). Telefone segue sendo coletado no cadastro. |
| Step 2 (instruções + Finalizar) | Substituído pelo Momento 2 (deep-link + polling). |
| `getRedirectTarget` fallback `/bolao` | → `/onboarding` (D1). |
| Fluxo de contato no webhook | Mantido como **fallback** (quem manda /start sem token). |
| Features preview (3 cards genéricos) | Substituído pelos 3 benefícios reais do Momento 1. |
| `?product=betinho` | Deixa de ser necessário (fluxo único), manter redirect por compat. |

## 6. Instrumentação (nasce com o fluxo — D4)

Convenções do `plano-metricas-retencao.md` §7 (`product`, snake_case, particípio):

| Evento | Props | Dispara |
|---|---|---|
| `betinho_onboarding_viewed` | `product:'betinho'`, `source` (signup/nav/lp) | Momento 1 no mount (logado) |
| `betinho_onboarding_link_clicked` | `product:'betinho'` | clique no CTA de conectar |
| `betinho_onboarding_synced` | `product:'betinho'`, `elapsed_s` | front detecta vínculo no polling |
| `betinho_onboarding_web_fallback` | `product:'betinho'` | clique em "registrar pela web" |
| `telegram_sync_success` (server, já existe) | + `sync_source:'deep_link'\|'contact_share'` | webhook |

**Funil no PostHog:** `signed_up → betinho_onboarding_viewed → link_clicked → synced → bet_created`. **Métricas-alvo:** conta→bot **20% → ≥50%**; TTV da 1ª aposta **<5 min**; ativação (1ª liquidada ≤7d) 17% → subir com o loop completo.

## 7. Plano de implementação (branch `feat/onboarding-betinho`)

1. **Migration + RPCs** — `telegram_link_tokens`, `get_telegram_link_token()`, `is_telegram_synced()`.
2. **Webhook** — ramo `link_<token>` no `/start` (+ `sync_source` no evento). *Coordenar com a sessão de auto-liquidação.*
3. **Front** — `Onboarding.tsx` reescrito (Momentos 1–2, Direção A, polling) + eventos + `getRedirectTarget` fallback.
4. **Bot** — welcome em 2 mensagens com exemplo copiável.
5. **Verificação live** — cadastro de teste → conectar → 1ª aposta, conferindo o funil no PostHog Live Events.

**Fora de escopo:** mudanças no formulário de cadastro (telefone fica); WhatsApp (descontinuado); tela de escolha NBA (morre com D3); qualquer coisa do futebol (PR #180).
