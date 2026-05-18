import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Trophy, Plus, Users, Sparkles, ChevronRight, Check } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import AnalyticsNav from '@/components/AnalyticsNav';

/**
 * Landing page enxuta (2 dobras) focada em conversão de donos de bolão.
 *
 * Rota: /bolao/comecar (pública — não exige login).
 *
 * Fluxo do CTA principal "Criar meu bolão grátis":
 *  - Logado     → navigate('/bolao?create=true')
 *  - Deslogado  → navigate('/auth', { state.from = { pathname: '/bolao', search: '?create=true' } })
 *
 * BolaoHome lê `?create=true` e auto-abre o modal de criar bolão ao montar,
 * então o user que veio da LP cai direto no fluxo de criação após login.
 */
const BolaoLP: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const handleStart = () => {
    if (authLoading) return; // evita disparo prematuro enquanto auth resolve
    if (user) {
      navigate('/bolao?create=true');
    } else {
      navigate('/auth', {
        state: { from: { pathname: '/bolao', search: '?create=true' } },
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>Crie seu bolão da Copa 2026 — Smartbetting</title>
        <meta
          name="description"
          content="Crie seu bolão da Copa em 30 segundos. Convide a galera no WhatsApp, palpite os 104 jogos, veja quem manja mais. Grátis pra até 20 amigos."
        />
        <meta property="og:title" content="Crie seu bolão da Copa 2026" />
        <meta
          property="og:description"
          content="Reúna a galera, palpite todos os 104 jogos. Grátis. Sem cartão."
        />
      </Helmet>

      <AnalyticsNav variant="rebrand" />

      <div className="bg-canvas min-h-screen">
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* DOBRA 1 — HERO (forest)                                     */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-forest text-white overflow-hidden relative">
          {/* decorações atmosféricas */}
          <div
            className="absolute -right-32 -top-32 w-96 h-96 rounded-full bg-amber/10 pointer-events-none"
            aria-hidden
          />
          <div
            className="absolute right-20 top-20 w-40 h-40 rounded-full bg-amber/10 pointer-events-none"
            aria-hidden
          />
          <div
            className="absolute -left-20 bottom-0 w-72 h-72 rounded-full bg-amber/5 pointer-events-none"
            aria-hidden
          />

          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-32 relative">
            <div className="max-w-[680px]">
              <div className="text-[12px] uppercase tracking-[0.18em] font-semibold opacity-70 mb-3">
                Bolão · Copa do Mundo 2026
              </div>
              <h1 className="font-display text-[44px] sm:text-[60px] lg:text-[68px] leading-[1.02] font-extrabold mb-5 tracking-tight">
                Crie seu bolão em{' '}
                <span className="text-amber">30 segundos</span>.
              </h1>
              <p className="text-[16px] sm:text-[18px] opacity-85 leading-relaxed mb-8 max-w-[560px]">
                Reúna a galera, palpite todos os 104 jogos, veja quem manja mais. Grátis pra até 20 amigos. Sem cartão, sem app pra instalar.
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <Button
                  variant="amber"
                  size="lg"
                  onClick={handleStart}
                  disabled={authLoading}
                  className="rounded-rebrand-md gap-2 h-12 text-[15px] shadow-lg shadow-amber/20"
                >
                  <Plus className="w-4 h-4" />
                  Criar meu bolão grátis
                </Button>
                <button
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="text-white/70 hover:text-white text-[14px] underline-offset-4 hover:underline transition-colors text-left sm:text-center"
                >
                  Já tem código? Entrar aqui →
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-7 text-[12px] opacity-70">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-amber" /> 100% gratuito
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-amber" /> Sem cartão
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-amber" /> Sem instalar nada
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* DOBRA 2 — COMO FUNCIONA + CTA repetido                      */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="bg-canvas">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
            <div className="text-center mb-12 sm:mb-14">
              <div className="text-[12px] uppercase tracking-[0.18em] font-semibold text-ink-2 mb-2">
                Como funciona
              </div>
              <h2 className="font-display text-[30px] sm:text-[40px] font-extrabold text-ink leading-tight">
                3 passos. Sem complicação.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
              {/* Passo 1 — Criar */}
              <div className="bg-white border border-line rounded-rebrand-xl p-6 sm:p-7 relative hover:border-forest/30 hover:shadow-sm transition-all">
                <div className="absolute -top-4 left-5 w-11 h-11 rounded-full bg-forest text-white font-display text-[18px] font-bold grid place-items-center shadow-md">
                  1
                </div>
                <div className="w-12 h-12 rounded-rebrand-md bg-amber/10 grid place-items-center text-amber-2 mb-4 mt-3">
                  <Plus className="w-6 h-6" />
                </div>
                <h3 className="font-display text-[18px] font-bold text-ink mb-2">
                  Cria em 1 minuto
                </h3>
                <p className="text-[14px] text-ink-2 leading-relaxed">
                  Escolhe um nome, define a pontuação se quiser, pronto. Você é dono do seu bolão.
                </p>
              </div>

              {/* Passo 2 — Convidar */}
              <div className="bg-white border border-line rounded-rebrand-xl p-6 sm:p-7 relative hover:border-forest/30 hover:shadow-sm transition-all">
                <div className="absolute -top-4 left-5 w-11 h-11 rounded-full bg-forest text-white font-display text-[18px] font-bold grid place-items-center shadow-md">
                  2
                </div>
                <div className="w-12 h-12 rounded-rebrand-md bg-amber/10 grid place-items-center text-amber-2 mb-4 mt-3">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="font-display text-[18px] font-bold text-ink mb-2">
                  Chama no WhatsApp
                </h3>
                <p className="text-[14px] text-ink-2 leading-relaxed">
                  Manda o link no grupo da família, da firma, dos amigos. Quem clicar entra com 1 toque.
                </p>
              </div>

              {/* Passo 3 — Palpitar */}
              <div className="bg-white border border-line rounded-rebrand-xl p-6 sm:p-7 relative hover:border-forest/30 hover:shadow-sm transition-all">
                <div className="absolute -top-4 left-5 w-11 h-11 rounded-full bg-forest text-white font-display text-[18px] font-bold grid place-items-center shadow-md">
                  3
                </div>
                <div className="w-12 h-12 rounded-rebrand-md bg-amber/10 grid place-items-center text-amber-2 mb-4 mt-3">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="font-display text-[18px] font-bold text-ink mb-2">
                  Palpita + disputa
                </h3>
                <p className="text-[14px] text-ink-2 leading-relaxed">
                  104 jogos pra palpitar (ou usa o Quick Pick e edita depois). Ranking ao vivo, conquistas, share nos Stories.
                </p>
              </div>
            </div>

            {/* CTA repetido + reassurance */}
            <div className="text-center mt-14 sm:mt-16">
              <Button
                variant="forest"
                size="lg"
                onClick={handleStart}
                disabled={authLoading}
                className="rounded-rebrand-md gap-2 h-12 px-7 text-[15px]"
              >
                <Trophy className="w-5 h-5" />
                Criar meu bolão grátis
                <ChevronRight className="w-4 h-4" />
              </Button>
              <p className="text-[12px] text-ink-3 mt-3">
                Não tá comprometido com nada. Apaga depois se quiser.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default BolaoLP;
