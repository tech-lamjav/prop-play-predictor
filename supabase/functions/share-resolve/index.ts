import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BET_COLUMNS = 'id,bet_date,sport,league,bet_description,odds,stake_amount,potential_return,status,cashout_amount,cashout_odds,is_cashout,bet_type,betting_market';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let token: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      token = url.searchParams.get('token');
    } else {
      const body = await req.json().catch(() => ({}));
      token = body.token ?? null;
    }

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: shareLink, error: linkError } = await supabase
      .from('share_links')
      .select('user_id, filters_snapshot, expires_at')
      .eq('id', token)
      .single();

    if (linkError || !shareLink) {
      return new Response(
        JSON.stringify({ error: 'Link não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Este link expirou' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = shareLink.user_id;
    const filters = shareLink.filters_snapshot as Record<string, unknown> || {};

    const { data: userRow } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    const ownerName = userRow?.name || 'Usuário';

    let betIdsWithTags: string[] | null = null;
    const tags = filters.tags as string[] | undefined;
    if (tags && Array.isArray(tags) && tags.length > 0) {
      const { data: taggedBets } = await supabase
        .from('bet_tags')
        .select('bet_id')
        .in('tag_id', tags);
      if (taggedBets && taggedBets.length > 0) {
        betIdsWithTags = [...new Set(taggedBets.map((r: { bet_id: string }) => r.bet_id))];
      } else {
        betIdsWithTags = [];
      }
    }

    let query = supabase
      .from('bets')
      .select(BET_COLUMNS)
      .eq('user_id', userId)
      .order('bet_date', { ascending: false })
      .limit(500);

    const status = filters.status as string[] | undefined;
    if (status && Array.isArray(status) && status.length > 0) {
      query = query.in('status', status);
    }

    const sports = filters.sports as string[] | undefined;
    if (sports && Array.isArray(sports) && sports.length > 0) {
      const sportValues = sports.filter((v: string) => v !== '__empty__');
      const includeEmpty = sports.includes('__empty__');
      if (sportValues.length > 0 && !includeEmpty) {
        query = query.in('sport', sportValues);
      } else if (sportValues.length > 0 && includeEmpty) {
        query = query.or(`sport.in.(${sportValues.join(',')}),sport.is.null`);
      } else if (includeEmpty) {
        query = query.is('sport', null);
      }
    }

    const leagues = filters.leagues as string[] | undefined;
    if (leagues && Array.isArray(leagues) && leagues.length > 0) {
      const leagueValues = leagues.filter((v: string) => v !== '__empty__');
      const includeEmpty = leagues.includes('__empty__');
      if (leagueValues.length > 0 && !includeEmpty) {
        query = query.in('league', leagueValues);
      } else if (leagueValues.length > 0 && includeEmpty) {
        query = query.or(`league.in.(${leagueValues.join(',')}),league.is.null`);
      } else if (includeEmpty) {
        query = query.is('league', null);
      }
    }

    const markets = filters.markets as string[] | undefined;
    if (markets && Array.isArray(markets) && markets.length > 0) {
      const marketValues = markets.filter((v: string) => v !== '__empty__');
      const includeEmpty = markets.includes('__empty__');
      if (marketValues.length > 0 && !includeEmpty) {
        query = query.in('betting_market', marketValues);
      } else if (marketValues.length > 0 && includeEmpty) {
        query = query.or(`betting_market.in.(${marketValues.join(',')}),betting_market.is.null`);
      } else if (includeEmpty) {
        query = query.is('betting_market', null);
      }
    }

    const dateFrom = filters.date_from as string | undefined;
    if (dateFrom) {
      query = query.gte('bet_date', dateFrom);
    }

    const dateTo = filters.date_to as string | undefined;
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte('bet_date', endOfDay.toISOString());
    }

    const search = filters.search as string | undefined;
    if (search && typeof search === 'string' && search.trim()) {
      const term = `*${search.trim()}*`;
      query = query.or(`bet_description.ilike.${term},match_description.ilike.${term},league.ilike.${term},betting_market.ilike.${term}`);
    }

    if (betIdsWithTags !== null) {
      if (betIdsWithTags.length === 0) {
        return new Response(
          JSON.stringify({
            owner: { name: ownerName },
            filters_snapshot: filters,
            bets: [],
            total: 0,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      query = query.in('id', betIdsWithTags);
    }

    const { data: bets, error: betsError } = await query;

    if (betsError) {
      console.error('Error fetching bets:', betsError);
      return new Response(
        JSON.stringify({ error: 'Erro ao carregar apostas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const betsList = bets || [];
    const multipleBetIds = betsList
      .filter((b: { bet_type: string }) => b.bet_type === 'multiple' || b.bet_type === 'multipla')
      .map((b: { id: string }) => b.id);

    const betLegsMap: Record<string, unknown[]> = {};
    if (multipleBetIds.length > 0) {
      const { data: legs } = await supabase
        .from('bet_legs')
        .select('bet_id,leg_number,sport,match_description,bet_description,odds,status')
        .in('bet_id', multipleBetIds)
        .order('leg_number', { ascending: true });

      if (legs) {
        for (const leg of legs) {
          const bid = (leg as { bet_id: string }).bet_id;
          if (!betLegsMap[bid]) betLegsMap[bid] = [];
          betLegsMap[bid].push(leg);
        }
      }
    }

    const betsWithLegs = betsList.map((bet: Record<string, unknown>) => {
      const b = { ...bet };
      if (betLegsMap[bet.id as string]) {
        (b as Record<string, unknown>).bet_legs = betLegsMap[bet.id as string];
      }
      return b;
    });

    return new Response(
      JSON.stringify({
        owner: { name: ownerName },
        filters_snapshot: filters,
        bets: betsWithLegs,
        total: betsWithLegs.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Share resolve error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
