import { useNavigate } from 'react-router-dom';
import { Check, Lock, Sparkles, ShieldCheck, Zap, TrendingUp, Star } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { useFutebolAccess } from '@/hooks/use-futebol-data';

const UNLOCK = [
  { icon: Zap, t: 'Os picks de valor', d: 'O lado, a odd e o valor (+EV) de cada oportunidade — não só que existe uma.' },
  { icon: Star, t: '5 mercados', d: 'Resultado (1X2), Gols (Over/Under), Handicap asiático, Ambos marcam e Dupla chance.' },
  { icon: TrendingUp, t: 'Ranking de confiabilidade', d: 'Oportunidades do dia ordenadas pelo Score, atualizadas de hora em hora.' },
  { icon: ShieldCheck, t: 'O "Por quê" de cada aposta', d: 'As premissas que sustentam a tese e os pontos de atenção, mastigados.' },
];

const FREE = ['Score e faixa de confiabilidade', 'Leitura do jogo (modelo de gols, escalação, H2H)', 'Classificação oficial com zonas', 'Perfil dos times e Raio-X', 'Artilheiros e estatísticas'];

function PlanCard({
  nome, preco, periodo, nota, destaque, badge, cta, onCta, ctaDisabled,
}: {
  nome: string; preco: string; periodo: string; nota?: string; destaque?: boolean;
  badge?: string; cta: string; onCta: () => void; ctaDisabled?: boolean;
}) {
  return (
    <div className={`relative rounded-2xl p-6 flex flex-col ${destaque ? 'bg-white border-2 border-forest shadow-sm' : 'bg-white border border-line'}`}>
      {badge && (
        <span className="absolute -top-2.5 left-6 px-2.5 h-5 inline-flex items-center rounded-full text-[10px] font-bold uppercase tracking-[0.12em] bg-forest text-canvas">{badge}</span>
      )}
      <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-3">{nome}</div>
      <div className="flex items-baseline gap-1 mt-2">
        <span className="text-[34px] font-extrabold tracking-tight text-ink tabular-nums">{preco}</span>
        <span className="text-[13px] text-ink-3">/{periodo}</span>
      </div>
      {nota && <div className="text-[12px] text-forest font-semibold mt-1">{nota}</div>}
      <button
        onClick={onCta}
        disabled={ctaDisabled}
        className={`mt-5 w-full inline-flex items-center justify-center gap-1.5 rounded-rebrand-sm text-sm font-bold h-11 transition ${
          ctaDisabled
            ? 'bg-canvas-2 text-ink-3 cursor-default'
            : destaque ? 'bg-forest text-canvas hover:bg-forest-2' : 'bg-ink text-canvas hover:bg-ink-2'
        }`}
      >
        {cta}
      </button>
    </div>
  );
}

export default function FutebolAssinar() {
  const navigate = useNavigate();
  const { data: access } = useFutebolAccess();
  const state = access?.state ?? 'anon';

  // CTA adaptado ao estado. Pagamento (PIX/Abacate) ainda não plugado → "em breve".
  let cta = 'Pagamento via PIX em breve';
  let ctaDisabled = true;
  let onCta = () => {};
  if (state === 'anon') {
    cta = 'Criar conta — 7 dias grátis'; ctaDisabled = false; onCta = () => navigate('/auth');
  } else if (state === 'subscribed') {
    cta = 'Você já é Premium'; ctaDisabled = true;
  }

  const headerNote =
    state === 'trial' ? `Você está no teste grátis — ${access?.days_left ?? 7} dias restantes. Aproveite o acesso completo.`
    : state === 'expired' ? 'Seu teste grátis acabou. Garanta o acesso aos picks de valor.'
    : state === 'subscribed' ? 'Você já tem acesso completo ao Futebol Premium.'
    : 'Teste 7 dias grátis, sem cartão. Depois, assine pra continuar vendo os picks.';

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" showBack />
      <div className="max-w-5xl w-full mx-auto px-4 md:px-6 py-8 md:py-10 flex-1 flex flex-col gap-7">

        {/* Hero */}
        <section className="relative rounded-2xl overflow-hidden text-white px-6 md:px-10 py-9 md:py-11"
          style={{ background: 'linear-gradient(135deg, #0a3d2e 0%, #08321f 60%, #051f12 100%)' }}>
          <div className="absolute top-0 right-0 w-[360px] h-[360px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.18), transparent 70%)', transform: 'translate(110px,-110px)' }} />
          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[10px] uppercase tracking-[0.18em] font-bold" style={{ background: '#fbbf24', color: '#1a1d1a' }}>
              <Sparkles className="w-3 h-3" /> Futebol Premium
            </span>
            <h1 className="text-[30px] md:text-[40px] font-extrabold tracking-tight leading-[1.08] mt-5">
              Aposte onde a odd paga<br className="hidden md:block" /> mais do que o risco real.
            </h1>
            <p className="text-[15px] md:text-[16px] text-white/80 mt-3 leading-relaxed">
              Nosso Score de Confiabilidade cruza valor (+EV), as premissas do jogo e o movimento das casas pra te mostrar onde está a vantagem — sem tipster, sem stake, sem promessa de lucro.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-5">
              {['7 dias grátis', 'sem cartão', 'cancela quando quiser'].map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 text-[12px] text-white/90 bg-white/10 border border-white/15 rounded-full px-3 h-7">
                  <Check className="w-3 h-3" style={{ color: '#fbbf24' }} /> {c}
                </span>
              ))}
            </div>
          </div>
        </section>

        <p className="text-[13px] text-ink-2 -mt-1">{headerNote}</p>

        {/* Planos */}
        <section className="grid sm:grid-cols-2 gap-4">
          <PlanCard nome="Mensal" preco="R$ 29,90" periodo="mês" cta={cta} onCta={onCta} ctaDisabled={ctaDisabled} />
          <PlanCard nome="Anual" preco="R$ 299" periodo="ano" nota="Economize 2 meses · ~R$ 24,90/mês" destaque badge="Melhor valor" cta={cta} onCta={onCta} ctaDisabled={ctaDisabled} />
        </section>

        {/* Destrava × Sempre livre */}
        <section className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white border border-line p-6">
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-forest">Você destrava</div>
            <ul className="mt-4 space-y-3.5">
              {UNLOCK.map(({ icon: Icon, t, d }) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-rebrand-sm bg-forest/10 text-forest grid place-items-center shrink-0"><Icon className="w-4 h-4" /></span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-ink">{t}</div>
                    <div className="text-[12px] text-ink-2 leading-snug">{d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-white border border-line p-6">
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-3">Continua livre — sempre</div>
            <p className="text-[12px] text-ink-2 mt-2 leading-relaxed">A análise não é refém do paywall. Sem assinar, você ainda usa:</p>
            <ul className="mt-3 space-y-2.5">
              {FREE.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13px] text-ink-2">
                  <Check className="w-4 h-4 text-ink-3 mt-0.5 shrink-0" /><span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-3 border-t border-line text-[12px] text-ink-3 flex items-start gap-2">
              <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-forest" />
              <span>O Premium destrava só <b className="text-ink">o pick de valor</b> — o resto fica aberto pra você decidir com dados.</span>
            </div>
          </div>
        </section>

        {/* Confiança / pagamento */}
        <section className="rounded-2xl bg-white border border-line px-6 py-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          {[
            { icon: ShieldCheck, t: 'Sem tipster, sem stake' },
            { icon: TrendingUp, t: 'Score auditável + CLV' },
            { icon: Sparkles, t: 'Pagamento via PIX (em breve)' },
          ].map(({ icon: Icon, t }) => (
            <span key={t} className="inline-flex items-center gap-2 text-[12px] text-ink-2">
              <Icon className="w-4 h-4 text-forest shrink-0" /> {t}
            </span>
          ))}
        </section>
      </div>
    </div>
  );
}
