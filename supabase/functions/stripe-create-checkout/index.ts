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
    const { priceId, productType } = body;
    
    if (!priceId) {
      console.error('Missing priceId in body');
      return new Response(
        JSON.stringify({ error: 'Missing priceId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize product type (backward compatibility for legacy values)
    const normalizedProductType = String(productType || 'betinho').trim().toLowerCase();
    const referer = req.headers.get('referer') || '';
    const analyticsPriceIds = [
      Deno.env.get('STRIPE_PRICE_ID_PLATFORM'),
      Deno.env.get('STRIPE_PRICE_ID_ANALYTICS'),
    ].filter(Boolean) as string[];

    let finalProductType: 'analytics' | 'betinho';
    if (normalizedProductType === 'analytics' || normalizedProductType === 'platform') {
      finalProductType = 'analytics';
    } else if (analyticsPriceIds.includes(priceId)) {
      finalProductType = 'analytics';
    } else if (referer.includes('/paywall-platform')) {
      finalProductType = 'analytics';
    } else {
      finalProductType = 'betinho';
    }

    console.log('Price ID received:', priceId);
    console.log('Product Type received:', normalizedProductType);
    console.log('Referer:', referer || 'n/a');
    console.log('Product Type resolved:', finalProductType);

    // Use SITE_URL for frontend redirects, fallback to SUPABASE_URL for local dev
    const SITE_URL = Deno.env.get('SITE_URL') || Deno.env.get('SUPABASE_URL') || 'http://localhost:8080';
    console.log('Using SITE_URL:', SITE_URL);

    // Criar ou buscar customer no Stripe (necessário para Accounts V2)
    let customerId: string;
    
    // 1. Verificar se já existe um customer_id salvo no nosso banco
    const { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (userData?.stripe_customer_id) {
      // Usar customer existente do nosso banco
      customerId = userData.stripe_customer_id;
      console.log('Using existing customer from database:', customerId);
    } else if (user.email) {
      // 2. Buscar no Stripe se já existe um customer com este email
      console.log('Searching for existing Stripe customer by email:', user.email);
      const existingCustomers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        // Usar customer existente do Stripe
        customerId = existingCustomers.data[0].id;
        console.log('Found existing Stripe customer:', customerId);
        
        // Atualizar metadata do customer existente com o userId
        await stripe.customers.update(customerId, {
          metadata: {
            userId: user.id,
          },
        });
      } else {
        // 3. Criar novo customer no Stripe (não existe em lugar nenhum)
        console.log('Creating new Stripe customer for email:', user.email);
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id,
          },
        });
        customerId = customer.id;
        console.log('Created new Stripe customer:', customerId);
      }

      // Salvar customer_id no nosso banco de dados
      const { error: updateError } = await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
      
      if (updateError) {
        console.error('Error saving stripe_customer_id to database:', updateError);
      } else {
        console.log('Saved stripe_customer_id to database');
      }
    } else {
      // Usuário sem email - criar customer sem email
      console.log('Creating new Stripe customer without email');
      const customer = await stripe.customers.create({
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

    // Redirect to the correct paywall route per product
    const paywallPath = finalProductType === 'analytics' ? '/paywall-platform' : '/paywall';
    const successUrl = `${SITE_URL}${paywallPath}?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${SITE_URL}${paywallPath}?canceled=true`;
    console.log('Selected paywallPath:', paywallPath);
    console.log('Success URL:', successUrl);
    console.log('Cancel URL:', cancelUrl);

    // Criar sessão de checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId, // Usar customer_id ao invés de customer_email
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription', // ou 'payment' para pagamento único
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: user.id,
        userEmail: user.email || '',
        productType: finalProductType, // Add productType to session metadata
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          productType: finalProductType, // Add productType to subscription metadata
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