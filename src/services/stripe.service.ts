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
    // Garantir que temos uma sessão ativa
    const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
    
    if (!session || sessionError) {
      console.error('No active session found:', sessionError);
      throw new Error('User not authenticated. Please log in first.');
    }

    // Obter a URL e key do Supabase das variáveis de ambiente
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

    console.log('Session found, calling stripe-create-checkout with token');
    console.log('Supabase URL:', supabaseUrl);

    // Usar fetch diretamente para garantir que o token seja enviado
    const response = await fetch(`${supabaseUrl}/functions/v1/stripe-create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ priceId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Error from stripe-create-checkout:', errorData);
      throw new Error(errorData.error || `Failed to create checkout session: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !data.sessionId || !data.url) {
      console.error('Invalid response data:', data);
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
