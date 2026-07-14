import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import useEmblaCarousel from 'embla-carousel-react';
import {
  Camera,
  LineChart,
  Megaphone,
  Send,
  Check,
  Loader2,
  ArrowRight,
  RefreshCw,
  Image as ImageIcon,
  Flame,
  TrendingUp,
} from 'lucide-react';
import AnalyticsNav from '../components/AnalyticsNav';
import { telegramBotUsername } from '../config/environment';
import { createClient } from '../integrations/supabase/client';

// Onboarding do Betinho — redesign benefit-led (docs/onboarding-betinho-redesign.md).
// Momento 1: valor (gancho + carrossel do que a conexão entrega). Momento 2: conexão por
// deep-link com token de uso único + polling até confirmar. Telefone fica no cadastro (CRM),
// mas não participa do vínculo.

type Stage = 'value' | 'connecting' | 'connected' | 'timeout';

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 40; // ~2 min

const BENEFITS = [
  {
    icon: Camera,
    title: 'Registra pelo print',
    description: 'Manda um print ou escreve a aposta. O Betinho lê e registra sozinho.',
  },
  {
    icon: LineChart,
    title: 'Seu ROI de verdade',
    description: 'Liquidação, banca e resultado real por esporte, sem planilha.',
  },
  {
    icon: Megaphone,
    title: 'O dia chega no seu chat',
    description: 'Oportunidades do dia, avisos de resultado e novidades no Telegram.',
  },
] as const;

// ── Carrossel de mocks NATIVOS (não são screenshots) ──────────────────────
// Mostra o que a conexão ENTREGA: registrar pelo print, oportunidade do dia, resultado.

function ChatFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
      <div className="flex items-center gap-2.5 border-b border-line bg-white px-4 py-3">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-forest text-[13px] font-bold text-white">B</div>
        <div>
          <p className="text-[13px] font-semibold leading-none text-ink">Betinho</p>
          <p className="mt-1 flex items-center gap-1 text-[11px] leading-none text-status-success">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-status-success" /> online
          </p>
        </div>
      </div>
      <div className="min-h-[220px] space-y-2.5 bg-canvas px-3 py-4">{children}</div>
    </div>
  );
}

// Slide 1 — registrar mandando o PRINT (a ação de maior afinidade)
function SlidePrint() {
  return (
    <ChatFrame>
      <div className="flex justify-end">
        <div className="max-w-[82%] overflow-hidden rounded-2xl rounded-br-sm border border-forest/20 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-forest to-forest-soft px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white">
            <ImageIcon className="h-3.5 w-3.5" /> Comprovante
          </div>
          <div className="space-y-1 px-3 py-2 text-[12px]">
            <div className="font-semibold text-ink">Flamengo x Palmeiras</div>
            <div className="flex justify-between text-ink-2"><span>Flamengo vence</span><span className="font-semibold text-ink">1.85</span></div>
            <div className="flex justify-between text-ink-2"><span>Aposta</span><span className="font-semibold text-ink">R$ 50,00</span></div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 pr-2 text-[10px] text-ink-2">
        <ImageIcon className="h-3 w-3" /> print enviado
      </div>
      <div className="flex justify-start">
        <div className="max-w-[86%] rounded-2xl rounded-bl-sm border border-line bg-white px-3.5 py-2.5 shadow-sm">
          <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-status-success">
            <Check className="h-4 w-4" /> Li o print e registrei!
          </div>
          <div className="text-[12px] text-ink-2">
            Retorno potencial <span className="font-semibold text-forest">R$ 92,50</span>
          </div>
        </div>
      </div>
    </ChatFrame>
  );
}

// Slide 2 — a oportunidade do dia chega no chat
function SlideOpportunity() {
  return (
    <ChatFrame>
      <div className="flex justify-start">
        <div className="w-full max-w-[92%] overflow-hidden rounded-2xl rounded-bl-sm border border-amber/30 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 bg-amber/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-2">
            <Flame className="h-3.5 w-3.5" /> Oportunidade de hoje
          </div>
          <div className="space-y-2 px-3 py-2.5">
            <div className="text-[13px] font-semibold text-ink">Palmeiras x Corinthians</div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-ink-2">Mais de 2.5 gols</span>
              <span className="rounded-md bg-forest px-2 py-0.5 text-[11px] font-bold text-white">Score 82</span>
            </div>
            <div className="flex items-center gap-1 text-[12px] font-semibold text-status-success">
              <TrendingUp className="h-3.5 w-3.5" /> valor +14% na odd
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-start">
        <div className="rounded-2xl rounded-bl-sm border border-line bg-white px-3.5 py-2 text-[12px] text-ink-2 shadow-sm">
          Quer registrar? Só mandar aqui.
        </div>
      </div>
    </ChatFrame>
  );
}

// Slide 3 — o resultado liquidado, automático
function SlideResult() {
  return (
    <ChatFrame>
      <div className="flex justify-start">
        <div className="w-full max-w-[92%] overflow-hidden rounded-2xl rounded-bl-sm border border-status-success/30 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 bg-status-success/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-status-success">
            <Check className="h-3.5 w-3.5" /> Bateu!
          </div>
          <div className="space-y-1.5 px-3 py-2.5">
            <div className="text-[13px] font-semibold text-ink">Flamengo venceu o Palmeiras</div>
            <div className="text-[20px] font-extrabold text-status-success">+ R$ 42,50</div>
            <div className="flex items-center justify-between rounded-lg bg-canvas-2/60 px-2.5 py-1.5 text-[12px]">
              <span className="text-ink-2">ROI do mês</span>
              <span className="font-bold text-forest">+12%</span>
            </div>
          </div>
        </div>
      </div>
    </ChatFrame>
  );
}

const SLIDES = [
  { key: 'print', label: 'Registre só mandando o print', node: <SlidePrint /> },
  { key: 'opp', label: 'As oportunidades do dia chegam a você', node: <SlideOpportunity /> },
  { key: 'result', label: 'E o resultado é liquidado sozinho', node: <SlideResult /> },
] as const;

function BetinhoCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'center' });
  const [selected, setSelected] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const play = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => emblaApi?.scrollNext(), 4500);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    onSelect();
    play();
    return () => {
      emblaApi.off('select', onSelect);
      if (timer.current) clearInterval(timer.current);
    };
  }, [emblaApi, play]);

  // clicar num dot leva ao slide e reinicia o autoplay (não fica "pulando" sozinho)
  const goTo = (i: number) => {
    emblaApi?.scrollTo(i);
    play();
  };

  return (
    <div className="w-full max-w-[380px]">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {SLIDES.map((s) => (
            <div key={s.key} className="min-w-0 flex-[0_0_100%] px-1">
              {s.node}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-5 min-h-[40px] text-center text-[14px] font-medium text-white/90">
        {SLIDES[selected]?.label}
      </p>

      <div className="mt-2 flex justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            aria-label={`Ir para o slide ${i + 1}`}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all ${i === selected ? 'w-6 bg-amber' : 'w-2 bg-white/30'}`}
          />
        ))}
      </div>
    </div>
  );
}

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

  const handleSkip = () => {
    posthog?.capture('betinho_onboarding_skipped', { product: 'betinho' });
    navigate('/bets');
  };

  if (!userId) {
    return (
      <div className="theme-bolao min-h-screen bg-canvas flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-forest animate-spin" />
      </div>
    );
  }

  // ── Momento 1: valor ──────────────────────────────────────────────────────
  // Desktop: 2 colunas (texto à esquerda centralizado, carrossel forest à direita).
  // Mobile: gancho → carrossel → benefícios + CTA (carrossel alto, CTA logo abaixo).
  if (stage === 'value') {
    return (
      <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
        <AnalyticsNav variant="rebrand" />
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 max-w-screen-2xl mx-auto w-full">
          {/* Gancho */}
          <div className="order-1 px-6 pt-10 sm:px-10 lg:col-start-1 lg:row-start-1 lg:self-end lg:px-16 lg:pt-0">
            <div className="mx-auto max-w-md lg:mx-0">
              <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-forest">
                Conheça o Betinho
              </div>
              <h1 className="mb-4 font-display text-[32px] font-extrabold leading-[1.08] tracking-tight text-ink lg:text-[42px]">
                Seu assistente de apostas, direto no <span className="text-amber">Telegram.</span>
              </h1>
              <p className="text-[15px] leading-relaxed text-ink-2">
                Você manda a aposta por print ou texto e o Betinho registra sozinho. Ele calcula
                seu ROI de verdade e ainda te avisa das oportunidades do dia, no chat onde você já conversa.
              </p>
            </div>
          </div>

          {/* Carrossel — no mobile é um card arredondado com respiro (não faixa colada);
              no desktop vira o painel full-height da coluna direita. */}
          <div className="relative order-2 mx-4 my-6 flex items-center justify-center overflow-hidden rounded-3xl bg-forest px-6 py-10 lg:mx-0 lg:my-0 lg:rounded-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:py-20">
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-amber/10" aria-hidden />
            <div className="pointer-events-none absolute -left-16 bottom-10 h-64 w-64 rounded-full bg-white/5" aria-hidden />
            <div className="relative z-10 flex w-full justify-center">
              <BetinhoCarousel />
            </div>
          </div>

          {/* Benefícios + CTA */}
          <div className="order-3 px-6 pb-12 sm:px-10 lg:col-start-1 lg:row-start-2 lg:self-start lg:px-16 lg:pt-6 lg:pb-20">
            <div className="mx-auto max-w-md lg:mx-0">
              <div className="mb-7 space-y-3.5">
                {BENEFITS.map(({ icon: Icon, title, description }) => (
                  <div key={title} className="flex items-start gap-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-forest-tint">
                      <Icon className="h-4 w-4 text-forest" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold leading-tight text-ink">{title}</h3>
                      <p className="text-[13px] leading-snug text-ink-2">{description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {error && <p className="mb-4 text-[13px] text-status-danger">{error}</p>}

              <button
                type="button"
                onClick={handleConnect}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-forest text-[16px] font-bold text-white shadow-lg shadow-forest/20 transition-colors hover:bg-forest-soft"
              >
                <Send className="h-5 w-5" />
                Conectar meu Telegram
              </button>
              <p className="mt-3 text-center text-[12px] text-ink-2">
                Abre o Telegram, toca em <strong>Iniciar</strong> e pronto. Sem digitar nada.
              </p>

              <button
                type="button"
                onClick={handleSkip}
                className="mt-5 flex w-full items-center justify-center gap-1 rounded-lg border border-line bg-canvas-2 py-2.5 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-line/60 hover:text-ink"
              >
                Pular por agora
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Demais momentos (connecting / connected / timeout) — centralizado ─────
  return (
    <div className="theme-bolao min-h-screen bg-canvas">
      <AnalyticsNav variant="rebrand" />
      <div className="container mx-auto px-4 py-10 md:py-16 max-w-lg">
        {stage === 'connecting' && (
          <div className="text-center pt-8">
            <div className="mx-auto w-14 h-14 rounded-full bg-forest-tint flex items-center justify-center mb-5">
              <Loader2 className="w-7 h-7 text-forest animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-ink mb-2">Aguardando o Telegram…</h1>
            <p className="text-[14px] text-ink-2 mb-6 max-w-sm mx-auto">
              No Telegram que abriu, toca em <strong>Iniciar</strong>. Assim que conectar, esta tela confirma sozinha.
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

        {stage === 'connected' && (
          <div className="text-center pt-8">
            <div className="mx-auto w-14 h-14 rounded-full bg-forest flex items-center justify-center mb-5">
              <Check className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-ink mb-2">Conectado!</h1>
            <p className="text-[14px] text-ink-2 mb-8 max-w-sm mx-auto">
              O Betinho já te mandou uma mensagem. Manda a sua primeira aposta pra ele (print ou texto)
              e ela aparece aqui na hora.
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

        {stage === 'timeout' && (
          <div className="text-center pt-8">
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-5">
              <RefreshCw className="w-7 h-7 text-amber-600" />
            </div>
            <h1 className="text-xl font-bold text-ink mb-2">Ainda não conectou</h1>
            <p className="text-[14px] text-ink-2 mb-6 max-w-sm mx-auto">
              Sem problema. Clica de novo abaixo e toca em <strong>Iniciar</strong> no Telegram.
            </p>
            {error && <p className="text-[13px] text-status-danger mb-4">{error}</p>}
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
                onClick={handleSkip}
                className="text-[13px] text-ink-2 underline underline-offset-2 hover:text-ink transition-colors"
              >
                Pular por agora
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
