import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Flame, X } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { useAuth } from '@/hooks/use-auth';
import { Seo, SITE_URL } from '@/components/Seo';

type Billing = 'monthly' | 'annual';
type PaidTier = 'entrada' | 'essencial' | 'completo';

/* Preços — PLACEHOLDERS. Trocar quando o modelo de cobrança fechar.
   Mensal: preço de lançamento (de/por). Anual: −20% sobre o mensal de lançamento.
   Entrada fica FORA da promo de lançamento (sem de/por): já é o piso da escada. */
const PRICES = {
  entrada: {
    monthly: { amount: '14,90', per: '/mês', billed: '', strike: '' },
    annual: { amount: '11,90', per: '/mês', billed: 'cobrado R$ 143/ano · economize 20%', strike: '' },
  },
  essencial: {
    monthly: { amount: '39,90', per: '/mês', billed: '', strike: 'R$ 49,90' },
    annual: { amount: '31,90', per: '/mês', billed: 'cobrado R$ 383/ano · economize 20%', strike: 'R$ 39,90' },
  },
  completo: {
    monthly: { amount: '89,90', per: '/mês', billed: '', strike: 'R$ 109,90' },
    annual: { amount: '71,90', per: '/mês', billed: 'cobrado R$ 863/ano · economize 20%', strike: 'R$ 89,90' },
  },
} as const;

const PLAN_NAMES: Record<PaidTier, string> = {
  entrada: 'Entrada',
  essencial: 'Essencial',
  completo: 'Completo',
};

const TH: Record<PaidTier, Record<Billing, string>> = {
  entrada: { monthly: 'R$ 14,90/mês', annual: 'R$ 11,90/mês' },
  essencial: { monthly: 'R$ 39,90/mês', annual: 'R$ 31,90/mês' },
  completo: { monthly: 'R$ 89,90/mês', annual: 'R$ 71,90/mês' },
};

const EYEBROW = 'text-[11px] font-bold uppercase tracking-[0.16em] text-forest-2';

/* Corpo do número do preço. Menor no lg porque lá são 4 colunas: com 40px o
   preço + "/mês" não cabia numa linha nos cards com preço riscado. */
const PRICE_NUM = 'font-extrabold text-[40px] lg:text-[34px] leading-none tracking-tight tabular-nums';

// JSON-LD dos planos DERIVADO do PRICES acima — nunca hardcode preço aqui:
// o Google exige que o structured data bata com o que a página exibe, e
// derivando não tem drift quando os valores (hoje placeholders) mudarem.
const brl = (s: string) => s.replace(/\./g, '').replace(',', '.');
const annualTotal = (billed: string) => {
  const m = billed.match(/R\$\s*([\d.,]+)\/ano/);
  return m ? brl(m[1]) : null;
};
const PLAN_JSONLD_DESC: Record<PaidTier, string> = {
  entrada: 'Betinho ilimitado no Telegram: registra e liquida suas apostas e manda o resumo semanal da banca. Sem as análises de futebol e NBA.',
  essencial: 'Futebol completo (Brasileirão e Copa) + Betinho ilimitado. Teste grátis de 7 dias.',
  completo: 'Tudo do Essencial + análise NBA completa (prop bets e Análise 360). Teste grátis de 7 dias.',
};

const PLANS_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: [
    {
      '@type': 'Product',
      name: 'Smart Betting Grátis',
      description: 'Porta de entrada do ecossistema: registre apostas com o Betinho e acompanhe o futebol com limites do plano grátis.',
      brand: { '@type': 'Brand', name: 'Smart Betting' },
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL', url: `${SITE_URL}/planos` },
    },
    ...(['entrada', 'essencial', 'completo'] as const).map((tier) => ({
      '@type': 'Product',
      name: `Smart Betting ${PLAN_NAMES[tier]}`,
      description: PLAN_JSONLD_DESC[tier],
      brand: { '@type': 'Brand', name: 'Smart Betting' },
      offers: [
        {
          '@type': 'Offer',
          name: 'Mensal',
          price: brl(PRICES[tier].monthly.amount),
          priceCurrency: 'BRL',
          url: `${SITE_URL}/planos`,
        },
        {
          '@type': 'Offer',
          name: 'Anual',
          price: annualTotal(PRICES[tier].annual.billed) ?? brl(PRICES[tier].annual.amount),
          priceCurrency: 'BRL',
          url: `${SITE_URL}/planos`,
        },
      ],
    })),
  ],
};

function PriceBlock({ tier, billing }: { tier: PaidTier; billing: Billing }) {
  const p = PRICES[tier][billing];
  return (
    <>
      {/* Uma linha só (sem flex-wrap): com 4 colunas o "/mês" quebrava e
          derrubava o botão do card, desalinhando a fileira. */}
      <div className="flex items-baseline gap-2 whitespace-nowrap mt-4 min-h-[44px]">
        {p.strike && (
          <span className="text-sm text-ink-3 line-through decoration-ink-3 tabular-nums">{p.strike}</span>
        )}
        <span className={PRICE_NUM}>
          <span className="text-xl lg:text-lg font-bold opacity-60 mr-0.5">R$</span>{p.amount}
        </span>
        <span className="text-[13px] text-ink-3">{p.per}</span>
      </div>
      <div className="text-[12.5px] text-ink-3 mt-1.5 min-h-[19px]">{p.billed || ' '}</div>
    </>
  );
}

function Feat({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-ink-2">
      <Check className="w-[17px] h-[17px] shrink-0 mt-0.5 text-forest" />
      <span>{children}</span>
    </li>
  );
}

/* Linha de "não inclui" — só no Entrada, pra ninguém assinar achando que leva
   as análises. Cinza + X em vez do check verde. */
function NoFeat({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-ink-3">
      <X className="w-[17px] h-[17px] shrink-0 mt-0.5 text-ink-3" />
      <span>{children}</span>
    </li>
  );
}

export default function Planos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [billing, setBilling] = useState<Billing>('monthly');

  // CTA do plano grátis: deslogado cria conta; logado já tem conta → entra no app.
  const freeCta = user
    ? { label: 'Acessar', onClick: () => navigate('/inicio') }
    : { label: 'Criar conta grátis', onClick: () => navigate('/auth') };

  // O checkout unificado ainda não está plugado. Quando estiver, trocar por
  // stripeService.createCheckoutSession(priceId[plan][billing], plan): logado
  // vai direto pro gateway; deslogado passa pelo /auth e volta pro checkout.
  //
  // Enquanto isso, o botão diz a verdade em vez de navegar em silêncio. Para
  // quem está deslogado "Assinar" ainda tem ação real: criar a conta e começar
  // o teste. Para quem já está logado não há para onde ir, e mandar para
  // /inicio sem aviso é um beco sem saída invisível — a paywall do futebol, que
  // esta página absorveu (issue #297), ao menos mostrava o botão desabilitado.
  const semGateway = !!user;
  const startCheckout = (_plan: PaidTier) => {
    if (semGateway) return;
    navigate('/auth');
  };
  const rotuloAssinar = (nome: string) => (semGateway ? 'Pagamento em breve' : `Assinar ${nome}`);

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <Seo route="/planos" jsonLd={PLANS_JSONLD} />
      <AnalyticsNav variant="rebrand" />

      {/* Promo de lançamento */}
      <div className="bg-forest text-white text-[13.5px]">
        <div className="max-w-[1240px] mx-auto px-4 md:px-6 py-2.5 flex items-center justify-center gap-2.5 flex-wrap text-center">
          <Flame className="w-[15px] h-[15px] shrink-0" style={{ color: '#ffd873' }} />
          <span><b style={{ color: '#ffd873' }}>Preço de lançamento</b> — valores promocionais por tempo limitado</span>
        </div>
      </div>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-[1240px] mx-auto px-4 md:px-6 pt-14 md:pt-16 pb-2">
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

        {/* Faixa da página foi de 1152 pra 1240 (mesmo eixo em hero, cards e
            tabela) porque com 4 colunas os cards ficavam espremidos. */}
        <section className="max-w-[1240px] mx-auto px-4 md:px-6 mt-6">
          {/* 4 níveis: 1 coluna no mobile, 2×2 no tablet, 4 no desktop. gap-y maior
              fora do desktop porque o selo "MAIS ESCOLHIDO" sobe além do card. */}
          <div className="grid gap-4 gap-y-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-y-4 items-stretch max-w-[460px] md:max-w-[760px] lg:max-w-none mx-auto">
            {/* GRÁTIS */}
            <div className="rounded-2xl bg-white border border-line p-6 lg:p-5 flex flex-col">
              <div className="text-[13px] font-bold tracking-[0.02em]">Grátis</div>
              <div className="text-[13.5px] text-ink-3 mt-1 min-h-[41px]">Pra sentir como funciona, sem pagar nada.</div>
              <div className="flex items-baseline gap-2 whitespace-nowrap mt-4 min-h-[44px]">
                <span className={PRICE_NUM}>
                  <span className="text-xl lg:text-lg font-bold opacity-60 mr-0.5">R$</span>0
                </span>
                <span className="text-[13px] text-ink-3">pra sempre</span>
              </div>
              <div className="text-[12.5px] text-ink-3 mt-1.5 min-h-[19px]">&nbsp;</div>
              <button onClick={freeCta.onClick} className="mt-5 w-full h-11 rounded-rebrand-sm text-sm font-bold bg-white border border-line-2 text-ink hover:border-forest hover:text-forest transition">
                {freeCta.label}
              </button>
              <ul className="mt-5 pt-5 border-t border-line flex flex-col gap-2.5 text-sm">
                <Feat>Futebol: <b className="text-ink font-semibold">7 dias grátis</b> de acesso completo</Feat>
                <Feat>NBA: <b className="text-ink font-semibold">2 picks do dia</b> liberados</Feat>
                <Feat>Betinho: até <b className="text-ink font-semibold">3 apostas por dia</b></Feat>
              </ul>
            </div>

            {/* ENTRADA — só o Betinho, sem produto de análise. */}
            <div className="rounded-2xl bg-white border border-line p-6 lg:p-5 flex flex-col">
              <div className="text-[13px] font-bold tracking-[0.02em]">Entrada</div>
              <div className="text-[13.5px] text-ink-3 mt-1 min-h-[41px]">Só o Betinho, sua banca no automático.</div>
              <PriceBlock tier="entrada" billing={billing} />
              <button onClick={() => startCheckout('entrada')} disabled={semGateway} className="mt-5 w-full h-11 rounded-rebrand-sm text-sm font-bold bg-white border border-line-2 text-ink hover:border-forest hover:text-forest transition disabled:opacity-60 disabled:hover:border-line-2 disabled:hover:text-ink disabled:cursor-default">
                {rotuloAssinar('Entrada')}
              </button>
              <ul className="mt-5 pt-5 border-t border-line flex flex-col gap-2.5 text-sm">
                <Feat><b className="text-ink font-semibold">Betinho ilimitado</b>, registra e liquida tudo no Telegram</Feat>
                <Feat>Resumo semanal da sua banca</Feat>
                <Feat>Seu histórico e seu lucro à mão</Feat>
                <NoFeat>Sem as análises de futebol e NBA</NoFeat>
              </ul>
            </div>

            {/* ESSENCIAL */}
            <div className="rounded-2xl bg-white border border-line p-6 lg:p-5 flex flex-col">
              <div className="text-[13px] font-bold tracking-[0.02em]">Essencial</div>
              <div className="text-[13.5px] text-ink-3 mt-1 min-h-[41px]">Futebol completo + a banca no automático.</div>
              <PriceBlock tier="essencial" billing={billing} />
              <button onClick={() => startCheckout('essencial')} disabled={semGateway} className="mt-5 w-full h-11 rounded-rebrand-sm text-sm font-bold bg-forest text-white hover:bg-forest-2 transition disabled:opacity-60 disabled:hover:bg-forest disabled:cursor-default">
                {rotuloAssinar('Essencial')}
              </button>
              <ul className="mt-5 pt-5 border-t border-line flex flex-col gap-2.5 text-sm">
                <Feat><b className="text-ink font-semibold">Futebol completo</b> — oportunidades e Score sem limite</Feat>
                <Feat><b className="text-ink font-semibold">Betinho ilimitado</b> — registra e liquida tudo no Telegram</Feat>
                <Feat>Resumo semanal da sua banca</Feat>
                <Feat>Suporte prioritário</Feat>
                <Feat>NBA: <b className="text-ink font-semibold">2 picks do dia</b> (completo só no Completo)</Feat>
              </ul>
            </div>

            {/* COMPLETO — slab forest */}
            <div className="relative rounded-2xl bg-forest border border-forest p-6 lg:p-5 flex flex-col text-[#eaf1ec] shadow-[0_18px_40px_-18px_rgba(10,61,46,0.55)]">
              <span
                className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold tracking-[0.08em] rounded-full px-3 py-1 whitespace-nowrap shadow-[0_4px_12px_-3px_rgba(212,160,23,0.5)]"
                style={{ background: '#d4a017', color: '#2a1f00' }}
              >
                MAIS ESCOLHIDO
              </span>
              <div className="text-[13px] font-bold tracking-[0.02em] text-white">Completo</div>
              <div className="text-[13.5px] mt-1 min-h-[41px]" style={{ color: '#a9c4b7' }}>
                Tudo. Futebol, NBA e Betinho no mesmo plano.
              </div>
              <div className="flex items-baseline gap-2 whitespace-nowrap mt-4 min-h-[44px]">
                {PRICES.completo[billing].strike && (
                  <span className="text-sm line-through tabular-nums" style={{ color: '#8fb0a2', textDecorationColor: '#8fb0a2' }}>
                    {PRICES.completo[billing].strike}
                  </span>
                )}
                <span className={`${PRICE_NUM} text-white`}>
                  <span className="text-xl lg:text-lg font-bold mr-0.5" style={{ color: '#ffd873' }}>R$</span>
                  {PRICES.completo[billing].amount}
                </span>
                <span className="text-[13px]" style={{ color: '#9fbcae' }}>{PRICES.completo[billing].per}</span>
              </div>
              <div className="text-[12.5px] mt-1.5 min-h-[19px]" style={{ color: '#9fbcae' }}>
                {PRICES.completo[billing].billed || ' '}
              </div>
              <button onClick={() => startCheckout('completo')} disabled={semGateway} className="mt-5 w-full h-11 rounded-rebrand-sm text-sm font-bold transition hover:brightness-95 disabled:opacity-60 disabled:hover:brightness-100 disabled:cursor-default" style={{ background: '#d4a017', color: '#2a1f00' }}>
                {rotuloAssinar('Completo')}
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
            Todos os planos pagos incluem o Betinho ilimitado e o teste grátis de 7 dias.
          </p>
        </section>

        {/* Comparação */}
        <section className="max-w-[1240px] mx-auto px-4 md:px-6 pt-20">
          <div className="text-center mb-8">
            <div className={EYEBROW}>Comparar</div>
            <h2 className="text-[22px] md:text-[26px] font-extrabold tracking-tight mt-2">Resumo dos planos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[720px]">
              <thead>
                <tr>
                  <th className="text-left py-4 px-4"></th>
                  <th className="py-4 px-4 text-[13px] font-bold">
                    Grátis<span className="block text-[12px] text-ink-3 font-medium mt-0.5 tabular-nums">R$ 0</span>
                  </th>
                  <th className="py-4 px-4 text-[13px] font-bold">
                    Entrada<span className="block text-[12px] text-ink-3 font-medium mt-0.5 tabular-nums">{TH.entrada[billing]}</span>
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
                  <th className="text-left px-4 text-sm font-semibold text-ink">Betinho no Telegram</th>
                  <td>3 apostas/dia</td>
                  <td>Ilimitado</td>
                  <td>Ilimitado</td>
                  <td className="bg-forest-tint">Ilimitado</td>
                </tr>
                <tr>
                  <th className="text-left px-4 text-sm font-semibold text-ink">Análise de futebol</th>
                  <td>7 dias grátis</td>
                  <td className="text-ink-3">Não inclui</td>
                  <td>Completa</td>
                  <td className="bg-forest-tint !text-forest font-semibold">Completa</td>
                </tr>
                <tr>
                  <th className="text-left px-4 text-sm font-semibold text-ink">Análise de NBA</th>
                  <td>2 picks/dia</td>
                  <td>2 picks/dia</td>
                  <td>2 picks/dia</td>
                  <td className="bg-forest-tint !text-forest font-semibold">Prop bets + Análise 360</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Os 2 picks da NBA são baseline de conta criada (vale até no grátis).
              Sem esta nota, o Entrada parece perder acesso ao assinar. */}
          <p className="text-[12.5px] text-ink-3 mt-3 px-4">
            Os 2 picks do dia da NBA são liberados em qualquer plano, inclusive no grátis.
          </p>
        </section>

        {/* FAQ */}
        <section className="max-w-[1240px] mx-auto px-4 md:px-6 pt-20">
          <div className="text-center mb-8">
            <div className={EYEBROW}>Dúvidas</div>
            <h2 className="text-[24px] md:text-[32px] font-extrabold tracking-tight mt-2">Antes de assinar</h2>
          </div>
          <div className="max-w-[760px] mx-auto">
            {[
              {
                q: 'O que vem no plano Entrada?',
                a: (<>Só o <b className="text-ink">Betinho</b>: você registra suas apostas no Telegram, ele liquida sozinho e te manda o resumo semanal da sua banca, sem limite de apostas por dia. As análises de futebol e NBA não entram no Entrada, elas começam no Essencial.</>),
                open: true,
              },
              {
                q: 'Por que o NBA só está no plano Completo?',
                a: (<>O NBA é a nossa análise <b className="text-ink">mais robusta</b> — prop bets, Análise 360 e o que temos de mais avançado. O Essencial já entrega o futebol completo pro seu dia a dia; o Completo é pra quem quer <b className="text-ink">tudo</b> junto. Você não paga por esporte solto: paga por até onde quer ir.</>),
              },
              { q: 'Posso trocar de plano depois?', a: <>Pode, quando quiser. Se subir de plano, o valor é ajustado proporcionalmente; se descer, a troca vale no fim do ciclo. Sem multa, sem burocracia.</> },
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
        <section className="max-w-[1240px] mx-auto px-4 md:px-6 pt-20 pb-14">
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
