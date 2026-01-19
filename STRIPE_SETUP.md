# Stripe Integration Setup

Este documento descreve a configuração completa da integração com Stripe para o projeto Smart Betting.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                                                             │
│  Paywall.tsx                                                │
│     │                                                       │
│     ├─► stripeService.createCheckoutSession(priceId, type) │
│     │                                                       │
│     └─► Redirect para Stripe Checkout                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTIONS                           │
│                                                             │
│  stripe-create-checkout                                     │
│     ├─► Autentica usuário (JWT)                             │
│     ├─► Busca/cria Stripe Customer (sem duplicatas)         │
│     └─► Cria Checkout Session                               │
│                                                             │
│  stripe-webhook                                             │
│     ├─► checkout.session.completed  → premium               │
│     ├─► subscription.created/updated → premium/free         │
│     └─► subscription.deleted        → free                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       DATABASE                              │
│                                                             │
│  users                                                      │
│     ├─► stripe_customer_id           (VARCHAR)              │
│     ├─► betinho_subscription_status  (free/premium)         │
│     └─► analytics_subscription_status (free/premium)        │
└─────────────────────────────────────────────────────────────┘
```

---

## Variáveis de Ambiente

### Desenvolvimento Local

Usamos um único arquivo `.env.local` na raiz do projeto para todas as variáveis:

```env
# ============================================
# SUPABASE
# ============================================
SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJ...

# ============================================
# STRIPE - Frontend (públicas)
# ============================================
# Price IDs - Obter no Stripe Dashboard > Products > Pricing
VITE_STRIPE_PRICE_ID_BETINHO=price_xxxxxxxxxxxxx
# VITE_STRIPE_PRICE_ID_ANALYTICS=price_yyyyyyyyyyyyy  # futuro

# ============================================
# STRIPE - Edge Functions (secrets)
# ============================================
# Secret Key - Stripe Dashboard > Developers > API Keys
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx

# Webhook Signing Secret - Obtido ao rodar: stripe listen --forward-to ...
STRIPE_WEBHOOK_SIGNING_SECRET=whsec_xxxxxxxxxxxxx

# URL do frontend para redirects após checkout
SITE_URL=http://localhost:8080
```

### Como as variáveis são carregadas

| Variável | Vite (Frontend) | Edge Functions |
|----------|-----------------|----------------|
| `VITE_*` | ✅ Expõe no browser | ✅ Lê via --env-file |
| `STRIPE_SECRET_KEY` | ❌ Ignora | ✅ Lê via --env-file |
| `STRIPE_WEBHOOK_*` | ❌ Ignora | ✅ Lê via --env-file |

**Segurança:** O Vite só expõe variáveis que começam com `VITE_`. As secrets ficam apenas no servidor.

---

## Rodando Localmente

### 1. Iniciar Supabase

```bash
supabase start
```

### 2. Iniciar Edge Functions

```bash
supabase functions serve --env-file .env.local
```

### 3. Iniciar Stripe CLI (webhook listener)

```bash
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

Copie o `whsec_...` mostrado e coloque em `STRIPE_WEBHOOK_SIGNING_SECRET`.

### 4. Iniciar Frontend

```bash
npm run dev
```

---

## Eventos do Webhook

| Evento Stripe | Ação no Banco |
|---------------|---------------|
| `checkout.session.completed` | `status = 'premium'` |
| `customer.subscription.created` | `status = 'premium'` (se active) |
| `customer.subscription.updated` | `status = 'premium'` ou `'free'` |
| `customer.subscription.deleted` | `status = 'free'` |

### Cancelamento de Assinatura

Quando um usuário cancela a assinatura no Stripe:
1. Stripe envia evento `customer.subscription.deleted`
2. Webhook recebe e identifica o `userId` do metadata
3. Atualiza `betinho_subscription_status` ou `analytics_subscription_status` para `'free'`
4. Usuário volta a ter limite de apostas

---

## Multi-Produto

O sistema suporta múltiplos produtos com assinaturas separadas:

### Campos no Banco

```sql
betinho_subscription_status    -- Assinatura do Betinho
analytics_subscription_status  -- Assinatura da Plataforma de Análises
```

### Como funciona

1. Frontend envia `productType` ('betinho' ou 'analytics') no checkout
2. Edge Function salva `productType` no metadata da sessão Stripe
3. Webhook lê o `productType` e atualiza o campo correto

### Exemplo de uso futuro (bundle)

```typescript
// Checkout para Betinho
stripeService.createCheckoutSession(BETINHO_PRICE_ID, 'betinho');

// Checkout para Analytics
stripeService.createCheckoutSession(ANALYTICS_PRICE_ID, 'analytics');

// Bundle (futuro) - criar preço único que ativa ambos
```

---

## Produção

### Variáveis de Ambiente

Configurar no Supabase Dashboard > Edge Functions > Secrets:

```env
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SIGNING_SECRET=whsec_xxxxxxxxxxxxx
SITE_URL=https://smartbetting.app
```

### Webhook Endpoint

Criar no Stripe Dashboard > Developers > Webhooks:

- **URL:** `https://[projeto].supabase.co/functions/v1/stripe-webhook`
- **Eventos:**
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

### Deploy

```bash
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-webhook
```

---

## Testando

### Cartões de Teste

| Cenário | Número do Cartão |
|---------|------------------|
| Sucesso | 4242 4242 4242 4242 |
| Requer autenticação | 4000 0025 0000 3155 |
| Falha | 4000 0000 0000 9995 |

Use qualquer data futura e CVC.

### Testar Cancelamento

```bash
# Via Stripe CLI
stripe subscriptions cancel sub_xxxxx

# Ou no Stripe Dashboard > Customers > Subscriptions > Cancel
```

---

## Troubleshooting

### "Missing priceId"
- Verifique se `VITE_STRIPE_PRICE_ID_BETINHO` está configurado
- Reinicie o servidor de dev após alterar `.env.local`

### "You did not provide an API key"
- Verifique se `STRIPE_SECRET_KEY` está no `.env.local`
- Reinicie as Edge Functions

### "Webhook signature verification failed"
- Verifique se `STRIPE_WEBHOOK_SIGNING_SECRET` está correto
- Para local, use o secret gerado pelo `stripe listen`

### "No such price" (test mode key with live mode price)
- Use Price IDs do mesmo modo (test ou live) que sua API key
- Test mode: criar produto no Stripe com toggle "Test mode" ativo

