# Handoff — Back-end da Paywall Unificada (`/planos`)

> **Front pronto** na branch `feat/landing-futebol` (commits `a0dd489`, `7407b25`, `82d7c44`, `85e1aa7`).
> Este doc é pra quem vai plugar o back (entitlements + Stripe). Nada aqui está feito ainda.

## ⚠️ Caveat de merge — ler primeiro
`/planos` **ainda não fecha compra**. Os botões "Assinar" chamam `startCheckout()` em `src/pages/Planos.tsx`, que hoje é **placeholder** (manda pra `/auth` deslogado / `/inicio` logado). As paywalls antigas (`/paywall`, `/paywall-platform`) **ainda têm Stripe funcionando**.

**Não mergear/deployar esta branch pra PRODUÇÃO antes de plugar o checkout do `/planos`** — senão todo o funil de upgrade do app (que já aponta pra `/planos`) fica sem checkout. Em `develop`/staging, tudo bem.

## Modelo (decidido)
4 níveis por **amplitude** — não por esporte:

| | Grátis | Entrada | Essencial | Completo |
|---|---|---|---|---|
| Futebol | trial 7d | **não inclui** | completo | completo |
| NBA | 2 picks/dia (baseline) | 2 picks/dia (baseline) | 2 picks/dia (baseline) | completo (prop bets + Análise 360) |
| Betinho | 3 apostas/dia | ilimitado | ilimitado | ilimitado |

- **Betinho incluído em todo plano pago.** **NBA só no Completo**, sem avulso. **Bolão fora** (produto de evento, segue `boloes.is_premium` one-time).
- **Entrada = Betinho puro**, sem produto de análise. Atenção: ele **mantém o baseline de conta criada** (os 2 picks/dia da NBA), senão o cliente *perde* acesso ao assinar. A página diz isso numa nota embaixo da tabela.
- Preços (placeholders no código, confirmar): Entrada mensal **R$14,90** · anual **R$11,90/mês** (R$143/ano, −20%) — **fora da promo de lançamento**, sem de/por. Essencial mensal ~~R$49,90~~ **R$39,90** · anual **R$31,90/mês** (R$383/ano, −20%). Completo mensal ~~R$109,90~~ **R$89,90** · anual **R$71,90/mês** (R$863/ano, −20%).
- **A confirmar:** o front promete "7 dias grátis" pra **todo** plano pago, incluindo o Entrada (lá o trial é o Betinho ilimitado, já que não tem análise). Se o Entrada for sem trial, mudar a nota abaixo dos cards e o FAQ.

## Estado atual da liberação (o que existe hoje)
Espalhado em 4 mecanismos:
- `users.betinho_subscription_status` (free/premium) — Betinho.
- `users.analytics_subscription_status` (free/premium) — NBA.
- RPC `get_futebol_access()` (trial 7d) — Futebol, **nem plugado no pagamento** (`FutebolAssinar.tsx` mostra "PIX em breve").
- `boloes.is_premium` (one-time R$19,90) — Bolão.

Lido por ~6 hooks (`use-betinho-premium`, `use-subscription`, `use-report-access`, `use-subscription-details`, `use-settings-data`, `useFutebolAccess`). Guards: `ProtectedRoute` (só auth) e `PremiumRoute` (único de entitlement — tem bug, ver §4). Pagamento: **só Stripe** (`stripe-create-checkout`, `stripe-webhook`, `stripe-verify-session`, `stripe-customer-portal`).

## O que fazer

### 1. Entitlements unificado
- Coluna `users.plano` `('free' | 'entrada' | 'essencial' | 'completo')`.
- RPC `get_entitlements(user_id)` → `{ futebol, nba, betinho }` derivado do plano (entrada: betinho full + futebol none + nba baseline; essencial: futebol full + betinho full + nba baseline; completo: tudo).
- **Não precisa** de coluna `esporte_escolhido` — derrubamos o "escolha o esporte", o plano já determina tudo.
- Um hook `useEntitlements()` no lugar dos ~6 atuais.

### 2. Stripe
- Price IDs por tier×ciclo (env): `entrada_mensal`, `entrada_anual`, `essencial_mensal`, `essencial_anual`, `completo_mensal`, `completo_anual`.
- Trocar `startCheckout()` (placeholder em `Planos.tsx`) por `createCheckoutSession(priceId, plano)` — logado vai direto pro gateway; deslogado passa por `/auth` e volta pro checkout.
- `stripe-webhook/index.ts`: gravar `users.plano` (em vez de `*_subscription_status`).
- `stripe-create-checkout/index.ts`: hoje detecta produto por `referer.includes('/paywall-platform')` e monta cancel URL `/paywall*` → atualizar pra `/planos`.
- Plugar o **Futebol** no pagamento (hoje só trial).

### 3. Migração / grandfather
- Poucos assinantes → **subir todos os premium atuais** (betinho e/ou analytics) pra `plano='completo'`. Bolão fica separado.
- O `entrada` **não é destino de migração**: quem já é assinante Betinho sobe pro `completo` (grandfather). O `entrada` é só pra venda nova.

### 4. Fix do bug do `PremiumRoute`
- `src/components/PremiumRoute.tsx` gateia `/analise-360` (que é **NBA**) checando `betinho_subscription_status`. Trocar pelo entitlement de NBA. Hoje: assinante Betinho pega análise NBA de graça; assinante NBA-only pode ser bloqueado.

### 5. Aposentar as paywalls antigas
- Deletar rotas/páginas `Paywall.tsx` (`/paywall`), `PaywallPlatform.tsx` (`/paywall-platform`), `PaywallDashboard.tsx` (`/paywall-dashboard`) — **já não são linkadas** (tudo aponta pra `/planos`). Avaliar também `DashboardTest` (`/dashboard`) e `Waitlist`.
- `Home.tsx` (morto/não roteado) ainda tem links pra `/paywall-platform` — deletar a página ou ignorar.

## SEO do `/planos` (branch `feat/seo`, DEPOIS do merge no develop)
- `<Seo>` no topo do `Planos.tsx`: title `"Planos e preços — Smart Betting"`, description curta (análise de futebol + NBA + Betinho, a partir de R$39,90/mês).
- Adicionar `/planos` ao `scripts/gen-sitemap.mjs`.
- Só "acende" junto do go-live (Stripe) — não indexar página que ainda não converte.

## Já resolvido no front (não precisa mexer)
- Todos os CTAs de upgrade do app → `/planos` (nav, `NBADashboard`/`Picks`/`Report`/`PremiumOverlay`/`PremiumRoute`, `Bets`/`BettingDashboard`/`MainNav`, bots **Telegram** e **WhatsApp** na msg de limite 3 apostas/dia, `/planos` no `BLOCKED_PREFIXES` do cross-sell).
- "Planos e preços" no menu do avatar; rodapé rebrand em `/planos` e `/settings`.
