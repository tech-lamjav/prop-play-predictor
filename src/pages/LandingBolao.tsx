import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Trophy,
  Users,
  Zap,
  Star,
  Crown,
  Target,
  ArrowRight,
  Shield,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Landing pública do Bolão Copa 2026 — visível em /bolao quando user
 * está deslogado. Copy casual brasileira, foco em conversão pra signup
 * + SEO meta tags.
 */
const LandingBolao: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Tracking básico — quando integrar PostHog/GA depois
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
          content="Crie o bolão da Copa 2026 em 30 segundos. Convide a galera por WhatsApp, palpite os 104 jogos, escolha o campeão. Gratuito. Premium opcional com pontuação customizada."
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

      <main className="min-h-screen bg-terminal-bg text-terminal-text">
        {/* ─── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-terminal-blue/10 via-transparent to-yellow-500/5 pointer-events-none" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-12 sm:pt-24 sm:pb-20 text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-terminal-blue/15 text-terminal-blue border border-terminal-blue/30 mb-5">
              <Trophy className="w-3.5 h-3.5" />
              Copa do Mundo 2026
            </span>
            <h1 className="text-4xl sm:text-6xl font-black leading-tight mb-4">
              O bolão da galera.<br />
              <span className="text-terminal-blue">Sem planilha do Excel.</span>
            </h1>
            <p className="text-base sm:text-xl opacity-70 max-w-2xl mx-auto mb-8 leading-relaxed">
              Cria em 30 segundos, manda o link no grupo, e pronto.
              A gente cuida do ranking, dos placares e dos palpites de campeão.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={() => handleCTA('hero_primary')}
                className="bg-terminal-blue text-terminal-bg hover:bg-terminal-blue/90 font-bold gap-2 h-12 px-6 text-base"
              >
                Criar meu bolão grátis
                <ArrowRight className="w-4 h-4" />
              </Button>
              <p className="text-xs opacity-50 mt-1 sm:mt-0 sm:ml-2">
                Sem cartão · Sem cadastro complicado
              </p>
            </div>

            {/* Quick stats */}
            <div className="mt-10 grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-black text-terminal-blue">104</p>
                <p className="text-[10px] sm:text-xs opacity-50 uppercase tracking-wider">jogos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-black text-terminal-blue">48</p>
                <p className="text-[10px] sm:text-xs opacity-50 uppercase tracking-wider">seleções</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-black text-terminal-blue">12</p>
                <p className="text-[10px] sm:text-xs opacity-50 uppercase tracking-wider">grupos</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Como funciona ───────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold uppercase tracking-wider text-terminal-blue mb-2">
              Como funciona
            </p>
            <h2 className="text-2xl sm:text-3xl font-black">
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
                className="terminal-container p-5 border-terminal-blue/20"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-8 rounded-full bg-terminal-blue/15 border border-terminal-blue/40 flex items-center justify-center text-sm font-black text-terminal-blue">
                    {step.num}
                  </span>
                  <step.icon className="w-5 h-5 text-terminal-blue/70" />
                </div>
                <h3 className="text-lg font-bold mb-1">{step.title}</h3>
                <p className="text-sm opacity-60 leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Free vs Premium ─────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold uppercase tracking-wider text-terminal-blue mb-2">
              Planos
            </p>
            <h2 className="text-2xl sm:text-3xl font-black mb-2">
              Começa grátis. Sobe pro Premium se quiser.
            </h2>
            <p className="text-sm opacity-60">
              Sem mensalidade. Sem trial. Pago uma vez, vale pra Copa toda.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Free */}
            <div className="terminal-container p-6 border-terminal-border-subtle">
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-50 mb-2">
                Grátis
              </p>
              <p className="text-3xl font-black mb-1">R$ 0</p>
              <p className="text-xs opacity-50 mb-5">pra sempre</p>
              <ul className="space-y-2.5 text-sm">
                {[
                  'Até 10 participantes',
                  'Palpite nos 104 jogos',
                  'Palpite de campeão',
                  'Ranking ao vivo',
                  'Pontuação padrão (1pt resultado / 3pts placar)',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-terminal-green shrink-0 mt-0.5" />
                    <span className="opacity-80">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Premium */}
            <div className="terminal-container p-6 border-yellow-500/40 bg-yellow-500/[0.03] relative">
              <span className="absolute -top-3 left-6 text-[10px] px-2 py-0.5 bg-yellow-500 text-terminal-bg font-bold uppercase tracking-wider rounded-full">
                Recomendado
              </span>
              <p className="text-[11px] font-bold uppercase tracking-wider text-yellow-400 mb-2">
                Premium
              </p>
              <p className="text-3xl font-black text-yellow-300 mb-1">R$ 19,90</p>
              <p className="text-xs opacity-60 mb-5">pagamento único</p>
              <ul className="space-y-2.5 text-sm">
                {[
                  { text: 'Participantes ilimitados', strong: true },
                  { text: 'Pontuação 100% customizável' },
                  { text: 'Multiplicador por fase: Final vale até 5×', strong: true },
                  { text: 'Palpites especiais (finalistas, semis, quartas)' },
                  { text: 'Ranking por fase + destaques' },
                  { text: 'Logo e cor próprios do bolão' },
                ].map((f) => (
                  <li key={f.text} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                    <span className={f.strong ? 'font-bold text-yellow-100' : 'opacity-80'}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ─── Diferenciais ────────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 border-t border-terminal-border-subtle">
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
                <div className="w-12 h-12 rounded-full bg-terminal-blue/10 border border-terminal-blue/30 flex items-center justify-center mx-auto mb-3">
                  <b.icon className="w-5 h-5 text-terminal-blue" />
                </div>
                <h3 className="text-base font-bold mb-1">{b.title}</h3>
                <p className="text-xs opacity-60 leading-relaxed">{b.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── FAQ ────────────────────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 border-t border-terminal-border-subtle">
          <div className="text-center mb-8">
            <p className="text-[11px] font-bold uppercase tracking-wider text-terminal-blue mb-2">
              Perguntas frequentes
            </p>
            <h2 className="text-2xl sm:text-3xl font-black">Bora tirar dúvida</h2>
          </div>
          <div className="space-y-3">
            {[
              {
                q: 'É grátis mesmo? Tem pegadinha?',
                a: 'É grátis pra criar e pra entrar em bolões. O Premium (R$ 19,90 único) é opcional pra quem quer mais de 10 participantes ou customizar pontuação. Sem mensalidade, sem trial.',
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
                a: 'Vale pro bolão que você escolheu Premium na criação. Outros bolões seus continuam Free. Não tem assinatura — é pagamento por bolão.',
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group terminal-container px-5 py-4 cursor-pointer"
              >
                <summary className="flex items-center justify-between gap-3 list-none font-bold text-sm">
                  {item.q}
                  <ArrowRight className="w-4 h-4 opacity-50 group-open:rotate-90 transition-transform shrink-0" />
                </summary>
                <p className="text-sm opacity-70 mt-3 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ─── CTA final ──────────────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
          <div className="terminal-container p-8 sm:p-12 border-terminal-blue/40 bg-gradient-to-br from-terminal-blue/10 to-transparent">
            <Crown className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-black mb-3">
              Bora montar o bolão da Copa?
            </h2>
            <p className="text-base opacity-70 mb-6 max-w-lg mx-auto">
              30 segundos pra criar. 1 link pra mandar pra galera.
              Em junho/2026 tá todo mundo no grupo torcendo junto.
            </p>
            <Button
              onClick={() => handleCTA('footer_cta')}
              className="bg-terminal-blue text-terminal-bg hover:bg-terminal-blue/90 font-bold gap-2 h-12 px-8 text-base"
            >
              Criar meu bolão grátis
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </section>
      </main>
    </>
  );
};

export default LandingBolao;
