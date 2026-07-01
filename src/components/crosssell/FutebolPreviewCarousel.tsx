import React, { useEffect, useState } from 'react';
import { usePostHog } from '@posthog/react';
import {
  Flame, TrendingUp, Gauge, ScrollText, ShieldCheck, ArrowRight, ChevronRight,
  Check, AlertTriangle, Star,
} from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import { ResponsiveModal } from './ResponsiveModal';

interface FutebolPreviewCarouselProps {
  open: boolean;
  /** Fecha o preview (X / clique fora). */
  onClose: () => void;
  /** CTA final — leva pra LP. */
  onCta: () => void;
}

// ── Times (ids da API-Sports; escudo real via Storage, fallback pras iniciais) ─
const T = {
  fla: { id: 127, name: 'Flamengo', short: 'FLA' },
  pal: { id: 121, name: 'Palmeiras', short: 'PAL' },
  gre: { id: 130, name: 'Grêmio', short: 'GRE' },
  int: { id: 119, name: 'Internacional', short: 'INT' },
  sao: { id: 126, name: 'São Paulo', short: 'SAO' },
  cor: { id: 131, name: 'Corinthians', short: 'COR' },
  bah: { id: 118, name: 'Bahia', short: 'BAH' },
  flu: { id: 124, name: 'Fluminense', short: 'FLU' },
} as const;

type Team = { id: number; name: string; short: string };

function Crest({ team, size = 20 }: { team: Team; size?: number }) {
  const [err, setErr] = useState(false);
  const logo = getFutebolTeamLogoUrl(team.id);
  if (logo && !err) {
    return (
      <img
        src={logo}
        alt={team.name}
        onError={() => setErr(true)}
        style={{ width: size, height: size }}
        className="object-contain shrink-0"
        loading="lazy"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-canvas-2 border border-line grid place-items-center text-[8px] font-bold text-ink-2 shrink-0"
    >
      {team.short}
    </div>
  );
}

// ── Mini-mockups nativos (on-brand, nítidos, responsivos) ──────────────────

// 1) App — universo de jogos
const IntroHero = () => {
  const teams = [T.fla, T.pal, T.cor, T.sao, T.gre, T.int, T.bah, T.flu];
  return (
    <div className="w-full max-w-[260px] mx-auto rounded-rebrand-lg border border-line bg-white p-5">
      <div className="grid grid-cols-4 gap-3 place-items-center">
        {teams.map((t) => (
          <Crest key={t.id} team={t} size={30} />
        ))}
      </div>
      <p className="text-center text-[10px] uppercase tracking-[0.14em] font-bold text-ink-3 mt-4">
        Todos os jogos, todo dia
      </p>
    </div>
  );
};

// 2) Oportunidades do dia — board
const OppBoard = () => {
  const rows = [
    { s: 71, h: T.fla, a: T.pal, pick: 'Mais de 2,5 gols', odd: '1.95', hi: true },
    { s: 63, h: T.gre, a: T.int, pick: 'Grêmio ou empate', odd: '1.58', hi: true },
    { s: 34, h: T.bah, a: T.flu, pick: 'Bahia', odd: '2.30', hi: false },
  ];
  return (
    <div className="w-full rounded-rebrand-lg border border-line bg-white overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-line">
        <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">Oportunidades de hoje</p>
      </div>
      {rows.map((r) => (
        <div
          key={r.h.id}
          className={`flex items-center gap-2.5 px-4 py-2.5 border-b border-line last:border-b-0 ${r.hi ? '' : 'opacity-60'}`}
        >
          <span className={`inline-flex items-center justify-center rounded-md font-bold tabular-nums text-[13px] w-8 h-7 shrink-0 ${r.hi ? 'bg-forest text-white' : 'bg-canvas-2 text-ink-3 border border-line'}`}>{r.s}</span>
          <div className="flex items-center gap-1 shrink-0">
            <Crest team={r.h} size={18} />
            <Crest team={r.a} size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-ink truncate">{r.pick}</div>
          </div>
          <span className="text-[12px] font-semibold tabular-nums text-ink shrink-0">{r.odd}</span>
          <ChevronRight className="w-4 h-4 shrink-0 text-ink-3" />
        </div>
      ))}
    </div>
  );
};

// 3) Score de confiança — card centralizado
const ScoreCard = () => (
  <div className="w-full max-w-[240px] mx-auto rounded-rebrand-lg border border-line bg-white p-5 flex flex-col items-center gap-3">
    <div className="flex items-center gap-2">
      <Crest team={T.fla} size={22} />
      <span className="text-[11px] font-bold text-ink-3">×</span>
      <Crest team={T.pal} size={22} />
    </div>
    <div className="text-[12px] font-semibold text-ink text-center leading-tight">
      Mais de 2,5 gols
    </div>
    <div className="inline-flex items-center justify-center rounded-md bg-forest text-white font-bold tabular-nums text-[26px] w-16 h-12">
      71
    </div>
    <div className="w-full h-1.5 rounded-full bg-canvas-2 overflow-hidden">
      <div className="h-full bg-forest rounded-full" style={{ width: '71%' }} />
    </div>
    <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-ink-3">Score de confiança</p>
  </div>
);

// 4) Prós e contras — a favor / atenção
const ProsCons = () => (
  <div className="w-full rounded-rebrand-lg border border-line bg-white overflow-hidden">
    <div className="px-4 py-2.5 flex items-center gap-2 bg-canvas-2 border-b border-line">
      <Crest team={T.fla} size={18} />
      <Crest team={T.pal} size={18} />
      <span className="text-[12px] font-bold text-ink ml-1">Mais de 2,5 gols</span>
    </div>
    <div className="p-4 grid grid-cols-2 gap-4">
      <div>
        <div className="text-[9px] uppercase tracking-[0.12em] font-bold text-forest mb-1.5 flex items-center gap-1">
          <Check className="w-3 h-3" /> A favor
        </div>
        <ul className="flex flex-col gap-1">
          {['Ataques dos melhores', 'Costumam sair 3+ gols'].map((p) => (
            <li key={p} className="flex items-start gap-1.5 text-[11px] leading-snug text-ink-2">
              <span className="mt-1 w-1 h-1 rounded-full shrink-0 bg-forest" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="text-[9px] uppercase tracking-[0.12em] font-bold text-amber-2 mb-1.5 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Atenção
        </div>
        <ul className="flex flex-col gap-1">
          {['Palmeiras segura fora', 'Pode travar no início'].map((p) => (
            <li key={p} className="flex items-start gap-1.5 text-[11px] leading-snug text-ink-2">
              <span className="mt-1 w-1 h-1 rounded-full shrink-0 bg-amber" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

// 5) Fechamento — os números na mesa
const OppMarkets = () => {
  const rows = [
    { m: 'Mais de 2,5 gols', chance: '58%', odd: '1.95', hi: true },
    { m: 'Ambos marcam · Sim', chance: '55%', odd: '1.85', hi: false },
    { m: 'Flamengo vence', chance: '48%', odd: '2.10', hi: true },
  ];
  return (
    <div className="w-full rounded-rebrand-lg border border-line bg-white overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2 bg-canvas-2 border-b border-line text-[9px] uppercase tracking-[0.12em] font-bold text-ink-3">
        <span>Mercado</span><span>Chance</span><span>Odd</span>
      </div>
      {rows.map((r) => (
        <div key={r.m} className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center px-4 py-2.5 border-b border-line last:border-b-0">
          <span className="text-[11px] font-medium text-ink truncate flex items-center gap-1">
            {r.hi && <Star className="w-3 h-3 text-amber-2 shrink-0" fill="currentColor" />}
            {r.m}
          </span>
          <span className="text-[11px] tabular-nums text-ink-2">{r.chance}</span>
          <span className="text-[11px] tabular-nums font-semibold text-ink">{r.odd}</span>
        </div>
      ))}
    </div>
  );
};

interface Step {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  visual: React.ReactNode;
}

const STEPS: Step[] = [
  {
    key: 'app',
    icon: Flame,
    title: 'Do bolão pro jogo de verdade',
    desc: 'Você já joga o bolão da Copa. Agora vem o app que te ajuda a apostar com dados do seu lado, jogo a jogo.',
    visual: <IntroHero />,
  },
  {
    key: 'oportunidades',
    icon: TrendingUp,
    title: 'As oportunidades do dia',
    desc: 'Todo dia a gente mapeia os jogos e separa as principais oportunidades de aposta. As melhores no topo.',
    visual: <OppBoard />,
  },
  {
    key: 'score',
    icon: Gauge,
    title: 'Um score de confiança',
    desc: 'Cada oportunidade ganha uma nota de 0 a 100. Quanto maior, mais confiança pra apostar.',
    visual: <ScoreCard />,
  },
  {
    key: 'pros-contras',
    icon: ScrollText,
    title: 'Os prós e contras de cada aposta',
    desc: 'O que pesa a favor e os pontos de atenção, mastigados, sem precisar entender de número.',
    visual: <ProsCons />,
  },
  {
    key: 'fechamento',
    icon: ShieldCheck,
    title: 'Sem achismo, você no controle',
    desc: 'A gente mostra os números e o motivo de cada aposta. Quem dá o palpite final é você.',
    visual: <OppMarkets />,
  },
];

export const FutebolPreviewCarousel: React.FC<FutebolPreviewCarouselProps> = ({
  open,
  onClose,
  onCta,
}) => {
  const posthog = usePostHog();
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    onSelect();
    api.on('select', onSelect);
    return () => { api.off('select', onSelect); };
  }, [api]);

  // Analytics de visualização de cada etapa.
  useEffect(() => {
    if (!open) return;
    posthog?.capture('crosssell_futebol_step_view', {
      step: current + 1,
      key: STEPS[current]?.key,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, open]);

  const isLast = current === STEPS.length - 1;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title="Preview da Plataforma de Futebol"
      className="theme-bolao bg-canvas border border-line w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-lg p-0 overflow-hidden rounded-rebrand-xl"
    >
      <div className="px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
        {/* Cabeçalho fixo */}
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/[0.12] border border-amber/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-2">
            <Flame className="w-3 h-3" />
            Em breve
          </span>
          <span className="text-[11px] text-ink-3 font-medium">Análise futebol</span>
        </div>

        {/* Carrossel */}
        <Carousel setApi={setApi} opts={{ align: 'start' }} className="w-full">
          <CarouselContent>
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <CarouselItem key={step.key}>
                  <div className="flex flex-col">
                    <div className="min-h-[190px] flex items-center justify-center">{step.visual}</div>
                    <div className="mt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber to-amber-2 flex items-center justify-center shadow-sm shrink-0">
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <h3 className="font-display text-[18px] font-bold text-ink leading-tight">{step.title}</h3>
                      </div>
                      <p className="text-[13px] text-ink-2 mt-2 leading-snug">{step.desc}</p>
                    </div>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
      </div>

      {/* Rodapé: dots + CTA */}
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-label={`Ir para etapa ${i + 1}`}
              onClick={() => api?.scrollTo(i)}
              className={`h-1.5 rounded-full transition-all ${i === current ? 'w-5 bg-amber' : 'w-1.5 bg-line-2'}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => (isLast ? onCta() : api?.scrollNext())}
          className="w-full h-12 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 inline-flex items-center justify-center gap-1.5 font-bold text-[13px] transition-colors shadow-sm"
        >
          {isLast ? 'Quero acesso antecipado' : 'Próximo'}
          <ArrowRight className="w-4 h-4" />
        </button>

        {!isLast && (
          <button
            type="button"
            onClick={onCta}
            className="w-full text-center text-[11px] text-ink-3 hover:text-ink-2 transition-colors mt-3"
          >
            Pular pra página
          </button>
        )}
      </div>
    </ResponsiveModal>
  );
};
