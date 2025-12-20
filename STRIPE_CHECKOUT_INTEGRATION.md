# Guia de Integração Stripe Checkout - Página Hospedada

Este documento detalha todos os passos necessários para integrar o Stripe Checkout no projeto.

## 🎯 Ambientes de Desenvolvimento

Este guia cobre **3 ambientes diferentes**:

1. **Desenvolvimento Local** 🏠
   - Supabase rodando localmente (`supabase start`)
   - Stripe em **Test Mode** (`pk_test_...`, `sk_test_...`)
   - Webhooks testados via Stripe CLI
   - Frontend em `http://localhost:8080`

2. **Teste/Staging** 🧪
   - Supabase hospedado (projeto de teste)
   - Stripe em **Test Mode** (`pk_test_...`, `sk_test_...`)
   - Webhook apontando para Edge Function de teste
   - URL de teste configurada

3. **Produção** 🚀
   - Supabase hospedado (projeto de produção)
   - Stripe em **Live Mode** (`pk_live_...`, `sk_live_...`)
   - Webhook apontando para Edge Function de produção
   - URL de produção configurada

> ⚠️ **IMPORTANTE**: Sempre teste completamente em **Test Mode** antes de usar **Live Mode** em produção!

---

## 📋 Checklist de Integração

### Fase 1: Configuração no Stripe Dashboard

#### ✅ 1. Criar Produto e Preço no Stripe

**Para Teste (Test Mode):**
1. No Stripe Dashboard, certifique-se de estar em **Test Mode** (toggle no canto superior direito)
2. Vá em **Products** → **Add product**
3. Preencha:
   - **Name**: Ex: "Smart Betting Premium"
   - **Description**: Ex: "Apostas ilimitadas e acesso completo ao dashboard"
   - **Pricing model**: Escolha "Recurring" (mensal) ou "One-time" (único pagamento)
   - **Price**: Defina o valor (ex: R$ 29,90/mês)
   - **Billing period**: Se recorrente, escolha mensal/anual
4. **Salve o Price ID de TESTE** (começa com `price_...`) - você vai precisar dele!

**Para Produção (Live Mode):**
1. ⚠️ **Só faça isso após testar completamente em Test Mode!**
2. No Stripe Dashboard, mude para **Live Mode** (toggle no canto superior direito)
3. Repita os passos acima para criar o mesmo produto/preço em produção
4. **Salve o Price ID de PRODUÇÃO** (será diferente do de teste)

> 💡 **Dica**: Use nomes diferentes ou tags para distinguir produtos de teste e produção.

#### ✅ 2. Obter Chaves da API

> 💡 **IMPORTANTE**: Para desenvolvimento local, você usa as **mesmas chaves do Test Mode** abaixo!

**Para Teste (e Desenvolvimento Local):**
1. No Stripe Dashboard, certifique-se de estar em **Test Mode** (toggle no canto superior direito)
2. Vá em **Developers** → **API keys**
3. **Publishable key** (começa com `pk_test_...`)
   - Esta vai no frontend (variável de ambiente `.env.local`)
   - ✅ **Use esta mesma chave para desenvolvimento local!**
4. **Secret key** (começa com `sk_test_...`)
   - Esta vai nas Edge Functions (variável de ambiente `supabase/.env.local` para local)
   - ⚠️ **NUNCA** exponha a secret key no frontend!
   - ✅ **Use esta mesma chave para desenvolvimento local!**

**Para Produção:**
1. ⚠️ **Só faça isso após testar completamente em Test Mode!**
2. No Stripe Dashboard, mude para **Live Mode**
3. Vá em **Developers** → **API keys**
4. **Publishable key** (começa com `pk_live_...`)
5. **Secret key** (começa com `sk_live_...`)

#### ✅ 3. Configurar Webhook Endpoint

**Para Desenvolvimento Local:**
1. Use o **Stripe CLI** para testar webhooks localmente (não precisa criar no Dashboard)
2. Instale o Stripe CLI: https://stripe.com/docs/stripe-cli
3. Autentique: `stripe login`
4. Em outro terminal, inicie o listener:
   ```bash
   stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
   ```
5. O CLI vai mostrar um **Signing secret** (começa com `whsec_...`)
   - Use este secret nas variáveis de ambiente locais do Supabase

**Para Teste/Produção (Supabase Hospedado):**
1. ⚠️ **Primeiro, faça deploy das Edge Functions!** (ver Fase 2)
2. No Stripe Dashboard, certifique-se de estar no modo correto (Test ou Live)
3. Vá em **Developers** → **Webhooks**
4. Clique em **Add endpoint**
5. **Endpoint URL**: `https://[seu-projeto].supabase.co/functions/v1/stripe-webhook`
6. **Events to send**: Selecione:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
7. **Salve o Signing secret** (começa com `whsec_...`) - vai nas variáveis de ambiente do Supabase

> 💡 **Dica**: Você precisará de webhooks separados para Test Mode e Live Mode!

---

### Fase 2: Configuração no Supabase

#### ✅ 4. Configurar Variáveis de Ambiente

**Para Desenvolvimento Local:**
1. ⚠️ **NÃO use `supabase secrets set`!** Esse comando é apenas para projetos remotos (produção).
2. Certifique-se de que o Supabase está rodando localmente: `supabase start`
3. **Obtenha as chaves do Stripe Test Mode:**
   - Acesse [Stripe Dashboard](https://dashboard.stripe.com/)
   - Certifique-se de estar em **Test Mode** (toggle no canto superior direito)
   - Vá em **Developers** → **API keys**
   - Copie a **Secret key** (começa com `sk_test_...`)
4. **Crie um arquivo `supabase/functions/.env`** (este arquivo é carregado automaticamente pelo Supabase CLI):
   ```bash
   # Na pasta supabase/functions/
   # Windows PowerShell:
   New-Item -Path "supabase\functions\.env" -ItemType File
   
   # Linux/Mac:
   touch supabase/functions/.env
   ```
5. Adicione as variáveis no arquivo `supabase/functions/.env`:
   ```env
   # Use a Secret Key do Test Mode (mesma que você obteve na Fase 1)
   STRIPE_SECRET_KEY=sk_test_...
   
   # Webhook secret do Stripe CLI (obtenha rodando: stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook)
   STRIPE_WEBHOOK_SECRET=whsec_...
   
   # URL do seu frontend local
   SITE_URL=http://localhost:8080
   ```
6. ⚠️ **Adicione `supabase/functions/.env` ao `.gitignore`** para não commitar secrets:
   ```bash
   echo "supabase/functions/.env" >> .gitignore
   ```
7. Reinicie o servidor de Edge Functions para carregar as novas variáveis:
   ```bash
   # Pare o servidor (Ctrl+C) e inicie novamente
   supabase functions serve
   ```

**Para Teste/Produção (Supabase Hospedado):**
1. Acesse o [Supabase Dashboard](https://app.supabase.com/)
2. Selecione o projeto correto (teste ou produção)
3. Vá em **Project Settings** → **Edge Functions** → **Secrets**
4. Adicione as seguintes variáveis:

   **Para Teste:**
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_... (do webhook de Test Mode)
   SITE_URL=https://seu-dominio-teste.com (ou http://localhost:5173)
   ```

   **Para Produção:**
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_... (do webhook de Live Mode)
   SITE_URL=https://seu-dominio.com
   ```

> ⚠️ **ATENÇÃO**: Use chaves diferentes para teste e produção! Nunca misture `sk_test_` com `sk_live_`!

#### ✅ 5. Criar Edge Functions

**Para Desenvolvimento Local:**
1. No terminal, navegue até a pasta do projeto
2. Crie a estrutura:
   ```bash
   mkdir -p supabase/functions/stripe-create-checkout
   mkdir -p supabase/functions/stripe-webhook
   ```
3. Crie os arquivos:
   - `supabase/functions/stripe-create-checkout/index.ts`
   - `supabase/functions/stripe-webhook/index.ts`
4. Implemente as funções (ver código abaixo)
5. **Para rodar localmente**, use:
   ```bash
   # Certifique-se de que o Supabase está rodando
   supabase start
   
   # Servir as functions localmente
   supabase functions serve
   
   # Ou servir uma específica
   supabase functions serve stripe-create-checkout
   supabase functions serve stripe-webhook
   ```
6. As functions estarão disponíveis em:
   - `http://127.0.0.1:54321/functions/v1/stripe-create-checkout`
   - `http://127.0.0.1:54321/functions/v1/stripe-webhook`

**Para Teste/Produção (Supabase Hospedado):**
1. ⚠️ **Primeiro, faça login**: `supabase login`
2. ⚠️ **Link o projeto** (se ainda não fez): `supabase link --project-ref [seu-project-ref]`
3. Crie/edite os arquivos das functions (mesmos arquivos acima)
4. **Faça deploy para o projeto hospedado**:
   ```bash
   supabase functions deploy stripe-create-checkout
   supabase functions deploy stripe-webhook
   ```
5. ⚠️ **IMPORTANTE**: O deploy é para o projeto **hospedado**, não local!

---

### Fase 3: Implementação Frontend

#### ✅ 7. Adicionar Variável de Ambiente no Frontend

**Para Desenvolvimento Local:**
1. **Obtenha a chave do Stripe Test Mode:**
   - Acesse [Stripe Dashboard](https://dashboard.stripe.com/)
   - Certifique-se de estar em **Test Mode** (toggle no canto superior direito)
   - Vá em **Developers** → **API keys**
   - Copie a **Publishable key** (começa com `pk_test_...`)
2. Crie/edite o arquivo `.env.local` na raiz do projeto:
   ```env
   # Use a chave do Test Mode para desenvolvimento local
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```
3. ⚠️ Adicione `.env.local` ao `.gitignore` para não commitar chaves!

> 💡 **Dica**: Para desenvolvimento local, use as **mesmas chaves do Test Mode** que você configurou na Fase 1. São seguras e permitem testar sem cobranças reais.

**Para Teste:**
1. Use `.env.test` ou variáveis de ambiente do seu serviço de hospedagem:
   ```env
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

**Para Produção:**
1. Configure nas variáveis de ambiente do seu serviço de hospedagem (Vercel, Netlify, etc.):
   ```env
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```
2. ⚠️ **NUNCA** commite chaves de produção no código!

> 💡 **Dica**: Use diferentes arquivos `.env` para cada ambiente ou configure diretamente no serviço de hospedagem.

#### ✅ 8. Criar Serviço Stripe no Frontend
1. Crie o arquivo `src/services/stripe.service.ts`
2. Implemente o serviço para chamar a Edge Function (ver código abaixo)

#### ✅ 9. Atualizar Página Paywall
1. Edite `src/pages/Paywall.tsx`
2. Adicione botão para Stripe Checkout
3. Implemente a lógica de chamada ao serviço
4. Adicione tratamento de sucesso/cancelamento via query params

#### ✅ 10. Adicionar Hook para Verificar Status de Assinatura (Opcional)
1. Crie `src/hooks/use-subscription.ts` para verificar `subscription_status`
2. Use no Paywall para mostrar mensagens diferentes para usuários premium

---

---

## 🔧 Comandos por Ambiente

### Desenvolvimento Local

```bash
# Iniciar Supabase local
supabase start

# Servir Edge Functions localmente
supabase functions serve

# Ver logs das functions
supabase functions logs stripe-create-checkout --follow

# Ver status
supabase status
```

**Variáveis de ambiente**: Use arquivo `supabase/.env.local`

### Produção/Hospedado

```bash
# Fazer login (primeira vez)
supabase login

# Linkar projeto (primeira vez)
supabase link --project-ref [seu-project-ref]

# Fazer deploy das functions
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-webhook

# Ver logs em produção
supabase functions logs stripe-create-checkout --project-ref [seu-project-ref]
```

**Variáveis de ambiente**: Configure no Supabase Dashboard → Project Settings → Edge Functions → Secrets

> ⚠️ **IMPORTANTE**: 
> - `supabase functions serve` = desenvolvimento local
> - `supabase functions deploy` = produção/hospedado

---

### Fase 4: Testes

#### ✅ 11. Testar em Desenvolvimento Local

**Setup:**
1. Inicie o Supabase local: `supabase start`
2. Configure as variáveis de ambiente em `supabase/.env.local` (ver Fase 2)
3. **Servir as Edge Functions localmente** (em terminal separado):
   ```bash
   supabase functions serve
   # Ou servir apenas as que você precisa:
   supabase functions serve stripe-create-checkout stripe-webhook
   ```
4. Inicie o Stripe CLI listener (em outro terminal separado):
   ```bash
   stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
   ```
5. Inicie o frontend: `npm run dev`

**Testar o Fluxo:**
1. Use cartões de teste do Stripe:
   - **Sucesso**: `4242 4242 4242 4242`
   - **Falha**: `4000 0000 0000 0002`
   - **CVC**: qualquer 3 dígitos
   - **Data**: qualquer data futura
2. Teste o fluxo completo:
   - Clicar no botão → Redirecionar para Stripe → Pagar → Voltar → Verificar status
3. Verifique os logs do Stripe CLI para ver os eventos recebidos

#### ✅ 12. Testar em Ambiente de Teste (Supabase Hospedado)

1. Use os mesmos cartões de teste do Stripe
2. Teste o fluxo completo
3. Verifique webhook no Stripe Dashboard:
   - Vá em **Developers** → **Webhooks**
   - Clique no seu webhook → **Recent events**
   - Verifique se os eventos estão sendo recebidos
4. Verifique se o `subscription_status` está sendo atualizado no banco

#### ✅ 13. Checklist de Migração para Produção

Antes de ir para produção, certifique-se de:

- [ ] Todos os testes passaram em Test Mode
- [ ] Webhook está funcionando corretamente
- [ ] Status de assinatura está sendo atualizado corretamente
- [ ] Criou produto/preço em **Live Mode** no Stripe
- [ ] Obteve chaves de **Live Mode** (`pk_live_...`, `sk_live_...`)
- [ ] Configurou webhook separado para **Live Mode**
- [ ] Atualizou variáveis de ambiente no Supabase para produção
- [ ] Atualizou variáveis de ambiente no frontend para produção
- [ ] Atualizou `SITE_URL` para URL de produção
- [ ] Testou com cartão de teste em Live Mode (se possível)
- [ ] Configurou monitoramento/logs para produção

---

## 📝 Código de Referência

### Edge Function: stripe-create-checkout/index.ts
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter dados do body
    const { priceId } = await req.json();
    if (!priceId) {
      return new Response(
        JSON.stringify({ error: 'Missing priceId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SITE_URL = Deno.env.get('SITE_URL') || 'http://localhost:8080';

    // Criar sessão de checkout
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription', // ou 'payment' para pagamento único
      success_url: `${SITE_URL}/paywall?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/paywall?canceled=true`,
      metadata: {
        userId: user.id,
        userEmail: user.email || '',
      },
      subscription_data: {
        metadata: {
          userId: user.id,
        },
      },
    });

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### Edge Function: stripe-webhook/index.ts
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

serve(async (req) => {
  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (userId) {
          await supabase
            .from('users')
            .update({ subscription_status: 'premium' })
            .eq('id', userId);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (userId) {
          const status = subscription.status === 'active' ? 'premium' : 'free';
          await supabase
            .from('users')
            .update({ subscription_status: status })
            .eq('id', userId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (userId) {
          await supabase
            .from('users')
            .update({ subscription_status: 'free' })
            .eq('id', userId);
        }
        break;
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### Serviço Frontend: src/services/stripe.service.ts
```typescript
import { createClient } from '../integrations/supabase/client';

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export class StripeService {
  private static instance: StripeService;
  private supabase = createClient();

  public static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  async createCheckoutSession(priceId: string): Promise<CheckoutSessionResponse> {
    const { data, error } = await this.supabase.functions.invoke('stripe-create-checkout', {
      body: { priceId },
    });

    if (error) {
      throw new Error(`Failed to create checkout session: ${error.message}`);
    }

    if (!data || !data.sessionId || !data.url) {
      throw new Error('Invalid response from checkout session creation');
    }

    return {
      sessionId: data.sessionId,
      url: data.url,
    };
  }

  async redirectToCheckout(checkoutUrl: string): Promise<void> {
    window.location.href = checkoutUrl;
  }
}

export const stripeService = StripeService.getInstance();
```

### Atualização Paywall.tsx (exemplo)
```typescript
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { stripeService } from '@/services/stripe.service';
import { useAuth } from '@/hooks/use-auth';

// Dentro do componente:
const [searchParams] = useSearchParams();
const { user } = useAuth();
const success = searchParams.get('success');
const canceled = searchParams.get('canceled');

// Preço ID do Stripe (substitua pelo seu)
const PRICE_ID = 'price_1234567890'; // Seu Price ID aqui

const handleStripeCheckout = async () => {
  try {
    const { url } = await stripeService.createCheckoutSession(PRICE_ID);
    await stripeService.redirectToCheckout(url);
  } catch (error) {
    console.error('Error:', error);
    // Mostrar toast de erro
  }
};

// Mostrar mensagem de sucesso/cancelamento
useEffect(() => {
  if (success) {
    // Mostrar mensagem de sucesso
    // Verificar se subscription_status foi atualizado
  }
  if (canceled) {
    // Mostrar mensagem de cancelamento
  }
}, [success, canceled]);
```

---

## 🔍 Troubleshooting

### Webhook não está recebendo eventos

**Desenvolvimento Local:**
- Verifique se o Stripe CLI está rodando: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`
- Verifique se o Supabase local está rodando: `supabase status`
- Verifique se o `STRIPE_WEBHOOK_SECRET` está configurado (use o secret do Stripe CLI)
- Teste enviando um evento manualmente: `stripe trigger checkout.session.completed`

**Produção:**
- Verifique se a URL do webhook está correta no Stripe Dashboard
- Verifique se o `STRIPE_WEBHOOK_SECRET` está configurado corretamente no Supabase
- Verifique se está usando o secret correto (Test Mode vs Live Mode)
- Verifique os logs da Edge Function no Supabase Dashboard

### Erro "Missing authorization header"
- Certifique-se de que o frontend está enviando o token JWT no header Authorization
- O Supabase client já faz isso automaticamente quando você usa `supabase.functions.invoke()`
- Verifique se o usuário está autenticado antes de chamar a função

### Status não está sendo atualizado
- Verifique os logs da Edge Function no Supabase Dashboard
- Verifique se o webhook está recebendo os eventos no Stripe Dashboard
- Verifique se o `userId` está sendo passado corretamente no metadata
- Verifique se a tabela `users` tem a coluna `subscription_status`
- Verifique se o `userId` no metadata corresponde ao ID do usuário no banco

### Erro "Webhook signature verification failed"
- Verifique se está usando o `STRIPE_WEBHOOK_SECRET` correto
- Em desenvolvimento local, use o secret do Stripe CLI
- Em produção, use o secret do webhook configurado no Stripe Dashboard
- Certifique-se de que não está misturando secrets de Test Mode com Live Mode

### Chaves de API incorretas
- ⚠️ **NUNCA** misture `sk_test_` com `pk_live_` ou vice-versa
- Use sempre chaves do mesmo modo (ambas test ou ambas live)
- Verifique se está no modo correto no Stripe Dashboard (Test/Live toggle)

---

## 📊 Resumo: Configuração por Ambiente

| Configuração | Desenvolvimento Local | Teste/Staging | Produção |
|-------------|----------------------|---------------|----------|
| **Supabase** | Local (`supabase start`) | Hospedado (projeto teste) | Hospedado (projeto prod) |
| **Stripe Mode** | Test Mode | Test Mode | Live Mode |
| **Publishable Key** | `pk_test_...` | `pk_test_...` | `pk_live_...` |
| **Secret Key** | `sk_test_...` | `sk_test_...` | `sk_live_...` |
| **Webhook** | Stripe CLI | Dashboard (Test Mode) | Dashboard (Live Mode) |
| **Webhook Secret** | Do Stripe CLI | `whsec_...` (Test) | `whsec_...` (Live) |
| **SITE_URL** | `http://localhost:8080` | URL de teste | URL de produção |
| **Price ID** | `price_...` (Test) | `price_...` (Test) | `price_...` (Live) |
| **Cartões** | Cartões de teste | Cartões de teste | Cartões reais |

> ⚠️ **Lembrete**: Sempre teste completamente em Test Mode antes de usar Live Mode!

---

## 📚 Recursos Adicionais

- [Stripe Checkout Documentation](https://docs.stripe.com/checkout)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Stripe Testing Cards](https://stripe.com/docs/testing)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Supabase Local Development](https://supabase.com/docs/guides/cli/local-development)

