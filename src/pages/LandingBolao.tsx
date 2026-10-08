import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import {
  Trophy,
  Users,
  Zap,
  Crown,
  Target,
  ArrowRight,
  Shield,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';

/**
 * Landing pública do Bolão Copa 2026 — visível em /bolao quando user
 * está deslogado. Foco em conversão pra signup + SEO meta tags. Paleta
 * "Direção A" (canvas/forest/amber).
 *
 * A copy vem do catálogo `bolao` no idioma ativo (#539), e não mais de texto
 * fixo aqui: esta é uma das duas telas públicas do bolão, e é a porta de
 * entrada de quem chega de Peru, Argentina, México ou Chile.
 */
const LandingBolao: React.FC = () => {
  const { t } = useTranslation('bolao');
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('landing_bolao_viewed');
    }
  }, []);

  const handleCTA = (source: string) => {
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('landing_bolao_cta_clicked', { source });
    }
    navigate('/auth?next=/bolao');
  };

  return (
    <>
      {/* O canonical daqui apontava pra smartbetting.app sem www, host
          diferente do canônico do site. Agora sai do <Seo> (com www). */}
      <Seo route="/bolao" />

      <main className="theme-bolao min-h-screen bg-canvas text-ink">
        {/* ─── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-forest text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-forest via-forest-2 to-forest pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(212,160,23,0.18),transparent_55%)] pointer-events-none" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-12 sm:pt-24 sm:pb-20 text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] bg-amber/[0.18] text-amber border border-amber/40 mb-5">
              <Trophy className="w-3.5 h-3.5" />
              {t('landing.selo')}
            </span>
            <h1 className="font-display text-4xl sm:text-6xl font-black leading-tight mb-4">
              {/* Duas FRASES inteiras, uma por linha — e não uma frase cortada
                  ao meio. Por isso são duas chaves, e não um `Trans`. */}
              {t('landing.titulo')}<br />
              <span className="text-amber">{t('landing.tituloDestaque')}</span>
            </h1>
            <p className="text-base sm:text-xl text-white/80 max-w-2xl mx-auto mb-8 leading-relaxed">
              {t('landing.chamada')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleCTA('hero_primary')}
                className="inline-flex items-center gap-2 h-12 px-6 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
              >
                {t('acoes.criarGratis')}
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-[12px] text-white/60 mt-1 sm:mt-0 sm:ml-2">
                {t('landing.semBurocracia')}
              </p>
            </div>

            {/* Quick stats */}
            <div className="mt-10 grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-black text-amber tabular-nums">104</p>
                <p className="text-[10px] sm:text-[11px] text-white/60 uppercase tracking-[0.12em] mt-1">{t('landing.numeros.jogos')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-black text-amber tabular-nums">48</p>
                <p className="text-[10px] sm:text-[11px] text-white/60 uppercase tracking-[0.12em] mt-1">{t('landing.numeros.selecoes')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-black text-amber tabular-nums">12</p>
                <p className="text-[10px] sm:text-[11px] text-white/60 uppercase tracking-[0.12em] mt-1">{t('landing.numeros.grupos')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Como funciona ───────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">
              {t('comoFunciona.etiqueta')}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-black text-ink">
              {t('comoFunciona.titulo')}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                num: '1',
                icon: Trophy,
                title: t('landing.passos.criar.titulo'),
                text: t('landing.passos.criar.texto'),
              },
              {
                num: '2',
                icon: MessageCircle,
                title: t('landing.passos.convidar.titulo'),
                text: t('landing.passos.convidar.texto'),
              },
              {
                num: '3',
                icon: Target,
                title: t('landing.passos.palpitar.titulo'),
                text: t('landing.passos.palpitar.texto'),
              },
            ].map((step) => (
              <div
                key={step.num}
                className="rounded-rebrand-lg border border-line bg-white p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-8 rounded-full bg-forest/[0.10] border border-forest/30 flex items-center justify-center text-sm font-black text-forest">
                    {step.num}
                  </span>
                  <step.icon className="w-5 h-5 text-forest" />
                </div>
                <h3 className="text-[16px] font-bold text-ink mb-1">{step.title}</h3>
                <p className="text-[13px] text-ink-2 leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Free vs Premium ─────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">
              {t('landing.planos.etiqueta')}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-black text-ink mb-2">
              {t('landing.planos.titulo')}
            </h2>
            <p className="text-[13px] text-ink-2">
              {t('landing.planos.chamada')}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Free */}
            <div className="rounded-rebrand-lg border border-line bg-white p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-2 mb-2">
                {t('landing.planos.free.nome')}
              </p>
              {/* O preço NÃO passa pelo catálogo: a #532 mantém a cobrança em
                  real e na régua brasileira, e símbolo de moeda dentro de
                  texto traduzido é convite a alguém trocar o R$ por outro. */}
              <p className="font-display text-3xl font-black text-ink mb-1">R$ 0</p>
              <p className="text-[12px] text-ink-3 mb-5">{t('landing.planos.free.condicao')}</p>
              <ul className="space-y-2.5 text-[13px]">
                {/* A chave de React é o NOME do item, e não o texto: o texto
                    muda ao trocar de idioma, e a lista inteira remontaria. */}
                {[
                  'participantes',
                  'pontuacao',
                  'multiplicador',
                  'especiais',
                  'ranking',
                  'identidade',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-forest shrink-0 mt-0.5" />
                    <span className="text-ink-2">{t(`landing.planos.free.itens.${item}`)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Premium */}
            <div className="rounded-rebrand-lg border-2 border-amber/50 bg-amber/[0.06] p-6 relative">
              <span className="absolute -top-3 left-6 text-[10px] px-2 py-0.5 bg-amber text-white font-bold uppercase tracking-[0.12em] rounded-full shadow-sm">
                {t('landing.planos.premium.selo')}
              </span>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-2 mb-2">
                {t('landing.planos.premium.nome')}
              </p>
              <p className="font-display text-3xl font-black text-amber-2 mb-1">R$ 19,90</p>
              <p className="text-[12px] text-ink-2 mb-5">{t('landing.planos.premium.condicao')}</p>
              <ul className="space-y-2.5 text-[13px]">
                {[
                  { chave: 'ilimitado', strong: true },
                  { chave: 'tudoDoFree', strong: true },
                ].map((f) => (
                  <li key={f.chave} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-2 shrink-0 mt-0.5" />
                    <span className={f.strong ? 'font-bold text-ink' : 'text-ink-2'}>
                      {t(`landing.planos.premium.itens.${f.chave}`)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-ink-3 mt-4 leading-snug">
                {t('landing.planos.premium.rodape')}
              </p>
            </div>
          </div>
        </section>

        {/* ─── Diferenciais ────────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 border-t border-line">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                chave: 'cadastro',
                icon: Users,
                title: t('landing.diferenciais.cadastro.titulo'),
                text: t('landing.diferenciais.cadastro.texto'),
              },
              {
                chave: 'automatico',
                icon: Zap,
                title: t('landing.diferenciais.automatico.titulo'),
                text: t('landing.diferenciais.automatico.texto'),
              },
              {
                chave: 'regras',
                icon: Shield,
                title: t('landing.diferenciais.regras.titulo'),
                text: t('landing.diferenciais.regras.texto'),
              },
            ].map((b) => (
              <div key={b.chave} className="text-center">
                <div className="w-12 h-12 rounded-rebrand-md bg-forest/[0.08] border border-forest/30 flex items-center justify-center mx-auto mb-3">
                  <b.icon className="w-5 h-5 text-forest" />
                </div>
                <h3 className="text-[15px] font-bold text-ink mb-1">{b.title}</h3>
                <p className="text-[12px] text-ink-2 leading-relaxed">{b.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── FAQ ────────────────────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 border-t border-line">
          <div className="text-center mb-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">
              {t('landing.faq.etiqueta')}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-black text-ink">{t('landing.faq.titulo')}</h2>
          </div>
          <div className="space-y-3">
            {[
              'gratuidade',
              'convite',
              'sair',
              'placares',
              'varios',
              'premium',
            ].map((chave) => (
              <details
                key={chave}
                className="group rounded-rebrand-md border border-line bg-white px-5 py-4 cursor-pointer hover:border-line-2 transition-colors"
              >
                <summary className="flex items-center justify-between gap-3 list-none font-bold text-[14px] text-ink">
                  {t(`landing.faq.${chave}.pergunta`)}
                  <ArrowRight className="w-4 h-4 text-ink-3 group-open:rotate-90 transition-transform shrink-0" />
                </summary>
                <p className="text-[13px] text-ink-2 mt-3 leading-relaxed">
                  {t(`landing.faq.${chave}.resposta`)}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ─── CTA final ──────────────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
          <div className="rounded-rebrand-xl bg-forest text-white p-8 sm:p-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(212,160,23,0.15),transparent_60%)] pointer-events-none" />
            <div className="relative">
              <Crown className="w-12 h-12 text-amber mx-auto mb-4" />
              <h2 className="font-display text-2xl sm:text-3xl font-black mb-3">
                {t('landing.fechamento.titulo')}
              </h2>
              <p className="text-[15px] text-white/80 mb-6 max-w-lg mx-auto leading-relaxed">
                {t('landing.fechamento.texto')}
              </p>
              <button
                type="button"
                onClick={() => handleCTA('footer_cta')}
                className="inline-flex items-center gap-2 h-12 px-8 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
              >
                {t('acoes.criarGratis')}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default LandingBolao;
