import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Flame } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { useAuth } from '@/hooks/use-auth';

type Billing = 'monthly' | 'annual';

/* Preços — PLACEHOLDERS. Trocar quando o modelo de cobrança fechar.
   Mensal: preço de lançamento (de/por). Anual: −20% sobre o mensal de lançamento. */
const PRICES = {
  essencial: {
    monthly: { amount: '39,90', per: '/mês', billed: 'preço de lançamento', strike: 'R$ 49,90' },
    annual: { amount: '31,90', per: '/mês', billed: 'cobrado R$ 383/ano · economize 20%', strike: 'R$ 39,90' },
  },
  completo: {
    monthly: { amount: '89,90', per: '/mês', billed: 'preço de lançamento', strike: 'R$ 109,90' },
    annual: { amount: '71,90', per: '/mês', billed: 'cobrado R$ 863/ano · economize 20%', strike: 'R$ 89,90' },
  },
} as const;

const TH: Record<'essencial' | 'completo', Record<Billing, string>> = {
  essencial: { monthly: 'R$ 39,90/mês', annual: 'R$ 31,90/mês' },
  completo: { monthly: 'R$ 89,90/mês', annual: 'R$ 71,90/mês' },
};

const EYEBROW = 'text-[11px] font-bold uppercase tracking-[0.16em] text-forest-2';

function PriceBlock({ tier, billing }: { tier: 'essencial' | 'completo'; billing: Billing }) {
  const p = PRICES[tier][billing];
  return (
    <>
      <div className="flex items-baseline gap-2 flex-wrap mt-4">
        {p.strike && (
          <span className="text-sm text-ink-3 line-through decoration-status-danger tabular-nums">{p.strike}</span>
        )}
        <span className="font-extrabold text-[40px] leading-none tracking-tight tabular-nums">
          <span className="text-xl font-bold opacity-60 mr-0.5">R$</span>{p.amount}
        </span>
        <span className="text-[13px] text-ink-3">{p.per}</span>
      </div>
      <div className="text-[12.5px] text-ink-3 mt-1.5 min-h-[18px]">{p.billed || ' '}</div>
    </>
  );
}

function Feat({ children, off = false }: { children: React.ReactNode; off?: boolean }) {
  return (
    <li className={`flex items-start gap-2.5 ${off ? 'text-ink-3' : 'text-ink-2'}`}>
      {off ? (
        <X className="w-[17px] h-[17px] shrink-0 mt-0.5 text-status-danger opacity-70" strokeWidth={2.6} />
      ) : (
        <Check className="w-[17px] h-[17px] shrink-0 mt-0.5 text-forest" />
      )}
      <span className={off ? 'line-through decoration-line-2' : undefined}>{children}</span>
    </li>
  );
}

/* célula "sim" da tabela */
function Yes() {
  return <Check className="w-[18px] h-[18px] text-forest inline" strokeWidth={2.6} />;
}

/* célula "não" da tabela */
function No() {
  return <X className="w-[17px] h-[17px] text-status-danger opacity-60 inline" strokeWidth={2.6} />;
}

export default function Planos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [billing, setBilling] = useState<Billing>('monthly');

  // CTA do plano grátis: deslogado cria conta; logado já tem conta → entra no app.
  const freeCta = user
    ? { label: 'Acessar', onClick: () => navigate('/inicio') }
    : { label: 'Criar conta grátis', onClick: () => navigate('/auth') };

  // "Assinar" — placeholder. Quando o checkout unificado estiver plugado, trocar
  // por stripeService.createCheckoutSession(priceId[plan][billing], plan): logado
  // vai direto pro gateway; deslogado passa pelo /auth e volta pro checkout.
  const startCheckout = (_plan: 'essencial' | 'completo') => {
    navigate(user ? '/inicio' : '/auth');
  };

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" />

      {/* Promo de lançamento */}
      <div className="bg-forest text-white text-[13.5px]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-2.5 flex items-center justify-center gap-2.5 flex-wrap text-center">
          <Flame className="w-[15px] h-[15px] shrink-0" style={{ color: '#ffd873' }} />
          <span><b style={{ color: '#ffd873' }}>Preço de lançamento</b> — valores promocionais por tempo limitado</span>
        </div>
      </div>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 pt-14 md:pt-16 pb-2">
          <div className={EYEBROW}>Um plano, todo o ecossistema</div>
          <h1 className="text-[34px] md:text-[52px] font-extrabold leading-[1.04] tracking-tight mt-3.5 max-w-[15ch] text-balance">
            Decida com <span className="text-forest">dado</span>. Não&nbsp;com achismo.
          </h1>
          <p className="text-[17px] md:text-[18px] text-ink-2 mt-4 max-w-[52ch] leading-relaxed">
            Análise de futebol e NBA, e o Betinho cuidando da sua banca direto no Telegram. Você
            escolhe até onde quer ir — e sobe de nível quando quiser.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 text-[13.5px] text-ink-3">
            {['7 dias grátis pra testar', 'Cancele quando quiser', 'Pix ou cartão'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <Check className="w-[15px] h-[15px] text-status-success" /> {t}
              </span>
            ))}
          </div>
        </section>

        {/* Toggle mensal/anual — fundo pintado direto no botão ativo (sem thumb
            deslizante), pra casar exatamente com a largura de cada botão. */}
        <div className="flex justify-center mt-9 mb-1">
          <div className="inline-flex items-center bg-canvas-2 border border-line rounded-full p-1 gap-1">
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              className={`h-9 px-5 rounded-full text-sm font-semibold transition-colors ${billing === 'monthly' ? 'bg-forest text-white' : 'text-ink-2 hover:text-ink'}`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setBilling('annual')}
              className={`h-9 pl-5 pr-2.5 rounded-full text-sm font-semibold transition-colors inline-flex items-center gap-2 ${billing === 'annual' ? 'bg-forest text-white' : 'text-ink-2 hover:text-ink'}`}
            >
              Anual
              <span
                className="text-[10.5px] font-bold tracking-wide rounded-full px-1.5 py-0.5 leading-none"
                style={billing === 'annual' ? { background: '#ffd873', color: '#3a2c00' } : { background: '#d4a017', color: '#3a2c00' }}
              >
                −20%
              </span>
            </button>
          </div>
        </div>

        {/* Cards */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 mt-6">
          <div className="grid md:grid-cols-3 gap-4 items-stretch max-w-[460px] md:max-w-none mx-auto">
            {/* GRÁTIS */}
            <div className="rounded-2xl bg-white border border-line p-6 flex flex-col">
              <div className="text-[13px] font-bold tracking-[0.02em]">Grátis</div>
              <div className="text-[13.5px] text-ink-3 mt-1 min-h-[38px]">Pra sentir como funciona, sem pagar nada.</div>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="font-extrabold text-[40px] leading-none tracking-tight tabular-nums">
                  <span className="text-xl font-bold opacity-60 mr-0.5">R$</span>0
                </span>
                <span className="text-[13px] text-ink-3">pra sempre</span>
              </div>
              <div className="text-[12.5px] text-ink-3 mt-1.5 min-h-[18px]">&nbsp;</div>
              <button onClick={freeCta.onClick} className="mt-5 w-full h-11 rounded-rebrand-sm text-sm font-bold bg-white border border-line-2 text-ink hover:border-forest hover:text-forest transition">
                {freeCta.label}
              </button>
              <ul className="mt-5 pt-5 border-t border-line flex flex-col gap-2.5 text-sm">
                <Feat>Futebol: <b className="text-ink font-semibold">7 dias grátis</b> de acesso completo</Feat>
                <Feat>NBA: <b className="text-ink font-semibold">2 picks do dia</b> liberados</Feat>
                <Feat>Betinho: até <b className="text-ink font-semibold">3 apostas por dia</b></Feat>
              </ul>
            </div>

            {/* ESSENCIAL */}
            <div className="rounded-2xl bg-white border border-line p-6 flex flex-col">
              <div className="text-[13px] font-bold tracking-[0.02em]">Essencial</div>
              <div className="text-[13.5px] text-ink-3 mt-1 min-h-[38px]">Futebol completo + a banca no automático.</div>
              <PriceBlock tier="essencial" billing={billing} />
              <button onClick={() => startCheckout('essencial')} className="mt-5 w-full h-11 rounded-rebrand-sm text-sm font-bold bg-forest text-white hover:bg-forest-2 transition">
                Assinar Essencial
              </button>
              <ul className="mt-5 pt-5 border-t border-line flex flex-col gap-2.5 text-sm">
                <Feat><b className="text-ink font-semibold">Futebol completo</b> — oportunidades e Score sem limite</Feat>
                <Feat><b className="text-ink font-semibold">Betinho ilimitado</b> — registra e liquida tudo no Telegram</Feat>
                <Feat>Resumo semanal da sua banca</Feat>
                <Feat>Suporte prioritário</Feat>
                <Feat off>NBA completo</Feat>
              </ul>
            </div>

            {/* COMPLETO — slab forest */}
            <div className="relative rounded-2xl bg-forest border border-forest p-6 flex flex-col text-[#eaf1ec] shadow-[0_18px_40px_-18px_rgba(10,61,46,0.55)]">
              <span
                className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold tracking-[0.08em] rounded-full px-3 py-1 whitespace-nowrap shadow-[0_4px_12px_-3px_rgba(212,160,23,0.5)]"
                style={{ background: '#d4a017', color: '#2a1f00' }}
              >
                MAIS ESCOLHIDO
              </span>
              <div className="text-[13px] font-bold tracking-[0.02em] text-white">Completo</div>
              <div className="text-[13.5px] mt-1 min-h-[38px]" style={{ color: '#a9c4b7' }}>
                Tudo. Futebol, NBA e Betinho no mesmo plano.
              </div>
              <div className="flex items-baseline gap-2 flex-wrap mt-4">
                {PRICES.completo[billing].strike && (
                  <span className="text-sm line-through tabular-nums" style={{ color: '#8fb0a2', textDecorationColor: '#e0956f' }}>
                    {PRICES.completo[billing].strike}
                  </span>
                )}
                <span className="font-extrabold text-[40px] leading-none tracking-tight tabular-nums text-white">
                  <span className="text-xl font-bold mr-0.5" style={{ color: '#ffd873' }}>R$</span>
                  {PRICES.completo[billing].amount}
                </span>
                <span className="text-[13px]" style={{ color: '#9fbcae' }}>{PRICES.completo[billing].per}</span>
              </div>
              <div className="text-[12.5px] mt-1.5 min-h-[18px]" style={{ color: '#9fbcae' }}>
                {PRICES.completo[billing].billed || ' '}
              </div>
              <button onClick={() => startCheckout('completo')} className="mt-5 w-full h-11 rounded-rebrand-sm text-sm font-bold transition hover:brightness-95" style={{ background: '#d4a017', color: '#2a1f00' }}>
                Assinar Completo
              </button>
              <ul className="mt-5 pt-5 flex flex-col gap-2.5 text-sm" style={{ borderTop: '1px solid rgba(255,255,255,0.14)' }}>
                {[
                  <>Tudo do Essencial, incluído</>,
                  <><b className="text-white font-semibold">NBA completo</b> — a análise mais robusta: prop bets + Análise 360</>,
                  <>Todos os esportes de uma vez só</>,
                  <>Suporte prioritário</>,
                ].map((node, i) => (
                  <li key={i} className="flex items-start gap-2.5" style={{ color: '#cfe0d8' }}>
                    <Check className="w-[17px] h-[17px] shrink-0 mt-0.5" style={{ color: '#ffd873' }} />
                    <span>{node}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-center text-[13px] text-ink-3 mt-4">
            Todos os planos pagos incluem o Betinho e o teste grátis de 7 dias.
          </p>
        </section>

        {/* Comparação */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 pt-20">
          <div className="text-center mb-8">
            <div className={EYEBROW}>Comparar</div>
            <h2 className="text-[24px] md:text-[32px] font-extrabold tracking-tight mt-2">O que entra em cada plano</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[620px]">
              <thead>
                <tr>
                  <th className="text-left py-4 px-4"></th>
                  <th className="py-4 px-4 text-[13px] font-bold">
                    Grátis<span className="block text-[12px] text-ink-3 font-medium mt-0.5 tabular-nums">R$ 0</span>
                  </th>
                  <th className="py-4 px-4 text-[13px] font-bold">
                    Essencial<span className="block text-[12px] text-ink-3 font-medium mt-0.5 tabular-nums">{TH.essencial[billing]}</span>
                  </th>
                  <th className="py-4 px-4 text-[13px] font-bold bg-forest-tint rounded-t-[10px]">
                    Completo<span className="block text-[12px] text-ink-3 font-medium mt-0.5 tabular-nums">{TH.completo[billing]}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="[&_td]:py-[15px] [&_td]:px-4 [&_td]:text-center [&_td]:text-sm [&_td]:text-ink-2 [&_td]:border-b [&_td]:border-line [&_th]:border-b [&_th]:border-line">
                <tr>
                  <th className="text-left px-4 text-sm font-semibold text-ink">Análise de Futebol</th>
                  <td>Trial 7 dias</td>
                  <td><Yes /></td>
                  <td className="bg-forest-tint"><Yes /></td>
                </tr>
                <tr>
                  <th className="text-left px-4 text-sm font-semibold text-ink">
                    Análise NBA<span className="block text-[11.5px] text-ink-3 font-normal">completa — prop bets + Análise 360</span>
                  </th>
                  <td>2 picks/dia</td>
                  <td>2 picks/dia</td>
                  <td className="bg-forest-tint"><Yes /></td>
                </tr>
                <tr>
                  <th className="text-left px-4 text-sm font-semibold text-ink">Betinho — gestão no Telegram</th>
                  <td>3 apostas/dia</td>
                  <td>Ilimitado</td>
                  <td className="bg-forest-tint">Ilimitado</td>
                </tr>
                <tr>
                  <th className="text-left px-4 text-sm font-semibold text-ink">Suporte prioritário</th>
                  <td><No /></td>
                  <td><Yes /></td>
                  <td className="bg-forest-tint"><Yes /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 pt-20">
          <div className="text-center mb-8">
            <div className={EYEBROW}>Dúvidas</div>
            <h2 className="text-[24px] md:text-[32px] font-extrabold tracking-tight mt-2">Antes de assinar</h2>
          </div>
          <div className="max-w-[760px] mx-auto">
            {[
              {
                q: 'Por que o NBA só está no plano Completo?',
                a: (<>O NBA é a nossa análise <b className="text-ink">mais robusta</b> — prop bets, Análise 360 e o que temos de mais avançado. O Essencial já entrega o futebol completo pro seu dia a dia; o Completo é pra quem quer <b className="text-ink">tudo</b> junto. Você não paga por esporte solto: paga por até onde quer ir.</>),
                open: true,
              },
              { q: 'Posso trocar de plano depois?', a: <>Pode, quando quiser. Sobe pro Completo e o valor é ajustado proporcionalmente; desce de volta no fim do ciclo. Sem multa, sem burocracia.</> },
              { q: 'Como funciona o teste grátis?', a: <>Você cria a conta e tem <b className="text-ink">7 dias</b> de acesso completo pra experimentar de verdade. Só cobra depois — e você decide se continua.</> },
              { q: 'Consigo pagar com Pix?', a: <>Sim. Aceitamos <b className="text-ink">Pix</b> e cartão. No anual, o Pix sai à vista com o desconto de lançamento aplicado.</> },
              { q: 'Como eu cancelo?', a: <>Em dois cliques, na sua conta. O acesso continua até o fim do período que você já pagou — nada de corte no meio.</> },
            ].map(({ q, a, open }) => (
              <details key={q} open={open} className="group border-b border-line">
                <summary className="cursor-pointer list-none py-[18px] pr-10 font-semibold text-[16.5px] text-ink relative marker:hidden [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="absolute right-1.5 top-1/2 w-2.5 h-2.5 border-r-2 border-b-2 border-ink-3 -translate-y-[70%] rotate-45 transition-transform group-open:-translate-y-[30%] group-open:rotate-[225deg]" />
                </summary>
                <div className="pb-[18px] pr-10 text-[15px] text-ink-2 max-w-[68ch]">{a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 pt-20 pb-14">
          <div className="rounded-[20px] bg-forest text-white text-center px-8 py-12">
            <h2 className="text-[26px] md:text-[38px] font-extrabold tracking-tight">Comece grátis hoje</h2>
            <p className="mt-3 mb-7 mx-auto max-w-[46ch]" style={{ color: '#a9c4b7' }}>
              Cria a conta, testa 7 dias e só depois decide. Se não for pra você, é só cancelar.
            </p>
            <button onClick={freeCta.onClick} className="inline-block h-12 px-8 rounded-rebrand-sm text-base font-bold transition hover:brightness-95" style={{ background: '#d4a017', color: '#2a1f00' }}>
              {freeCta.label}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
