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
  // Tratar OPTIONS primeiro, antes de qualquer verificação
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request received');
    return new Response('ok', { headers: corsHeaders });
  }
  
  console.log('Non-OPTIONS request received:', req.method);

  try {
    // Debug: verificar todos os headers
    const allHeaders = Object.fromEntries(req.headers.entries());
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    console.log('All headers keys:', Object.keys(allHeaders));
    
    // Verificar autenticação - tentar múltiplas formas
    const authHeader = 
      req.headers.get('Authorization') || 
      req.headers.get('authorization') ||
      req.headers.get('x-authorization') ||
      allHeaders['authorization'] ||
      allHeaders['Authorization'];
    
    console.log('Authorization header found:', !!authHeader);
    if (authHeader) {
      console.log('Authorization header value (first 20 chars):', authHeader.substring(0, 20) + '...');
    }
    
    if (!authHeader) {
      console.error('Missing authorization header. All headers:', allHeaders);
      return new Response(
        JSON.stringify({ error: 'Missing authorization header', receivedHeaders: Object.keys(allHeaders) }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SUPABASE_URL is automatically provided by Supabase Edge Functions
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    console.log('Token extracted, length:', token.length);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id, user.email);

    // Obter dados do body
    const body = await req.json();
    console.log('Request body:', body);
    const { priceId, returnPath } = body;
    
    if (!priceId) {
      console.error('Missing priceId in body');
      return new Response(
        JSON.stringify({ error: 'Missing priceId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Price ID received:', priceId);
    console.log('Return path received:', returnPath);

    // SITE_URL is the frontend URL for redirects (configured in Edge Function secrets)
    const SITE_URL = Deno.env.get('SITE_URL') || 'http://localhost:8080';

    // Mapear returnPath para rota
    const routeMap: Record<string, string> = {
      'betinho': '/paywall',
      'platform': '/paywall-platform'
    };

    const returnRoute = returnPath ? (routeMap[returnPath] || '/paywall') : '/paywall';
    console.log('Mapped return route:', returnRoute);

    // Mapear returnPath para subscriptionType
    const subscriptionTypeMap: Record<string, string> = {
      'betinho': 'betinho',
      'platform': 'platform'
    };

    const subscriptionType = returnPath ? (subscriptionTypeMap[returnPath] || 'betinho') : 'betinho';
    console.log('Subscription type:', subscriptionType);

    // Criar ou buscar customer no Stripe (necessário para Accounts V2)
    let customerId: string;
    
    // Verificar se já existe um customer_id salvo no metadata do usuário
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (userData?.stripe_customer_id) {
      // Usar customer existente
      customerId = userData.stripe_customer_id;
    } else {
      // Criar novo customer no Stripe
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: {
          userId: user.id,
        },
      });
      customerId = customer.id;

      // Salvar customer_id no banco de dados
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    console.log('Creating Stripe checkout session with customer:', customerId);

    // Criar sessão de checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId, // Usar customer_id ao invés de customer_email
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription', // ou 'payment' para pagamento único
      success_url: `${SITE_URL}${returnRoute}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}${returnRoute}?canceled=true`,
      metadata: {
        userId: user.id,
        userEmail: user.email || '',
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          subscriptionType: subscriptionType, // Adicionar tipo de subscription
        },
      },
    });

    console.log('Stripe checkout session created:', session.id);
    console.log('Checkout URL:', session.url);

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