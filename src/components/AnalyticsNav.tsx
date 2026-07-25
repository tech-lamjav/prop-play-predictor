import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import {
  BarChart3,
  Calendar,
  LogIn,
  Zap,
  ChevronLeft,
  Target,
  FileText,
  LayoutGrid,
  Wallet,
  Radar,
  Trophy,
  Bot,
  CircleUser,
} from 'lucide-react';
import { IconSoccer, IconBasketball } from './icons/sports';
import { useAuth } from '../hooks/use-auth';
import { useSubscription } from '@/hooks/use-subscription';
import UserNav from './UserNav';
import { FutebolTrialChip } from './futebol/FutebolGate';
import { SHOW_BOLAO_ENTRY_POINTS } from '@/config/bolao';

/**
 * Header global de duas faixas (handoff "Header, Footer e cor secundária Areia",
 * variante forest — ver docs/design-system/handoff-header-footer.md).
 *
 * A separação existe porque o header antigo misturava dois níveis num dropdown
 * só: qual PRODUTO você está usando e qual ESPORTE está vendo.
 *
 *   Faixa 1 (60px) — produto: Análises · Betinho · Bolão + ações da conta
 *   Faixa 2 (46px) — esporte (Futebol · NBA) + sub-seções do produto ativo
 *
 * A faixa 3 do desenho (linha de contexto bege, "Futebol hoje — …") foi
 * cortada pelo Victor em 2026-07-24: repetia o que o H1 da página já diz.
 *
 * Fora do escopo desta entrega (não existem no app ainda): busca ⌘K,
 * "+4 esportes", "Odds em queda", "Favoritos", "Agenda".
 */

type SubItem = { name: string; href: string; icon: typeof BarChart3 };

/**
 * Conceito repetido usa o MESMO glifo nos dois esportes — "Hoje" era
 * `Calendar` no futebol e `BarChart3` na NBA, "Oportunidades" era `Zap` num e
 * `TrendingUp` no outro. Glifo diferente pra mesma coisa faz o usuário achar
 * que são coisas diferentes.
 */
const NBA_ITEMS: SubItem[] = [
  { name: 'Hoje', href: '/home-nba', icon: LayoutGrid },
  { name: 'Oportunidades', href: '/oportunidades', icon: Zap },
  { name: 'Análise 360', href: '/analise-360', icon: Radar },
  { name: 'Jogos', href: '/home-games', icon: Calendar },
  { name: 'Relatório', href: '/report', icon: FileText },
];

const FUTEBOL_ITEMS: SubItem[] = [
  { name: 'Hoje', href: '/futebol', icon: LayoutGrid },
  { name: 'Oportunidades', href: '/futebol/oportunidades', icon: Zap },
  { name: 'Jogos', href: '/futebol/jogos', icon: Calendar },
];

const BETINHO_ITEMS: SubItem[] = [
  { name: 'Apostas', href: '/bets', icon: Target },
  // `Wallet` e não `BarChart3`: é a banca, e o gráfico já é "Análises" na
  // faixa 1. Mesmo glifo do item "Minha banca e apostas" da tela /perfil.
  { name: 'Dashboard', href: '/betting-dashboard', icon: Wallet },
];

interface AnalyticsNavProps {
  className?: string;
  showBack?: boolean;
  backTo?: string;
  title?: string;
  /**
   * @deprecated Só existe o tema rebrand — o `terminal` saiu junto com a
   * reescrita do header. A prop continua aceita pra não churnar os 35
   * call sites que passam `variant="rebrand"` explicitamente.
   */
  variant?: 'rebrand';
}

export default function AnalyticsNav({
  className,
  showBack,
  backTo,
  title,
}: AnalyticsNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = useSubscription();

  const path = location.pathname;
  const isActive = (href: string) => path === href;

  const futebolActive = path.startsWith('/futebol');
  const nbaActive = NBA_ITEMS.some((i) => isActive(i.href));
  const betinhoActive = BETINHO_ITEMS.some((i) => isActive(i.href));
  const bolaoActive = path.startsWith('/bolao');
  const analisesActive = futebolActive || nbaActive;

  // Sub-seções da faixa 2: seguem o produto ativo. Sem produto ativo (ex.:
  // /planos, /settings) a faixa 2 não aparece — não há o que contextualizar.
  const subItems = futebolActive
    ? FUTEBOL_ITEMS
    : nbaActive
      ? NBA_ITEMS
      : betinhoActive
        ? BETINHO_ITEMS
        : [];
  const showBand2 = subItems.length > 0;

  const go = (href: string) => navigate(href);

  // ── Faixa 1: item de produto ──
  const sectionCls = (active: boolean) =>
    `flex items-center gap-2 h-[38px] px-4 rounded-[10px] text-[13px] tracking-[-0.01em] transition-colors ${
      active
        ? 'bg-sand text-forest font-semibold hover:bg-sand'
        : 'text-white/80 font-medium hover:bg-white/10 hover:text-white'
    }`;

  // ── Faixa 2: pill de esporte ──
  const sportCls = (active: boolean) =>
    `flex items-center gap-[7px] h-[30px] px-[13px] rounded-full text-[12.5px] transition-colors ${
      active
        ? 'bg-white text-forest font-semibold hover:bg-white'
        : 'text-white/80 font-medium hover:bg-white/10 hover:text-white'
    }`;

  // ── Faixa 2: sub-seção do produto ativo ──
  const subCls = (active: boolean) =>
    `flex items-center gap-[7px] h-[30px] px-[11px] rounded-lg text-[12px] transition-colors ${
      active
        ? 'bg-white/10 text-white font-semibold'
        : 'text-white/75 font-medium hover:bg-white/10 hover:text-white'
    }`;

  return (
    <>
    <nav className={`bg-forest sticky top-0 z-50 ${className ?? ''}`}>
      {/* ─────────── Faixa 1 — produto, conta ─────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="h-[52px] md:h-[60px] flex items-center justify-between gap-4 sm:gap-6">
          {/* Esquerda: logo (+ voltar / título quando a rota pede) */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(user ? '/inicio' : '/')}
              className="flex items-center hover:opacity-80 transition-opacity shrink-0"
              aria-label="Início"
            >
              {/* Fundo forest → logo reversa (branca). É o arquivo original,
                  sem o filtro `invert hue-rotate-180` que o header claro usava. */}
              <img src="/logo.png" alt="Smart Betting" className="h-5 md:h-[26px] w-auto" />
            </button>

            {showBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
                className="-ml-1 h-8 px-2 text-white/80 hover:text-white hover:bg-white/10"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span className="text-xs">Voltar</span>
              </Button>
            )}

            {title && (
              <div className="hidden sm:flex items-center min-w-0">
                <span className="text-white/25 mx-2">/</span>
                <span className="text-sm text-white font-medium truncate max-w-[200px]">
                  {title}
                </span>
              </div>
            )}
          </div>

          {/* Centro: seções do produto */}
          <div className="hidden md:flex items-center gap-1">
            <button type="button" onClick={() => go(nbaActive ? '/home-nba' : '/futebol')} className={sectionCls(analisesActive)}>
              <BarChart3 className="w-[15px] h-[15px]" strokeWidth={analisesActive ? 2.2 : 2} />
              Análises
            </button>

            <button type="button" onClick={() => go('/bets')} className={sectionCls(betinhoActive)}>
              <Bot className="w-[15px] h-[15px]" strokeWidth={betinhoActive ? 2.2 : 2} />
              Betinho
            </button>

            {SHOW_BOLAO_ENTRY_POINTS && (
              <button type="button" onClick={() => go('/bolao')} className={sectionCls(bolaoActive)}>
                <Trophy className="w-[15px] h-[15px]" strokeWidth={bolaoActive ? 2.2 : 2} />
                Bolão
                <span className="inline-flex items-center h-4 px-[5px] rounded bg-amber-400 text-ink text-[9px] font-bold tracking-[0.08em]">
                  2026
                </span>
              </button>
            )}
          </div>

          {/* Direita: assinatura + conta */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {futebolActive && <FutebolTrialChip />}

            {user ? (
              <>
                {isPremium && (
                  <button
                    type="button"
                    onClick={() => navigate('/planos')}
                    className="hidden md:flex items-center gap-1.5 h-9 px-3 rounded-[10px] bg-amber-400 hover:bg-amber-300 text-ink text-[12px] font-bold transition-colors"
                  >
                    <Zap className="w-[13px] h-[13px] fill-current" strokeWidth={0} />
                    PREMIUM
                  </button>
                )}

                {/* Desktop: pill + dropdown. Mobile: avatar → /perfil. */}
                <UserNav />
              </>
            ) : (
              // Ordem espelha o estado logado — comercial no meio, conta na
              // ponta: [PREMIUM][Perfil] logado, [Assinar][Entrar] deslogado.
              // Assim o botão âmbar não muda de posição quando o usuário loga.
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => navigate('/planos')}
                  className="h-9 px-3 rounded-[10px] bg-amber-400 hover:bg-amber-300 text-ink text-xs font-bold"
                >
                  <Zap className="w-3 h-3 mr-1 fill-current" strokeWidth={0} />
                  Assinar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/auth')}
                  className="h-9 text-xs text-white/80 hover:text-white hover:bg-white/10"
                >
                  <LogIn className="w-3 h-3 mr-1" />
                  Entrar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─────────── Faixa 2 — esporte + sub-seções ─────────── */}
      {showBand2 && (
        <div className="hidden md:block border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            {/* Sem pills de esporte (Betinho), as sub-seções encostam à
                esquerda — senão sobra um vão verde no meio da faixa. */}
            <div className={`h-[46px] flex items-center gap-5 ${analisesActive ? 'justify-between' : ''}`}>
              {analisesActive && (
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => go('/futebol')} className={sportCls(futebolActive)}>
                    <IconSoccer className="w-3.5 h-3.5" strokeWidth={futebolActive ? 2.2 : 2} />
                    Futebol
                  </button>
                  <button type="button" onClick={() => go('/home-nba')} className={sportCls(nbaActive)}>
                    <IconBasketball className="w-3.5 h-3.5" strokeWidth={nbaActive ? 2.2 : 2} />
                    NBA
                  </button>
                </div>
              )}

              {/* Direita: sub-seções do produto ativo */}
              <div className="flex items-center gap-0.5">
                {subItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => go(item.href)}
                      className={subCls(isActive(item.href))}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

        {/* ── Rail mobile: mesmo conteúdo da faixa 2, rolando na horizontal ── */}
        {showBand2 && (
          <div className="md:hidden border-t border-white/10">
            <div className="h-[42px] px-3.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {analisesActive && (
                <>
                  <button type="button" onClick={() => go('/futebol')} className={`${sportCls(futebolActive)} shrink-0`}>
                    <IconSoccer className="w-3.5 h-3.5" strokeWidth={futebolActive ? 2.2 : 2} />
                    Futebol
                  </button>
                  <button type="button" onClick={() => go('/home-nba')} className={`${sportCls(nbaActive)} shrink-0`}>
                    <IconBasketball className="w-3.5 h-3.5" strokeWidth={nbaActive ? 2.2 : 2} />
                    NBA
                  </button>
                  <span className="w-px h-5 bg-white/15 mx-1.5 shrink-0" />
                </>
              )}
              {subItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => go(item.href)}
                    className={`${subCls(isActive(item.href))} shrink-0`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* ─────────── Tab bar mobile (fixa no rodapé da viewport) ─────────── */}
      <MobileTabBar
        analisesActive={analisesActive}
        betinhoActive={betinhoActive}
        bolaoActive={bolaoActive}
        nbaActive={nbaActive}
        perfilActive={path.startsWith('/perfil')}
        onGo={go}
      />
    </>
  );
}

/**
 * Tab bar do mobile: substitui o hambúrguer. Só os 4 destinos de topo —
 * as sub-seções ficam no rail do header.
 *
 * Some quando o teclado virtual abre? Não: é `fixed`, então em iOS ela sobe
 * junto. Se virar problema, a saída é `env(keyboard-inset-height)`.
 */
function MobileTabBar({
  analisesActive,
  betinhoActive,
  bolaoActive,
  nbaActive,
  perfilActive,
  onGo,
}: {
  analisesActive: boolean;
  betinhoActive: boolean;
  bolaoActive: boolean;
  nbaActive: boolean;
  perfilActive: boolean;
  onGo: (href: string) => void;
}) {
  const { user } = useAuth();
  // A barra cobre os últimos 62px da viewport; a classe faz o body reservar
  // esse espaço. Fica no efeito pra sumir junto com a barra (ex.: landings,
  // que não montam o AnalyticsNav).
  useEffect(() => {
    document.body.classList.add('has-tabbar');
    return () => document.body.classList.remove('has-tabbar');
  }, []);

  const itemCls = (active: boolean) =>
    `h-[62px] flex flex-col items-center justify-center gap-1 transition-colors ${
      active ? 'text-forest' : 'text-ink-dim hover:text-forest'
    }`;
  const labelCls = (active: boolean) => `text-[10px] ${active ? 'font-bold' : 'font-medium'}`;

  return (
    <div
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-line"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className={`grid ${SHOW_BOLAO_ENTRY_POINTS ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <button type="button" onClick={() => onGo(nbaActive ? '/home-nba' : '/futebol')} className={itemCls(analisesActive)}>
          <BarChart3 className="w-5 h-5" strokeWidth={analisesActive ? 2.2 : 2} />
          <span className={labelCls(analisesActive)}>Análises</span>
        </button>

        <button type="button" onClick={() => onGo('/bets')} className={itemCls(betinhoActive)}>
          <Bot className="w-5 h-5" strokeWidth={betinhoActive ? 2.2 : 2} />
          <span className={labelCls(betinhoActive)}>Betinho</span>
        </button>

        {SHOW_BOLAO_ENTRY_POINTS && (
          <button type="button" onClick={() => onGo('/bolao')} className={itemCls(bolaoActive)}>
            <Trophy className="w-5 h-5" strokeWidth={bolaoActive ? 2.2 : 2} />
            <span className={labelCls(bolaoActive)}>Bolão</span>
          </button>
        )}

        {/* Leva pra tela cheia `/perfil` — no mobile não há dropdown de conta.
            Deslogado, o destino é o login. */}
        {user ? (
          <button type="button" onClick={() => onGo('/perfil')} className={itemCls(perfilActive)}>
            <CircleUser className="w-5 h-5" strokeWidth={perfilActive ? 2.2 : 2} />
            <span className={labelCls(perfilActive)}>Perfil</span>
          </button>
        ) : (
          <button type="button" onClick={() => onGo('/auth')} className={itemCls(false)}>
            <LogIn className="w-5 h-5" />
            <span className={labelCls(false)}>Entrar</span>
          </button>
        )}
      </div>
    </div>
  );
}
