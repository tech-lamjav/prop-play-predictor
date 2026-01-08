import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

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
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        console.log('[Webhook] Checkout session completed');
        console.log('[Webhook] Session ID:', session.id);
        console.log('[Webhook] Session metadata:', JSON.stringify(session.metadata));
        console.log('[Webhook] UserId from metadata:', userId);
        
        if (userId) {
          // Buscar a subscription criada para obter o tipo
          if (session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
            const subscriptionType = subscription.metadata?.subscriptionType || 'betinho';
            
            const statusField = subscriptionType === 'platform' 
              ? 'subscription_platform_status' 
              : 'subscription_betinho_status';
            
            console.log(`[Webhook] Updating ${statusField} to premium for user:`, userId);
            const { data, error } = await supabase
              .from('users')
              .update({ [statusField]: 'premium' })
              .eq('id', userId);
            
            if (error) {
              console.error('[Webhook] Error updating subscription status:', error);
              console.error('[Webhook] Error details:', JSON.stringify(error));
            } else {
              console.log(`[Webhook] ✅ ${statusField} updated to premium for user:`, userId);
              console.log('[Webhook] Updated data:', JSON.stringify(data));
            }
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
        const subscriptionType = subscription.metadata?.subscriptionType || 'betinho';
        
        console.log(`Subscription ${event.type} - userId: ${userId}, type: ${subscriptionType}, status: ${subscription.status}`);
        
        if (userId) {
          const statusField = subscriptionType === 'platform' 
            ? 'subscription_platform_status' 
            : 'subscription_betinho_status';
          
          const status = subscription.status === 'active' ? 'premium' : 'free';
          
          const { data, error } = await supabase
            .from('users')
            .update({ [statusField]: status })
            .eq('id', userId);
          
          if (error) {
            console.error('Error updating subscription status:', error);
          } else {
            console.log(`${statusField} updated to ${status} for user: ${userId}`);
          }
        } else {
          console.warn('No userId found in subscription metadata');
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        const subscriptionType = subscription.metadata?.subscriptionType || 'betinho';
        
        console.log(`Subscription deleted - userId: ${userId}, type: ${subscriptionType}`);
        
        if (userId) {
          const statusField = subscriptionType === 'platform' 
            ? 'subscription_platform_status' 
            : 'subscription_betinho_status';
          
          const { data, error } = await supabase
            .from('users')
            .update({ [statusField]: 'free' })
            .eq('id', userId);
          
          if (error) {
            console.error('Error updating subscription status:', error);
          } else {
            console.log(`${statusField} updated to free for user: ${userId}`);
          }
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