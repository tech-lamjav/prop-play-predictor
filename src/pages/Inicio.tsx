import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import { Bot, Trophy, ArrowUpRight, Loader2 } from 'lucide-react';
import AnalyticsNav from '../components/AnalyticsNav';
import { createClient } from '../integrations/supabase/client';
import OnboardingTour from '../components/onboarding/OnboardingTour';
import { useOnboardingTour } from '../components/onboarding/useOnboardingTour';
import { HUB_TOUR_ID, hubSteps } from '../components/onboarding/tours';

// Hub de direcionamento pós-login (/inicio). Para quem JÁ passou pelo onboarding
// (sincronizado ou não). Cadastro novo continua indo pro /onboarding (vínculo do
// Betinho). Rebranding Direção A — só forest + amber + neutros.
//
// Layout: mobile = 4 retângulos empilhados (aproveita a tela). Desktop = 2x2,
// bloco centralizado na vertical. Texto mínimo (quem está logado já se localiza).

// ── Marcas dos produtos ────────────────────────────────────────────────────
// Basquete e futebol não existem no lucide; SVGs próprios combinam melhor com
// cada produto do que um ícone genérico.

function IconBasketball({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v20M2 12h20" />
      <path d="M5 4.5c3 3 3 12 0 15M19 4.5c-3 3-3 12 0 15" />
    </svg>
  );
}

function IconSoccer({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8.6l3.1 2.3-1.2 3.7h-3.8L8.9 10.9z" />
      <path d="M12 8.6V3M15.1 10.9l4.7-1.9M13.9 14.6l3 4M10.1 14.6l-3 4M8.9 10.9L4.2 9" />
    </svg>
  );
}

type Destino = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  kicker: string;
  badge?: string;
  dark?: boolean;
  tile: string;
  iconColor: string;
  onClick: (nav: ReturnType<typeof useNavigate>, synced: boolean) => void;
};

const DESTINOS: Destino[] = [
  {
    key: 'futebol',
    icon: IconSoccer,
    title: 'Futebol',
    kicker: 'Oportunidades de valor',
    tile: 'bg-forest-tint border-forest/15',
    iconColor: 'text-forest',
    onClick: (nav) => nav('/futebol'),
  },
  {
    key: 'betinho',
    icon: Bot,
    title: 'Betinho',
    kicker: 'Gestão de apostas',
    dark: true,
    tile: 'bg-forest border-forest',
    iconColor: 'text-amber',
    onClick: (nav, synced) => nav(synced ? '/bets' : '/onboarding'),
  },
  {
    key: 'nba',
    icon: IconBasketball,
    title: 'Análises NBA',
    kicker: 'Props e dashboards',
    tile: 'bg-canvas-2 border-line',
    iconColor: 'text-forest',
    onClick: (nav) => nav('/home-nba'),
  },
  {
    key: 'bolao',
    icon: Trophy,
    title: 'Bolão da Copa',
    kicker: 'Palpites e ranking',
    tile: 'bg-[#f6efdb] border-[#e6d5a3]',
    iconColor: 'text-amber-2',
    onClick: (nav) => nav('/bolao'),
  },
];

export default function Inicio() {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>('');
  const [synced, setSynced] = useState(false);

  // Onboarding guiado — só arma quando o hub carregou (tiles montados).
  const tour = useOnboardingTour(HUB_TOUR_ID, { enabled: !!userId });

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth', { state: { from: { pathname: '/inicio' } } });
        return;
      }
      setUserId(user.id);

      const { data: row } = await supabase
        .from('users')
        .select('name, telegram_chat_id')
        .eq('id', user.id)
        .single();
      setSynced(!!row?.telegram_chat_id);
      if (row?.name) setFirstName(String(row.name).trim().split(' ')[0]);

      posthog?.capture('inicio_hub_viewed', { synced: !!row?.telegram_chat_id });
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (d: Destino) => {
    posthog?.capture('inicio_hub_destino_clicked', { destino: d.key, synced });
    d.onClick(navigate, synced);
  };

  if (!userId) {
    return (
      <div className="theme-bolao min-h-screen bg-canvas flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-forest animate-spin" />
      </div>
    );
  }

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <OnboardingTour
        tourId={HUB_TOUR_ID}
        steps={hubSteps}
        run={tour.run}
        onFinish={tour.finish}
      />
      <AnalyticsNav variant="rebrand" />

      <main className="flex flex-1 flex-col px-5 pt-8 pb-12 sm:px-8 sm:pt-14">
        <div className="mx-auto w-full max-w-md sm:max-w-4xl">
          {/* Cabeçalho enxuto, alinhado à esquerda */}
          <header className="mb-6 sm:mb-9">
            <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-forest">
              {firstName ? `Olá, ${firstName}` : 'Bem-vindo de volta'}
            </p>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-ink sm:text-[34px]">
              Por onde vamos?
            </h1>
          </header>

          {/* Mobile: 4 retângulos empilhados. Desktop: 2x2. */}
          <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4">
            {DESTINOS.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.key}
                  type="button"
                  data-tour={`hub-${d.key}`}
                  onClick={() => go(d)}
                  className={`group relative flex h-[92px] flex-row items-center gap-4 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-ink/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 sm:h-auto sm:min-h-[208px] sm:flex-col sm:items-start sm:justify-between sm:gap-0 sm:p-6 ${d.tile}`}
                >
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                      d.dark ? 'bg-white/10' : 'bg-white/60'
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${d.iconColor}`} />
                  </span>
                  <div className="min-w-0 flex-1 sm:flex-none">
                    {d.badge && (
                      <span
                        className={`mb-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          d.dark ? 'bg-white/15 text-white' : 'bg-amber/15 text-amber-2'
                        }`}
                      >
                        {d.badge}
                      </span>
                    )}
                    <h2
                      className={`font-display text-[18px] font-bold leading-tight sm:text-[21px] ${
                        d.dark ? 'text-white' : 'text-ink'
                      }`}
                    >
                      {d.title}
                    </h2>
                    <p className={`mt-0.5 text-[13px] ${d.dark ? 'text-white/70' : 'text-ink-2'}`}>
                      {d.kicker}
                    </p>
                  </div>
                  <ArrowUpRight
                    className={`absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 transition-all group-hover:translate-x-0.5 sm:top-5 sm:translate-y-0 group-hover:sm:-translate-y-0.5 ${
                      d.dark ? 'text-white/60' : 'text-ink-2/50'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
