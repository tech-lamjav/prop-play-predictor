import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import {
  Camera,
  LineChart,
  Megaphone,
  Send,
  Check,
  Loader2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import AnalyticsNav from '../components/AnalyticsNav';
import { telegramBotUsername } from '../config/environment';
import { createClient } from '../integrations/supabase/client';

// Onboarding do Betinho — redesign benefit-led (docs/onboarding-betinho-redesign.md).
// Momento 1: valor (3 benefícios, CTA único). Momento 2: conexão por deep-link com
// token de uso único + polling até o vínculo confirmar — nunca um "Finalizar" cego.
// O telefone continua sendo coletado no cadastro (CRM), mas NÃO participa do vínculo.

type Stage = 'value' | 'connecting' | 'connected' | 'timeout';

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 40; // ~2 min

const BENEFITS = [
  {
    icon: Camera,
    title: 'Registre sem digitar',
    description: 'Manda um print, texto ou áudio da aposta no Telegram — o Betinho entende e registra.',
  },
  {
    icon: LineChart,
    title: 'Seu ROI de verdade',
    description: 'Liquidação, banca e resultado real por esporte — sem planilha, sem autoengano.',
  },
  {
    icon: Megaphone,
    title: 'O dia chega até você',
    description: 'Oportunidades do dia, avisos de resultado e novidades direto no seu Telegram.',
  },
] as const;

export default function Onboarding() {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const [searchParams] = useSearchParams();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('value');
  const [error, setError] = useState('');

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectStartedAt = useRef<number | null>(null);
  const viewedFired = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Auth + estado inicial: quem já está vinculado não refaz o fluxo.
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth', { state: { from: { pathname: '/onboarding' } } });
        return;
      }
      setUserId(user.id);

      const { data: row } = await supabase
        .from('users')
        .select('telegram_chat_id')
        .eq('id', user.id)
        .single();
      const alreadySynced = !!row?.telegram_chat_id;
      if (alreadySynced) setStage('connected');

      if (!viewedFired.current) {
        viewedFired.current = true;
        posthog?.capture('betinho_onboarding_viewed', {
          product: 'betinho',
          source: searchParams.get('src') ?? 'direct',
          already_synced: alreadySynced,
        });
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    let attempts = 0;
    pollTimer.current = setInterval(async () => {
      attempts++;
      const { data: row } = await supabase
        .from('users')
        .select('telegram_chat_id')
        .eq('id', userId!)
        .single();
      if (row?.telegram_chat_id) {
        stopPolling();
        setStage('connected');
        posthog?.capture('betinho_onboarding_synced', {
          product: 'betinho',
          elapsed_s: connectStartedAt.current
            ? Math.round((Date.now() - connectStartedAt.current) / 1000)
            : null,
        });
        return;
      }
      if (attempts >= POLL_MAX_ATTEMPTS) {
        stopPolling();
        setStage('timeout');
      }
    }, POLL_INTERVAL_MS);
  }, [posthog, stopPolling, supabase, userId]);

  const handleConnect = async () => {
    if (!userId) return;
    setError('');
    posthog?.capture('betinho_onboarding_link_clicked', { product: 'betinho' });
    try {
      const { data: token, error: rpcError } = await supabase.rpc('get_telegram_link_token');
      if (rpcError || !token) throw rpcError ?? new Error('token vazio');
      connectStartedAt.current = Date.now();
      window.open(`https://t.me/${telegramBotUsername}?start=link_${token}`, '_blank');
      setStage('connecting');
      startPolling();
    } catch {
      setError('Não consegui gerar seu link agora. Tenta de novo em instantes.');
    }
  };

  const handleWebFallback = () => {
    posthog?.capture('betinho_onboarding_web_fallback', { product: 'betinho' });
    navigate('/bets');
  };

  if (!userId) {
    return (
      <div className="theme-bolao min-h-screen bg-canvas flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-forest animate-spin" />
      </div>
    );
  }

  return (
    <div className="theme-bolao min-h-screen bg-canvas">
      <AnalyticsNav />

      <div className="container mx-auto px-4 py-10 md:py-16 max-w-lg">
        {/* ── Momento 1: valor ─────────────────────────────────── */}
        {stage === 'value' && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-ink mb-2">
                Conheça o Betinho
              </h1>
              <p className="text-[15px] text-ink-2">
                Seu assistente de apostas no Telegram — registro, resultado e as oportunidades do dia num lugar só.
              </p>
            </div>

            <div className="space-y-3 mb-8">
              {BENEFITS.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 bg-white border border-line rounded-xl p-4"
                >
                  <div className="w-10 h-10 rounded-lg bg-forest-tint flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-forest" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
                    <p className="text-[13px] text-ink-2 leading-snug">{description}</p>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <p className="text-[13px] text-status-danger text-center mb-4">{error}</p>
            )}

            <button
              type="button"
              onClick={handleConnect}
              className="w-full h-12 rounded-lg bg-forest hover:bg-forest-soft text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4" />
              Conectar meu Telegram
            </button>
            <p className="text-center text-[12px] text-ink-2 mt-3">
              Abre o Telegram, toca em <strong>Iniciar</strong> e pronto — sem digitar nada.
            </p>

            <div className="text-center mt-6">
              <button
                type="button"
                onClick={handleWebFallback}
                className="text-[13px] text-ink-2 underline underline-offset-2 hover:text-ink transition-colors"
              >
                Não uso Telegram — registrar pela web
              </button>
            </div>
          </>
        )}

        {/* ── Momento 2: aguardando conexão ────────────────────── */}
        {stage === 'connecting' && (
          <div className="text-center pt-8">
            <div className="mx-auto w-14 h-14 rounded-full bg-forest-tint flex items-center justify-center mb-5">
              <Loader2 className="w-7 h-7 text-forest animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-ink mb-2">Aguardando o Telegram…</h1>
            <p className="text-[14px] text-ink-2 mb-6 max-w-sm mx-auto">
              No Telegram que abriu, toca em <strong>Iniciar</strong> (/start). Assim que conectar, esta tela confirma sozinha.
            </p>
            <button
              type="button"
              onClick={handleConnect}
              className="text-[13px] text-forest font-semibold underline underline-offset-2"
            >
              O Telegram não abriu? Gerar link de novo
            </button>
          </div>
        )}

        {/* ── Conectado ────────────────────────────────────────── */}
        {stage === 'connected' && (
          <div className="text-center pt-8">
            <div className="mx-auto w-14 h-14 rounded-full bg-forest flex items-center justify-center mb-5">
              <Check className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-ink mb-2">Conectado!</h1>
            <p className="text-[14px] text-ink-2 mb-8 max-w-sm mx-auto">
              O Betinho já te mandou uma mensagem — <strong>manda sua primeira aposta pra ele</strong> (print ou texto) e ela aparece aqui na hora.
            </p>
            <button
              type="button"
              onClick={() => navigate('/bets')}
              className="w-full h-12 rounded-lg bg-forest hover:bg-forest-soft text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              Ver minhas apostas
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Timeout do polling ───────────────────────────────── */}
        {stage === 'timeout' && (
          <div className="text-center pt-8">
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-5">
              <RefreshCw className="w-7 h-7 text-amber-600" />
            </div>
            <h1 className="text-xl font-bold text-ink mb-2">Ainda não conectou</h1>
            <p className="text-[14px] text-ink-2 mb-6 max-w-sm mx-auto">
              Sem problema — clica de novo abaixo e toca em <strong>Iniciar</strong> no Telegram.
            </p>
            {error && (
              <p className="text-[13px] text-status-danger mb-4">{error}</p>
            )}
            <button
              type="button"
              onClick={handleConnect}
              className="w-full h-12 rounded-lg bg-forest hover:bg-forest-soft text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4" />
              Tentar de novo
            </button>
            <div className="text-center mt-6">
              <button
                type="button"
                onClick={handleWebFallback}
                className="text-[13px] text-ink-2 underline underline-offset-2 hover:text-ink transition-colors"
              >
                Registrar pela web
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
