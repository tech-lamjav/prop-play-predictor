import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
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
 * está deslogado. Copy casual brasileira, foco em conversão pra signup
 * + SEO meta tags. Paleta "Direção A" (canvas/forest/amber).
 */
const LandingBolao: React.FC = () => {
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
      <Helmet>
        <title>Bolão Copa do Mundo 2026 — Crie o seu grátis | Smart Betting</title>
        <meta
          name="description"
          content="Crie o bolão da Copa 2026 em 30 segundos. Convide a galera por WhatsApp, palpite os 104 jogos, escolha o campeão. Gratuito até 20 pessoas. Premium pra grupos maiores."
        />
        <meta property="og:title" content="Bolão Copa 2026 — Crie o seu grátis" />
        <meta
          property="og:description"
          content="Crie o bolão da galera em 30 segundos. 104 jogos, palpite de campeão, ranking ao vivo."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://smartbetting.app/bolao" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href="https://smartbetting.app/bolao" />
      </Helmet>

      <main className="theme-bolao min-h-screen bg-canvas text-ink">
        {/* ─── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-forest text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-forest via-forest-2 to-forest pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(212,160,23,0.18),transparent_55%)] pointer-events-none" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-12 sm:pt-24 sm:pb-20 text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] bg-amber/[0.18] text-amber border border-amber/40 mb-5">
              <Trophy className="w-3.5 h-3.5" />
              Copa do Mundo 2026
            </span>
            <h1 className="font-display text-4xl sm:text-6xl font-black leading-tight mb-4">
              O bolão da galera.<br />
              <span className="text-amber">Sem planilha do Excel.</span>
            </h1>
            <p className="text-base sm:text-xl text-white/80 max-w-2xl mx-auto mb-8 leading-relaxed">
              Cria em 30 segundos, manda o link no grupo, e pronto.
              A gente cuida do ranking, dos placares e dos palpites de campeão.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleCTA('hero_primary')}
                className="inline-flex items-center gap-2 h-12 px-6 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
              >
                Criar meu bolão grátis
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-[12px] text-white/60 mt-1 sm:mt-0 sm:ml-2">
                Sem cartão · Sem cadastro complicado
              </p>
            </div>

            {/* Quick stats */}
            <div className="mt-10 grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-black text-amber tabular-nums">104</p>
                <p className="text-[10px] sm:text-[11px] text-white/60 uppercase tracking-[0.12em] mt-1">jogos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-black text-amber tabular-nums">48</p>
                <p className="text-[10px] sm:text-[11px] text-white/60 uppercase tracking-[0.12em] mt-1">seleções</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-black text-amber tabular-nums">12</p>
                <p className="text-[10px] sm:text-[11px] text-white/60 uppercase tracking-[0.12em] mt-1">grupos</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Como funciona ───────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">
              Como funciona
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-black text-ink">
              3 passos. Sem complicação.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                num: '1',
                icon: Trophy,
                title: 'Cria o bolão',
                text: 'Dá um nome (ex: "Bolão da firma"). Em 30s tá pronto.',
              },
              {
                num: '2',
                icon: MessageCircle,
                title: 'Manda o link',
                text: 'Cola no grupo do WhatsApp. A galera entra em 1 clique.',
              },
              {
                num: '3',
                icon: Target,
                title: 'Palpita',
                text: 'Cada jogador palpita os 104 jogos antes de começarem. A gente faz o ranking sozinho.',
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
              Planos
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-black text-ink mb-2">
              Tudo grátis até 20 pessoas.
            </h2>
            <p className="text-[13px] text-ink-2">
              Mesmas features nos dois planos. Pra grupo maior, sobe pro Premium — pagamento único, sem mensalidade.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Free */}
            <div className="rounded-rebrand-lg border border-line bg-white p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-2 mb-2">
                Grátis
              </p>
              <p className="font-display text-3xl font-black text-ink mb-1">R$ 0</p>
              <p className="text-[12px] text-ink-3 mb-5">pra sempre · até 20 pessoas</p>
              <ul className="space-y-2.5 text-[13px]">
                {[
                  'Até 20 participantes',
                  'Pontuação 100% customizável',
                  'Multiplicador por fase (Final vale até 5×)',
                  'Palpites especiais (campeão, finalistas, semis, quartas)',
                  'Ranking por fase + destaques',
                  'Logo e cor próprios do bolão',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-forest shrink-0 mt-0.5" />
                    <span className="text-ink-2">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Premium */}
            <div className="rounded-rebrand-lg border-2 border-amber/50 bg-amber/[0.06] p-6 relative">
              <span className="absolute -top-3 left-6 text-[10px] px-2 py-0.5 bg-amber text-white font-bold uppercase tracking-[0.12em] rounded-full shadow-sm">
                Pra grupo grande
              </span>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-2 mb-2">
                Premium
              </p>
              <p className="font-display text-3xl font-black text-amber-2 mb-1">R$ 19,90</p>
              <p className="text-[12px] text-ink-2 mb-5">pagamento único · sem assinatura</p>
              <ul className="space-y-2.5 text-[13px]">
                {[
                  { text: 'Participantes ilimitados (20+)', strong: true },
                  { text: 'Tudo do Free incluído', strong: true },
                ].map((f) => (
                  <li key={f.text} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-2 shrink-0 mt-0.5" />
                    <span className={f.strong ? 'font-bold text-ink' : 'text-ink-2'}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-ink-3 mt-4 leading-snug">
                Mesmas features do Free. Diferença é só o tamanho do grupo.
              </p>
            </div>
          </div>
        </section>

        {/* ─── Diferenciais ────────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 border-t border-line">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                icon: Users,
                title: 'Sem cadastro chato',
                text: 'Login com Google, e tá dentro. Cada amigo entra com 1 clique no link.',
              },
              {
                icon: Zap,
                title: 'Tudo automático',
                text: 'Placares atualizam sozinho via API oficial. Você só palpita e acompanha.',
              },
              {
                icon: Shield,
                title: 'Seu bolão, suas regras',
                text: 'Ajuste pontuação, multiplicador por fase, prazos de palpite. Sem briga.',
              },
            ].map((b) => (
              <div key={b.title} className="text-center">
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
              Perguntas frequentes
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-black text-ink">Bora tirar dúvida</h2>
          </div>
          <div className="space-y-3">
            {[
              {
                q: 'É grátis mesmo? Tem pegadinha?',
                a: 'É grátis pra criar, entrar e usar todas as features (pontuação custom, palpites especiais, multiplicador por fase). O Premium (R$ 19,90 único) só é necessário se o seu bolão passa de 20 pessoas. Sem mensalidade, sem trial.',
              },
              {
                q: 'Como meus amigos entram?',
                a: 'Você cria o bolão e gera um link tipo smartbetting.app/bolao/entrar/ABC12345. Manda no WhatsApp, eles clicam, fazem login com Google, tá dentro.',
              },
              {
                q: 'E se eu quiser sair de um bolão?',
                a: 'Tem botão "Sair" na página do bolão. Seus palpites somem, você não aparece no ranking. Pra voltar, precisa do link de novo.',
              },
              {
                q: 'Como vocês atualizam os placares?',
                a: 'API oficial da FIFA + nossa equipe revisando. Após cada jogo, o ranking recalcula sozinho.',
              },
              {
                q: 'Posso criar mais de 1 bolão?',
                a: 'Quantos quiser. Bolão da firma, bolão da família, bolão dos amigos da escola. Cada um separado.',
              },
              {
                q: 'Premium vale só pra um bolão?',
                a: 'Sim — o pagamento de R$ 19,90 vale pro bolão que você escolheu Premium na criação (libera mais de 20 participantes). Outros bolões seus continuam Free. Não tem assinatura — é pagamento por bolão.',
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group rounded-rebrand-md border border-line bg-white px-5 py-4 cursor-pointer hover:border-line-2 transition-colors"
              >
                <summary className="flex items-center justify-between gap-3 list-none font-bold text-[14px] text-ink">
                  {item.q}
                  <ArrowRight className="w-4 h-4 text-ink-3 group-open:rotate-90 transition-transform shrink-0" />
                </summary>
                <p className="text-[13px] text-ink-2 mt-3 leading-relaxed">{item.a}</p>
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
                Bora montar o bolão da Copa?
              </h2>
              <p className="text-[15px] text-white/80 mb-6 max-w-lg mx-auto leading-relaxed">
                30 segundos pra criar. 1 link pra mandar pra galera.
                Em junho/2026 tá todo mundo no grupo torcendo junto.
              </p>
              <button
                type="button"
                onClick={() => handleCTA('footer_cta')}
                className="inline-flex items-center gap-2 h-12 px-8 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
              >
                Criar meu bolão grátis
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
