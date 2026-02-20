import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET') || '';

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
      // Default to 'betinho' if productType is not specified (backward compatibility)
      const product = (productType || 'betinho').toLowerCase();
      if (product === 'analytics' || product === 'platform') {
        return 'analytics_subscription_status';
      }
      return 'betinho_subscription_status';
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const productType = session.metadata?.productType;
        const subscriptionField = getSubscriptionField(productType);
        
        console.log('[Webhook] Checkout session completed');
        console.log('[Webhook] Session ID:', session.id);
        console.log('[Webhook] Session metadata:', JSON.stringify(session.metadata));
        console.log('[Webhook] UserId from metadata:', userId);
        console.log('[Webhook] ProductType from metadata:', productType);
        console.log('[Webhook] Updating field:', subscriptionField);
        
        if (userId) {
          console.log(`[Webhook] Updating ${subscriptionField} to premium for user:`, userId);
          const updateData: Record<string, string> = {};
          updateData[subscriptionField] = 'premium';
          
          const { data, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId);
          
          if (error) {
            console.error('[Webhook] Error updating subscription status:', error);
            console.error('[Webhook] Error details:', JSON.stringify(error));
          } else {
            console.log(`[Webhook] ✅ ${subscriptionField} updated to premium for user:`, userId);
            console.log('[Webhook] Updated data:', JSON.stringify(data));
          }
        } else {
          console.warn('[Webhook] ⚠️ No userId found in session metadata');
          console.warn('[Webhook] Full session object:', JSON.stringify(session, null, 2));
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
          const updateData: Record<string, unknown> = {};
          updateData[subscriptionField] = status;
          updateData.stripe_subscription_id = subscription.id;
          updateData.subscription_product_type = productType || 'betinho';
          updateData.subscription_period_end = subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null;
          updateData.subscription_cancel_at = subscription.cancel_at
            ? new Date(subscription.cancel_at * 1000).toISOString()
            : null;
          updateData.subscription_cancel_at_period_end = subscription.cancel_at_period_end ?? false;
          
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
          const updateData: Record<string, unknown> = {};
          updateData[subscriptionField] = 'free';
          const { data: userRow } = await supabase
            .from('users')
            .select('stripe_subscription_id')
            .eq('id', userId)
            .single();
          if (userRow?.stripe_subscription_id === subscription.id) {
            updateData.stripe_subscription_id = null;
            updateData.subscription_period_end = null;
            updateData.subscription_cancel_at = null;
            updateData.subscription_cancel_at_period_end = false;
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