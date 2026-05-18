/** @jsxImportSource https://esm.sh/react@18.2.0 */
// @ts-nocheck — Deno edge function. TS check rodado pelo deploy do Supabase.
//
// OG image dinâmica pra bolão.
// Usado em <meta property="og:image"> nos links de convite — quando alguém
// cola o link no WhatsApp/Telegram/LinkedIn, vê preview rico com info do bolão.
//
// Endpoint: GET /functions/v1/og-bolao?invite=ABC12345
// Response: PNG 1200x630 (formato OG padrão)

import { ImageResponse } from 'https://deno.land/x/og_edge@0.0.6/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const CACHE_HEADER = 'public, max-age=3600, s-maxage=3600'; // 1h cache

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const invite = url.searchParams.get('invite');

    if (!invite) {
      return new Response('Missing invite param', { status: 400 });
    }

    // Busca info do bolão (publicly readable via RLS or via service)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: bolao } = await supabase
      .from('boloes')
      .select('id, name, is_premium')
      .eq('invite_code', invite.toUpperCase())
      .maybeSingle();

    // Se não achou, retorna OG genérico
    const bolaoName = bolao?.name ?? 'Bolão Copa 2026';
    const isPremium = bolao?.is_premium ?? false;

    // Conta participantes (best effort)
    let memberCount = 0;
    if (bolao?.id) {
      const { count } = await supabase
        .from('bolao_members')
        .select('*', { count: 'exact', head: true })
        .eq('bolao_id', bolao.id);
      memberCount = count ?? 0;
    }

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            backgroundImage: 'linear-gradient(135deg, #050a14 0%, #0f1a2e 45%, #0a1628 100%)',
            color: '#e8eef0',
            fontFamily: 'sans-serif',
            padding: '60px',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: 18, fontWeight: 'bold', color: '#3b82f6', letterSpacing: '4px' }}>
                  BOLÃO · COPA 2026
                </span>
                {isPremium && (
                  <span style={{
                    fontSize: 12, fontWeight: 'bold', color: '#0a1628',
                    background: '#facc15', padding: '4px 8px', borderRadius: '4px',
                    letterSpacing: '1px',
                  }}>
                    PREMIUM
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 72, fontWeight: 900, lineHeight: 1.1,
                maxWidth: '800px', wordBreak: 'break-word',
              }}>
                {bolaoName}
              </div>
            </div>
            <div style={{
              fontSize: 80,
              filter: 'drop-shadow(0 0 20px rgba(250,204,21,0.4))',
            }}>
              🏆
            </div>
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }}></div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '32px', alignItems: 'baseline', marginBottom: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 48, fontWeight: 900, color: '#10b981' }}>104</span>
              <span style={{ fontSize: 14, opacity: 0.6, letterSpacing: '2px' }}>JOGOS</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 48, fontWeight: 900, color: '#3b82f6' }}>{memberCount}</span>
              <span style={{ fontSize: 14, opacity: 0.6, letterSpacing: '2px' }}>
                {memberCount === 1 ? 'JOGADOR' : 'JOGADORES'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 48, fontWeight: 900, color: '#facc15' }}>48</span>
              <span style={{ fontSize: 14, opacity: 0.6, letterSpacing: '2px' }}>SELEÇÕES</span>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 18, opacity: 0.7, letterSpacing: '2px', marginBottom: '4px' }}>
                ENTRE EM:
              </span>
              <span style={{ fontSize: 28, fontWeight: 'bold', color: '#3b82f6', fontFamily: 'monospace' }}>
                smartbetting.app/bolao/entrar/{invite.toUpperCase()}
              </span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 'bold', opacity: 0.7, letterSpacing: '2px' }}>
              SMARTBETTING
            </span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': CACHE_HEADER,
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    console.error('og-bolao error:', err);
    return new Response('Error generating image', { status: 500 });
  }
});
