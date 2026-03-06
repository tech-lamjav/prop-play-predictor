import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader =
      req.headers.get('Authorization') ||
      req.headers.get('authorization') ||
      req.headers.get('x-authorization');

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
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { filters } = body;

    if (!filters || typeof filters !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid filters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appBaseUrl = Deno.env.get('APP_BASE_URL') || Deno.env.get('SITE_URL') || 'https://smartbetting.app';

    const { data: row, error: insertError } = await supabase
      .from('share_links')
      .insert({
        user_id: user.id,
        filters_snapshot: filters,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error inserting share link:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create share link', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const shareToken = row.id;
    const url = `${appBaseUrl.replace(/\/$/, '')}/share/${shareToken}`;

    return new Response(
      JSON.stringify({ token: shareToken, url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Share create error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
