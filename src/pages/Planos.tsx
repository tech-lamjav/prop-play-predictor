import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, Flame, X } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { useAuth } from '@/hooks/use-auth';
import { Seo, SITE_URL } from '@/components/Seo';

type Billing = 'monthly' | 'annual';
type PaidTier = 'entrada' | 'essencial' | 'completo';

/* Preços — PLACEHOLDERS. Trocar quando o modelo de cobrança fechar.
   Mensal: preço de lançamento (de/por). Anual: −20% sobre o mensal de lançamento.
   Entrada fica FORA da promo de lançamento (sem de/por): já é o piso da escada.

   ⚠️ O PREÇO NÃO ENTRA NO CATÁLOGO (#540). Valor em real e símbolo da moeda
   vivem só aqui: moeda e preço por país são decisão comercial, e estão fora do
   escopo do #532. O que o catálogo traduz é o texto AO REDOR do preço — "/mês",
   "cobrado ... /ano", "pra sempre" —, e ele recebe o valor por interpolação.
   `anual` guarda o total anual já com o símbolo, e vazio quando não há. */
const PRICES = {
  entrada: {
    monthly: { amount: '14,90', anual: '', strike: '' },
    annual: { amount: '11,90', anual: 'R$ 143', strike: '' },
  },
  essencial: {
    monthly: { amount: '39,90', anual: '', strike: 'R$ 49,90' },
    annual: { amount: '31,90', anual: 'R$ 383', strike: 'R$ 39,90' },
  },
  completo: {
    monthly: { amount: '89,90', anual: '', strike: 'R$ 109,90' },
    annual: { amount: '71,90', anual: 'R$ 863', strike: 'R$ 89,90' },
  },
} as const;

/* Nomes dos planos para o JSON-LD, que é montado FORA do componente e por isso
   não tem `t`. Indexação em buscador está fora do escopo do #540; o nome que a
   tela mostra vem do catálogo (`planos.cartoes.<tier>.nome`). */
const PLAN_NAMES: Record<PaidTier, string> = {
  entrada: 'Entrada',
  essencial: 'Essencial',
  completo: 'Completo',
};

const EYEBROW = 'text-[11px] font-bold uppercase tracking-[0.16em] text-forest-2';

/* Corpo do número do preço. Menor no lg porque lá são 4 colunas: com 40px o
   preço + "/mês" não cabia numa linha nos cards com preço riscado. */
const PRICE_NUM = 'font-extrabold text-[40px] lg:text-[34px] leading-none tracking-tight tabular-nums';

/* Preço mostrado no cabeçalho da tabela de comparação — só o dinheiro; o "/mês"
   entra por interpolação, do catálogo. */
const TH: Record<PaidTier, Record<Billing, string>> = {
  entrada: { monthly: 'R$ 14,90', annual: 'R$ 11,90' },
  essencial: { monthly: 'R$ 39,90', annual: 'R$ 31,90' },
  completo: { monthly: 'R$ 89,90', annual: 'R$ 71,90' },
};

// JSON-LD dos planos DERIVADO do PRICES acima — nunca hardcode preço aqui:
// o Google exige que o structured data bata com o que a página exibe, e
// derivando não tem drift quando os valores (hoje placeholders) mudarem.
const brl = (s: string) => s.replace(/R\$\s*/, '').replace(/\./g, '').replace(',', '.');
const annualTotal = (anual: string) => (anual ? brl(anual) : null);
const PLAN_JSONLD_DESC: Record<PaidTier, string> = {
  entrada: 'Betinho ilimitado no Telegram: registra e liquida suas apostas e manda o resumo semanal da banca. Sem as análises de futebol e NBA.',
  essencial: 'Futebol completo (Brasileirão e Copa) + Betinho ilimitado. Teste grátis de 48 horas.',
  completo: 'Tudo do Essencial + análise NBA completa (prop bets e Análise 360). Teste grátis de 48 horas.',
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
          price: annualTotal(PRICES[tier].annual.anual) ?? brl(PRICES[tier].annual.amount),
          priceCurrency: 'BRL',
          url: `${SITE_URL}/planos`,
        },
      ],
    })),
  ],
};

function PriceBlock({ tier, billing }: { tier: PaidTier; billing: Billing }) {
  const { t } = useTranslation('planos');
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
        <span className="text-[13px] text-ink-3">{t('planos.preco.porMes')}</span>
      </div>
      <div className="text-[12.5px] text-ink-3 mt-1.5 min-h-[19px]">
        {p.anual ? t('planos.preco.cobradoAnual', { valorAnual: p.anual }) : ' '}
      </div>
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
  const { t } = useTranslation('planos');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [billing, setBilling] = useState<Billing>('monthly');

  /* O destaque em negrito dentro de um item de lista. `Trans` e não
     concatenação: o pedaço em negrito cai no meio da frase, e em outro idioma
     ele cai em outro lugar. */
  const forte = (chave: string) => (
    <Trans t={t} i18nKey={chave} components={[<b className="text-ink font-semibold" key="forte" />]} />
  );

  // CTA do plano grátis: deslogado cria conta; logado já tem conta → entra no app.
  const freeCta = user
    ? { label: t('planos.acoes.acessar'), onClick: () => navigate('/inicio') }
    : { label: t('planos.acoes.criarConta'), onClick: () => navigate('/auth') };

  // Cada plano pago leva à paywall do produto que ele vende, em vez de esperar
  // um checkout unificado que nunca chegou. Não é o desenho final — é parar de
  // exibir botão morto no momento de maior intenção de compra da página.
  //
  // As duas telas de destino já cobram de verdade e já tratam quem chega
  // deslogado (mandam para /auth), então não há caso especial aqui.
  //
  // O Completo segue sem destino de propósito: o preço dele não existe no
  // Stripe, e a NBA — o único diferencial dele sobre o Essencial — não está
  // recebendo cliente novo. Botão desabilitado é honesto; botão que cobra o
  // plano errado, não.
  const DESTINO: Record<PaidTier, string | null> = {
    entrada: '/paywall',           // Betinho — R$ 14,90/mês
    essencial: '/futebol/assinar', // Futebol + Betinho ilimitado — R$ 39,90/mês
    completo: null,
  };

  // Os preços anuais não existem no Stripe. Mandar quem escolheu "Anual" para
  // uma tela que cobra mensal seria cobrar diferente do que a página prometeu.
  const anualIndisponivel = billing === 'annual';

  const ctaPago = (plan: PaidTier) => {
    if (anualIndisponivel) {
      return { label: t('planos.acoes.anualEmBreve'), disabled: true, onClick: () => {} };
    }
    const destino = DESTINO[plan];
    if (!destino) {
      return { label: t('planos.acoes.pagamentoEmBreve'), disabled: true, onClick: () => {} };
    }
    return {
      // Interpolação, e não concatenação: em espanhol o nome do plano entra
      // depois de uma preposição ("Suscribirse a Esencial").
      label: t('planos.acoes.assinarPlano', { plano: t(`planos.cartoes.${plan}.nome`) }),
      disabled: false,
      onClick: () => navigate(destino),
    };
  };

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <Seo route="/planos" jsonLd={PLANS_JSONLD} />
      <AnalyticsNav variant="rebrand" />

      {/* Promo de lançamento */}
      <div className="bg-forest text-white text-[13.5px]">
        <div className="max-w-[1240px] mx-auto px-4 md:px-6 py-2.5 flex items-center justify-center gap-2.5 flex-wrap text-center">
          <Flame className="w-[15px] h-[15px] shrink-0" style={{ color: '#ffd873' }} />
          <span>
            <Trans
              t={t}
              i18nKey="planos.promo"
              components={[<b style={{ color: '#ffd873' }} key="destaque" />]}
            />
          </span>
        </div>
      </div>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-[1240px] mx-auto px-4 md:px-6 pt-14 md:pt-16 pb-2">
          <div className={EYEBROW}>{t('planos.hero.etiqueta')}</div>
          <h1 className="text-[34px] md:text-[52px] font-extrabold leading-[1.04] tracking-tight mt-3.5 max-w-[15ch] text-balance">
            <Trans
              t={t}
              i18nKey="planos.hero.titulo"
              components={[<span className="text-forest" key="destaque" />]}
            />
          </h1>
          <p className="text-[17px] md:text-[18px] text-ink-2 mt-4 max-w-[52ch] leading-relaxed">
            {t('planos.hero.chamada')}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 text-[13.5px] text-ink-3">
            {(['teste', 'cancelar', 'pagamento'] as const).map((chave) => (
              <span key={chave} className="inline-flex items-center gap-1.5">
                <Check className="w-[15px] h-[15px] text-status-success" /> {t(`planos.hero.chips.${chave}`)}
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
              {t('planos.cobranca.mensal')}
            </button>
            <button
              type="button"
              onClick={() => setBilling('annual')}
              className={`h-9 pl-5 pr-2.5 rounded-full text-sm font-semibold transition-colors inline-flex items-center gap-2 ${billing === 'annual' ? 'bg-forest text-white' : 'text-ink-2 hover:text-ink'}`}
            >
              {t('planos.cobranca.anual')}
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
              <div className="text-[13px] font-bold tracking-[0.02em]">{t('planos.cartoes.gratis.nome')}</div>
              <div className="text-[13.5px] text-ink-3 mt-1 min-h-[41px]">{t('planos.cartoes.gratis.chamada')}</div>
              <div className="flex items-baseline gap-2 whitespace-nowrap mt-4 min-h-[44px]">
                <span className={PRICE_NUM}>
                  <span className="text-xl lg:text-lg font-bold opacity-60 mr-0.5">R$</span>0
                </span>
                <span className="text-[13px] text-ink-3">{t('planos.preco.paraSempre')}</span>
              </div>
              <div className="text-[12.5px] text-ink-3 mt-1.5 min-h-[19px]">&nbsp;</div>
              <button onClick={freeCta.onClick} className="mt-5 w-full h-11 rounded-rebrand-sm text-sm font-bold bg-white border border-line-2 text-ink hover:border-forest hover:text-forest transition">
                {freeCta.label}
              </button>
              <ul className="mt-5 pt-5 border-t border-line flex flex-col gap-2.5 text-sm">
                <Feat>{forte('planos.cartoes.gratis.itens.futebol')}</Feat>
                <Feat>{forte('planos.cartoes.gratis.itens.nba')}</Feat>
                <Feat>{forte('planos.cartoes.gratis.itens.betinho')}</Feat>
              </ul>
            </div>

            {/* ENTRADA — só o Betinho, sem produto de análise. */}
            <div className="rounded-2xl bg-white border border-line p-6 lg:p-5 flex flex-col">
              <div className="text-[13px] font-bold tracking-[0.02em]">{t('planos.cartoes.entrada.nome')}</div>
              <div className="text-[13.5px] text-ink-3 mt-1 min-h-[41px]">{t('planos.cartoes.entrada.chamada')}</div>
              <PriceBlock tier="entrada" billing={billing} />
              <button onClick={ctaPago('entrada').onClick} disabled={ctaPago('entrada').disabled} className="mt-5 w-full h-11 rounded-rebrand-sm text-sm font-bold bg-white border border-line-2 text-ink hover:border-forest hover:text-forest transition disabled:opacity-60 disabled:hover:border-line-2 disabled:hover:text-ink disabled:cursor-default">
                {ctaPago('entrada').label}
              </button>
              <ul className="mt-5 pt-5 border-t border-line flex flex-col gap-2.5 text-sm">
                <Feat>{forte('planos.cartoes.entrada.itens.betinho')}</Feat>
                <Feat>{t('planos.cartoes.entrada.itens.resumo')}</Feat>
                <Feat>{t('planos.cartoes.entrada.itens.historico')}</Feat>
                <NoFeat>{t('planos.cartoes.entrada.itens.semAnalises')}</NoFeat>
              </ul>
            </div>

            {/* ESSENCIAL */}
            <div className="rounded-2xl bg-white border border-line p-6 lg:p-5 flex flex-col">
              <div className="text-[13px] font-bold tracking-[0.02em]">{t('planos.cartoes.essencial.nome')}</div>
              <div className="text-[13.5px] text-ink-3 mt-1 min-h-[41px]">{t('planos.cartoes.essencial.chamada')}</div>
              <PriceBlock tier="essencial" billing={billing} />
              <button onClick={ctaPago('essencial').onClick} disabled={ctaPago('essencial').disabled} className="mt-5 w-full h-11 rounded-rebrand-sm text-sm font-bold bg-forest text-white hover:bg-forest-2 transition disabled:opacity-60 disabled:hover:bg-forest disabled:cursor-default">
                {ctaPago('essencial').label}
              </button>
              <ul className="mt-5 pt-5 border-t border-line flex flex-col gap-2.5 text-sm">
                <Feat>{forte('planos.cartoes.essencial.itens.futebol')}</Feat>
                <Feat>{forte('planos.cartoes.essencial.itens.betinho')}</Feat>
                <Feat>{t('planos.cartoes.essencial.itens.resumo')}</Feat>
                <Feat>{t('planos.cartoes.essencial.itens.suporte')}</Feat>
                <Feat>{forte('planos.cartoes.essencial.itens.nba')}</Feat>
              </ul>
            </div>

            {/* COMPLETO — slab forest */}
            <div className="relative rounded-2xl bg-forest border border-forest p-6 lg:p-5 flex flex-col text-[#eaf1ec] shadow-[0_18px_40px_-18px_rgba(10,61,46,0.55)]">
              <span
                className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold tracking-[0.08em] rounded-full px-3 py-1 whitespace-nowrap shadow-[0_4px_12px_-3px_rgba(212,160,23,0.5)]"
                style={{ background: '#d4a017', color: '#2a1f00' }}
              >
                {t('planos.cartoes.completo.selo')}
              </span>
              <div className="text-[13px] font-bold tracking-[0.02em] text-white">{t('planos.cartoes.completo.nome')}</div>
              <div className="text-[13.5px] mt-1 min-h-[41px]" style={{ color: '#a9c4b7' }}>
                {t('planos.cartoes.completo.chamada')}
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
                <span className="text-[13px]" style={{ color: '#9fbcae' }}>{t('planos.preco.porMes')}</span>
              </div>
              <div className="text-[12.5px] mt-1.5 min-h-[19px]" style={{ color: '#9fbcae' }}>
                {PRICES.completo[billing].anual
                  ? t('planos.preco.cobradoAnual', { valorAnual: PRICES.completo[billing].anual })
                  : ' '}
              </div>
              <button onClick={ctaPago('completo').onClick} disabled={ctaPago('completo').disabled} className="mt-5 w-full h-11 rounded-rebrand-sm text-sm font-bold transition hover:brightness-95 disabled:opacity-60 disabled:hover:brightness-100 disabled:cursor-default" style={{ background: '#d4a017', color: '#2a1f00' }}>
                {ctaPago('completo').label}
              </button>
              <ul className="mt-5 pt-5 flex flex-col gap-2.5 text-sm" style={{ borderTop: '1px solid rgba(255,255,255,0.14)' }}>
                {[
                  t('planos.cartoes.completo.itens.essencial'),
                  <Trans
                    key="nba"
                    t={t}
                    i18nKey="planos.cartoes.completo.itens.nba"
                    components={[<b className="text-white font-semibold" key="forte" />]}
                  />,
                  t('planos.cartoes.completo.itens.esportes'),
                  t('planos.cartoes.completo.itens.suporte'),
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
            {t('planos.cartoes.rodape')}
          </p>
        </section>

        {/* Comparação */}
        <section className="max-w-[1240px] mx-auto px-4 md:px-6 pt-20">
          <div className="text-center mb-8">
            <div className={EYEBROW}>{t('planos.comparacao.etiqueta')}</div>
            <h2 className="text-[22px] md:text-[26px] font-extrabold tracking-tight mt-2">{t('planos.comparacao.titulo')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[720px]">
              <thead>
                <tr>
                  <th className="text-left py-4 px-4"></th>
                  <th className="py-4 px-4 text-[13px] font-bold">
                    {t('planos.cartoes.gratis.nome')}<span className="block text-[12px] text-ink-3 font-medium mt-0.5 tabular-nums">R$ 0</span>
                  </th>
                  <th className="py-4 px-4 text-[13px] font-bold">
                    {t('planos.cartoes.entrada.nome')}<span className="block text-[12px] text-ink-3 font-medium mt-0.5 tabular-nums">{t('planos.preco.valorPorMes', { valor: TH.entrada[billing] })}</span>
                  </th>
                  <th className="py-4 px-4 text-[13px] font-bold">
                    {t('planos.cartoes.essencial.nome')}<span className="block text-[12px] text-ink-3 font-medium mt-0.5 tabular-nums">{t('planos.preco.valorPorMes', { valor: TH.essencial[billing] })}</span>
                  </th>
                  <th className="py-4 px-4 text-[13px] font-bold bg-forest-tint rounded-t-[10px]">
                    {t('planos.cartoes.completo.nome')}<span className="block text-[12px] text-ink-3 font-medium mt-0.5 tabular-nums">{t('planos.preco.valorPorMes', { valor: TH.completo[billing] })}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="[&_td]:py-[15px] [&_td]:px-4 [&_td]:text-center [&_td]:text-sm [&_td]:text-ink-2 [&_td]:border-b [&_td]:border-line [&_th]:border-b [&_th]:border-line">
                <tr>
                  <th className="text-left px-4 text-sm font-semibold text-ink">{t('planos.comparacao.linhas.betinho')}</th>
                  <td>{t('planos.comparacao.valores.apostasPorDia')}</td>
                  <td>{t('planos.comparacao.valores.ilimitado')}</td>
                  <td>{t('planos.comparacao.valores.ilimitado')}</td>
                  <td className="bg-forest-tint">{t('planos.comparacao.valores.ilimitado')}</td>
                </tr>
                <tr>
                  <th className="text-left px-4 text-sm font-semibold text-ink">{t('planos.comparacao.linhas.futebol')}</th>
                  <td>{t('planos.comparacao.valores.horasGratis')}</td>
                  <td className="text-ink-3">{t('planos.comparacao.valores.naoInclui')}</td>
                  <td>{t('planos.comparacao.valores.completa')}</td>
                  <td className="bg-forest-tint !text-forest font-semibold">{t('planos.comparacao.valores.completa')}</td>
                </tr>
                <tr>
                  <th className="text-left px-4 text-sm font-semibold text-ink">{t('planos.comparacao.linhas.nba')}</th>
                  <td>{t('planos.comparacao.valores.picksPorDia')}</td>
                  <td>{t('planos.comparacao.valores.picksPorDia')}</td>
                  <td>{t('planos.comparacao.valores.picksPorDia')}</td>
                  <td className="bg-forest-tint !text-forest font-semibold">{t('planos.comparacao.valores.nbaCompleto')}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Os 2 picks da NBA são baseline de conta criada (vale até no grátis).
              Sem esta nota, o Entrada parece perder acesso ao assinar. */}
          <p className="text-[12.5px] text-ink-3 mt-3 px-4">
            {t('planos.comparacao.nota')}
          </p>
        </section>

        {/* FAQ */}
        <section className="max-w-[1240px] mx-auto px-4 md:px-6 pt-20">
          <div className="text-center mb-8">
            <div className={EYEBROW}>{t('planos.faq.etiqueta')}</div>
            <h2 className="text-[24px] md:text-[32px] font-extrabold tracking-tight mt-2">{t('planos.faq.titulo')}</h2>
          </div>
          <div className="max-w-[760px] mx-auto">
            {([
              { chave: 'entrada', open: true },
              { chave: 'nba', open: false },
              { chave: 'trocar', open: false },
              { chave: 'teste', open: false },
              { chave: 'pix', open: false },
              { chave: 'cancelar', open: false },
            ] as const).map(({ chave, open }) => (
              <details key={chave} open={open} className="group border-b border-line">
                <summary className="cursor-pointer list-none py-[18px] pr-10 font-semibold text-[16.5px] text-ink relative marker:hidden [&::-webkit-details-marker]:hidden">
                  {t(`planos.faq.${chave}.pergunta`)}
                  <span className="absolute right-1.5 top-1/2 w-2.5 h-2.5 border-r-2 border-b-2 border-ink-3 -translate-y-[70%] rotate-45 transition-transform group-open:-translate-y-[30%] group-open:rotate-[225deg]" />
                </summary>
                <div className="pb-[18px] pr-10 text-[15px] text-ink-2 max-w-[68ch]">
                  {/* Dois destaques no máximo, e o catálogo decide onde eles
                      caem: em espanhol a ordem da frase não é a do português. */}
                  <Trans
                    t={t}
                    i18nKey={`planos.faq.${chave}.resposta`}
                    components={[
                      <b className="text-ink" key="forte1" />,
                      <b className="text-ink" key="forte2" />,
                    ]}
                  />
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="max-w-[1240px] mx-auto px-4 md:px-6 pt-20 pb-14">
          <div className="rounded-[20px] bg-forest text-white text-center px-8 py-12">
            <h2 className="text-[26px] md:text-[38px] font-extrabold tracking-tight">{t('planos.final.titulo')}</h2>
            <p className="mt-3 mb-7 mx-auto max-w-[46ch]" style={{ color: '#a9c4b7' }}>
              {t('planos.final.texto')}
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
