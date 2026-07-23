# Handoff — Back-end da Paywall Unificada (`/planos`)

> **Front pronto** na branch `feat/landing-futebol` (commits `a0dd489`, `7407b25`, `82d7c44`, `85e1aa7`).
> Este doc é pra quem vai plugar o back (entitlements + Stripe). Nada aqui está feito ainda.

## ⚠️ Caveat de merge — ler primeiro
`/planos` **ainda não fecha compra**. Os botões "Assinar" chamam `startCheckout()` em `src/pages/Planos.tsx`, que hoje é **placeholder** (manda pra `/auth` deslogado / `/inicio` logado). As paywalls antigas (`/paywall`, `/paywall-platform`) **ainda têm Stripe funcionando**.

**Não mergear/deployar esta branch pra PRODUÇÃO antes de plugar o checkout do `/planos`** — senão todo o funil de upgrade do app (que já aponta pra `/planos`) fica sem checkout. Em `develop`/staging, tudo bem.

## Modelo (decidido)
3 níveis por **amplitude** — não por esporte:

| | Grátis | Essencial | Completo |
|---|---|---|---|
| Futebol | trial 7d | completo | completo |
| NBA | 2 picks/dia (baseline) | 2 picks/dia (baseline) | completo (prop bets + Análise 360) |
| Betinho | 3 apostas/dia | ilimitado | ilimitado |

- **Betinho incluído em todo plano pago.** **NBA só no Completo**, sem avulso. **Bolão fora** (produto de evento, segue `boloes.is_premium` one-time).
- Preços (placeholders no código, confirmar): Essencial mensal ~~R$49,90~~ **R$39,90** · anual **R$31,90/mês** (R$383/ano, −20%). Completo mensal ~~R$109,90~~ **R$89,90** · anual **R$71,90/mês** (R$863/ano, −20%).

## Estado atual da liberação (o que existe hoje)
Espalhado em 4 mecanismos:
- `users.betinho_subscription_status` (free/premium) — Betinho.
- `users.analytics_subscription_status` (free/premium) — NBA.
- RPC `get_futebol_access()` (trial 7d) — Futebol, **nem plugado no pagamento** (`FutebolAssinar.tsx` mostra "PIX em breve").
- `boloes.is_premium` (one-time R$19,90) — Bolão.

Lido por ~6 hooks (`use-betinho-premium`, `use-subscription`, `use-report-access`, `use-subscription-details`, `use-settings-data`, `useFutebolAccess`). Guards: `ProtectedRoute` (só auth) e `PremiumRoute` (único de entitlement — tem bug, ver §4). Pagamento: **só Stripe** (`stripe-create-checkout`, `stripe-webhook`, `stripe-verify-session`, `stripe-customer-portal`).

## O que fazer

### 1. Entitlements unificado
- Coluna `users.plano` `('free' | 'essencial' | 'completo')`.
- RPC `get_entitlements(user_id)` → `{ futebol, nba, betinho }` derivado do plano (essencial: futebol full + betinho full + nba baseline; completo: tudo).
- **Não precisa** de coluna `esporte_escolhido` — derrubamos o "escolha o esporte", o plano já determina tudo.
- Um hook `useEntitlements()` no lugar dos ~6 atuais.

### 2. Stripe
- Price IDs por tier×ciclo (env): `essencial_mensal`, `essencial_anual`, `completo_mensal`, `completo_anual`.
- Trocar `startCheckout()` (placeholder em `Planos.tsx`) por `createCheckoutSession(priceId, plano)` — logado vai direto pro gateway; deslogado passa por `/auth` e volta pro checkout.
- `stripe-webhook/index.ts`: gravar `users.plano` (em vez de `*_subscription_status`).
- `stripe-create-checkout/index.ts`: hoje detecta produto por `referer.includes('/paywall-platform')` e monta cancel URL `/paywall*` → atualizar pra `/planos`.
- Plugar o **Futebol** no pagamento (hoje só trial).

### 3. Migração / grandfather
- Poucos assinantes → **subir todos os premium atuais** (betinho e/ou analytics) pra `plano='completo'`. Bolão fica separado.

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
