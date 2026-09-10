import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";
import { camposDoPlano, statusDoPlano } from "../shared/concessoes.ts";

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
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
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

    const { sessionId } = await req.json();
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[VerifySession] Retrieving Stripe session:', sessionId);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      console.log('[VerifySession] Payment not completed. Status:', session.payment_status);
      return new Response(
        JSON.stringify({ verified: false, status: session.payment_status }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metadataUserId = session.metadata?.userId;
    if (metadataUserId !== user.id) {
      console.error('[VerifySession] userId mismatch:', metadataUserId, '!=', user.id);
      return new Response(
        JSON.stringify({ error: 'Session does not belong to this user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mesma fonte de verdade do stripe-webhook (`shared/concessoes.ts`): se os
    // dois divergirem, o usuário ganha um acesso na volta do checkout e perde
    // outro quando o webhook chega.
    const productType = session.metadata?.productType;
    const campos = camposDoPlano(productType);

    console.log('[VerifySession] Payment verified. Concedendo:', campos.join(', '), 'para user:', user.id);

    const updateData = statusDoPlano(productType, 'premium');

    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('[VerifySession] Error updating subscription:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update subscription' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[VerifySession] ✅ ${campos.join(', ')} updated to premium`);

    return new Response(
      JSON.stringify({ verified: true, granted: campos, status: 'premium' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[VerifySession] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
