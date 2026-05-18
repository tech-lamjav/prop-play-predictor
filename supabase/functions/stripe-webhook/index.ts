import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET') || '';

/**
 * Gera invite_code compatível com `bolao.service.ts > generateInviteCode`:
 * alfabeto custom sem caracteres ambíguos (I/O/0/1), sempre 6 chars.
 *
 * Substitui o `Math.random().toString(36).substring(2, 8).toUpperCase()` antigo
 * que (B4 do PR #140 review):
 *   1. Podia produzir <6 chars (Math.random dando valor com poucos dígitos)
 *   2. Tinha alfabeto diferente do gerado pelo frontend (caracteres ambíguos)
 *   3. Não tinha retry em colisão de UNIQUE
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I/O/0/1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

serve(async (req) => {
  console.log('[Webhook] Request received');
  console.log('[Webhook] Method:', req.method);
  console.log('[Webhook] Headers:', Object.fromEntries(req.headers.entries()));
  
  try {
    const signature = req.headers.get('stripe-signature');
    console.log('[Webhook] Stripe signature present:', !!signature);
    
    if (!signature) {
      console.error('[Webhook] Missing stripe-signature header');
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.text();
    console.log('[Webhook] Body length:', body.length);
    let event: Stripe.Event;

    try {
      console.log('[Webhook] Verifying signature with secret:', webhookSecret ? 'Present' : 'Missing');
      // Use constructEventAsync for Deno/Edge Functions
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      console.log('[Webhook] Signature verified successfully');
    } catch (err) {
      console.error('[Webhook] Signature verification failed:', err);
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    console.log('[Webhook] Supabase URL:', supabaseUrl ? 'Present' : 'Missing');
    console.log('[Webhook] Supabase Service Role Key:', supabaseKey ? 'Present' : 'Missing');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Webhook] Received webhook event:', event.type);
    console.log('[Webhook] Event ID:', event.id);
    
    // Helper function to determine which subscription field to update
    const getSubscriptionField = (productType: string | undefined): string => {
      const product = (productType || 'betinho').toLowerCase();
      if (product === 'analytics' || product === 'platform') {
        return 'analytics_subscription_status';
      }
      return 'betinho_subscription_status';
    };

    // Helper to build product-specific metadata update (period_end, cancel_at, etc.)
    const getProductMetadataUpdate = (
      productType: string | undefined,
      subscription: Stripe.Subscription
    ): Record<string, unknown> => {
      const product = (productType || 'betinho').toLowerCase();
      const prefix =
        product === 'analytics' || product === 'platform' ? 'analytics_subscription' : 'betinho_subscription';
      const update: Record<string, unknown> = {};
      update[`${prefix}_period_end`] = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;
      update[`${prefix}_cancel_at`] = subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null;
      update[`${prefix}_cancel_at_period_end`] = subscription.cancel_at_period_end ?? false;
      return update;
    };

    const getProductMetadataClear = (productType: string | undefined): Record<string, unknown> => {
      const product = (productType || 'betinho').toLowerCase();
      const prefix =
        product === 'analytics' || product === 'platform' ? 'analytics_subscription' : 'betinho_subscription';
      return {
        [`${prefix}_period_end`]: null,
        [`${prefix}_cancel_at`]: null,
        [`${prefix}_cancel_at_period_end`]: false,
      };
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const productType = session.metadata?.productType;
        // bolaoId may come from metadata (checkout session) or client_reference_id (payment link)
        const bolaoId = session.metadata?.bolaoId || session.client_reference_id || null;

        console.log('[Webhook] Checkout session completed');
        console.log('[Webhook] Session ID:', session.id);
        console.log('[Webhook] ProductType:', productType);
        console.log('[Webhook] UserId:', userId);
        console.log('[Webhook] BolaoId:', bolaoId);
        console.log('[Webhook] Mode:', session.mode);

        // Bolão premium: one-time payment identified by bolaoId (UUID format)
        const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
        const isBolaoPayment = (productType === 'bolao_premium' && bolaoId) ||
          (session.mode === 'payment' && bolaoId && isUuid(bolaoId));

        if (isBolaoPayment && bolaoId) {
          // B1 — Hijack protection: bolaoId vem de metadata.bolaoId OU
          // client_reference_id, ambos controlados pelo cliente. UUIDs vazam
          // em links de convite. Sem validar ownership, atacante pode pagar
          // R$ 19,90 passando bolaoId de outro user e promover bolão alheio.
          // SELECT inclui owner_id pra checar antes do UPDATE.
          const { data: existingBolao } = await supabase
            .from('boloes')
            .select('id, owner_id')
            .eq('id', bolaoId)
            .maybeSingle();

          if (existingBolao && userId && existingBolao.owner_id !== userId) {
            console.error('[Webhook] ⚠️ HIJACK ATTEMPT: payer is not bolao owner', {
              bolaoId,
              payingUser: userId,
              actualOwner: existingBolao.owner_id,
              sessionId: session.id,
            });
            // Retorna 200 pra Stripe NÃO retentar (não é erro do nosso lado,
            // é fraude do atacante). Marcamos no body pra log/auditoria.
            return new Response(
              JSON.stringify({ received: true, hijack_attempt: true }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }

          if (existingBolao) {
            // Old flow: bolão was created before payment — just upgrade it
            const { error } = await supabase
              .from('boloes')
              .update({ is_premium: true, max_participants: 9999 })
              .eq('id', bolaoId);
            if (error) {
              console.error('[Webhook] Error upgrading bolão to premium:', error);
            } else {
              console.log('[Webhook] ✅ Bolão upgraded to premium:', bolaoId);
            }
          } else {
            // New flow: create the bolão now (user paid without prior creation)
            const bolaoName = session.metadata?.bolaoName || 'Bolão Copa 2026';
            const bolaoDescription = session.metadata?.bolaoDescription || null;

            // B4 — Retry on collision: invite_code é UNIQUE em boloes.
            // Se a primeira tentativa colidir, regenera e tenta de novo.
            // Max 3 tentativas pra evitar loop. Sucesso garante 1 INSERT atômico.
            let createError: { code?: string; message?: string } | null = null;
            let attempts = 0;
            const MAX_ATTEMPTS = 3;

            while (attempts < MAX_ATTEMPTS) {
              const inviteCode = generateInviteCode();
              const { error } = await supabase.from('boloes').insert({
                id: bolaoId,
                owner_id: userId || null,
                name: bolaoName,
                description: bolaoDescription,
                invite_code: inviteCode,
                is_premium: true,
                max_participants: 9999,
              });

              if (!error) {
                createError = null;
                console.log('[Webhook] ✅ Premium bolão created:', bolaoId, 'invite:', inviteCode);
                break;
              }

              // 23505 = unique_violation (Postgres). Verifica se foi
              // invite_code que colidiu (pode ser id, mas id é UUID pré-gerado
              // e não deveria colidir; se colidir, é bug maior — não retry).
              const isInviteCollision =
                error.code === '23505' &&
                (error.message?.includes('invite_code') ?? false);

              if (!isInviteCollision) {
                createError = error;
                console.error('[Webhook] Error creating premium bolão:', error);
                break;
              }

              attempts++;
              console.warn(`[Webhook] invite_code collision (attempt ${attempts}/${MAX_ATTEMPTS}), regenerating`);
            }

            if (!createError && attempts < MAX_ATTEMPTS) {
              // Add owner as member
              if (userId) {
                const { error: memberError } = await supabase.from('bolao_members').insert({
                  bolao_id: bolaoId,
                  user_id: userId,
                  role: 'owner',
                });
                if (memberError) {
                  // Bolão criado mas membership falhou — bug funcional silencioso
                  // (dono fica sem acesso). Log loud pra investigação manual.
                  console.error('[Webhook] ⚠️ Bolão created but owner membership failed', {
                    bolaoId, userId, error: memberError,
                  });
                }
              }
            } else if (attempts >= MAX_ATTEMPTS) {
              console.error('[Webhook] ❌ Failed to create bolão after 3 invite_code collisions', { bolaoId });
            }
          }

          // Record the purchase — upsert por stripe_session_id pra idempotência
          // (B2: Stripe retenta eventos. Sem upsert, 2 entregas = 2 rows.)
          if (userId) {
            const { error: subError } = await supabase
              .from('bolao_subscriptions')
              .upsert({
                user_id: userId,
                bolao_id: bolaoId,
                type: 'bolao_premium',
                stripe_session_id: session.id,
                status: 'active',
              }, { onConflict: 'stripe_session_id' });
            if (subError) console.error('[Webhook] Error recording purchase:', subError);
            else console.log('[Webhook] Purchase recorded for user:', userId);
          }
        } else if (userId) {
          // Subscription product (betinho / analytics)
          const subscriptionField = getSubscriptionField(productType);
          console.log(`[Webhook] Updating ${subscriptionField} to premium for user:`, userId);
          const updateData: Record<string, string> = {};
          updateData[subscriptionField] = 'premium';

          const { data, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId);

          if (error) {
            console.error('[Webhook] Error updating subscription status:', error);
          } else {
            console.log(`[Webhook] ✅ ${subscriptionField} updated to premium for user:`, userId);
            console.log('[Webhook] Updated data:', JSON.stringify(data));
          }
        } else {
          console.warn('[Webhook] ⚠️ No userId or bolaoId found in session metadata');
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        const productType = subscription.metadata?.productType;
        const subscriptionField = getSubscriptionField(productType);
        
        console.log(`Subscription ${event.type} - userId: ${userId}, status: ${subscription.status}, productType: ${productType}`);
        
        if (userId) {
          const status = subscription.status === 'active' ? 'premium' : 'free';
          const updateData: Record<string, unknown> = {
            [subscriptionField]: status,
            stripe_subscription_id: subscription.id,
            subscription_product_type: productType || 'betinho',
            ...getProductMetadataUpdate(productType, subscription),
          };
          
          const { error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId);
          
          if (error) {
            console.error(`Error updating ${subscriptionField}:`, error);
          } else {
            console.log(`${subscriptionField} updated to ${status} for user: ${userId}`);
          }
        } else {
          console.warn('No userId found in subscription metadata');
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        const productType = subscription.metadata?.productType;
        const subscriptionField = getSubscriptionField(productType);
        
        if (userId) {
          console.log(`Deleting subscription for user: ${userId}, productType: ${productType}`);
          const updateData: Record<string, unknown> = {
            [subscriptionField]: 'free',
            ...getProductMetadataClear(productType),
          };
          const { data: userRow } = await supabase
            .from('users')
            .select('stripe_subscription_id')
            .eq('id', userId)
            .single();
          if (userRow?.stripe_subscription_id === subscription.id) {
            updateData.stripe_subscription_id = null;
            updateData.subscription_product_type = null;
          }
          
          const { error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId);
          
          if (error) {
            console.error(`Error updating ${subscriptionField} to free:`, error);
          } else {
            console.log(`${subscriptionField} updated to free for user: ${userId}`);
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceAny = invoice as any;
        const subscriptionId =
          (typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id) ||
          invoiceAny?.subscription_details?.subscription ||
          invoiceAny?.parent?.subscription_details?.subscription ||
          invoiceAny?.lines?.data?.[0]?.parent?.subscription_item_details?.subscription;

        // In newer Stripe payloads, subscription metadata can already be present on invoice
        // even when `invoice.subscription` is not set.
        const metadataUserId =
          invoiceAny?.subscription_details?.metadata?.userId ||
          invoiceAny?.parent?.subscription_details?.metadata?.userId ||
          invoiceAny?.lines?.data?.[0]?.metadata?.userId ||
          invoice.metadata?.userId;
        const metadataProductType =
          invoiceAny?.subscription_details?.metadata?.productType ||
          invoiceAny?.parent?.subscription_details?.metadata?.productType ||
          invoiceAny?.lines?.data?.[0]?.metadata?.productType ||
          invoice.metadata?.productType;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

        console.log('[Webhook] invoice.paid received');
        console.log('[Webhook] Invoice ID:', invoice.id);
        console.log('[Webhook] Subscription ID from invoice:', subscriptionId);
        console.log('[Webhook] User ID from invoice metadata:', metadataUserId);
        console.log('[Webhook] Product type from invoice metadata:', metadataProductType);
        console.log('[Webhook] Customer ID from invoice:', customerId);

        let userId: string | undefined = metadataUserId;
        let productType: string | undefined = metadataProductType;
        const linePriceId =
          invoiceAny?.lines?.data?.[0]?.pricing?.price_details?.price ||
          invoiceAny?.lines?.data?.[0]?.price?.id;

        if (!productType && linePriceId) {
          const analyticsPriceId =
            Deno.env.get('STRIPE_PRICE_ID_PLATFORM') ||
            Deno.env.get('STRIPE_PRICE_ID_ANALYTICS');
          const betinhoPriceId = Deno.env.get('STRIPE_PRICE_ID_BETINHO');

          if (analyticsPriceId && linePriceId === analyticsPriceId) {
            productType = 'analytics';
          } else if (betinhoPriceId && linePriceId === betinhoPriceId) {
            productType = 'betinho';
          }

          console.log('[Webhook] linePriceId from invoice:', linePriceId);
          console.log('[Webhook] productType inferred from price:', productType || 'not inferred');
        }

        if (!userId && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          userId = subscription.metadata?.userId;
          productType = productType || subscription.metadata?.productType;
        }

        // Last fallback: resolve user by stripe_customer_id
        if (!userId && customerId) {
          const { data: userByCustomer, error: findUserError } = await supabase
            .from('users')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (findUserError) {
            console.error('[Webhook] Could not resolve user by stripe_customer_id:', findUserError);
          } else if (userByCustomer?.id) {
            userId = userByCustomer.id;
            console.log('[Webhook] Resolved userId by stripe_customer_id:', userId);
          }
        }

        if (!userId) {
          console.warn('[Webhook] invoice.paid without resolvable userId, skipping');
          break;
        }

        const subscriptionField = getSubscriptionField(productType);

        console.log('[Webhook] Updating field from invoice.paid:', subscriptionField);

        const updateData: Record<string, string> = {};
        updateData[subscriptionField] = 'premium';

        const { data, error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', userId);

        if (error) {
          console.error(`[Webhook] Error updating ${subscriptionField} on invoice.paid:`, error);
        } else {
          console.log(`[Webhook] ✅ ${subscriptionField} updated to premium via invoice.paid for user:`, userId);
          console.log('[Webhook] Updated data:', JSON.stringify(data));
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