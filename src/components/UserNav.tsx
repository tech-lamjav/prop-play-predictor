import { useAuth } from '../hooks/use-auth';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  Settings,
  LogOut,
  Gift,
  BookOpen,
  CreditCard,
  HelpCircle,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useReferral } from './ReferralProvider';
import { useSettingsData } from '@/hooks/use-settings-data';
import { getInitials } from '@/lib/user-display';

/**
 * Menu de conta do desktop — pill "Perfil" na faixa 1 do header + dropdown.
 * Handoff "Perfil — estados" (docs/design-system/handoff-perfil.md).
 *
 * No MOBILE isto não renderiza: lá o avatar do topo e o item da tab bar levam
 * pra tela cheia `/perfil`, que tem o mesmo conteúdo.
 */

interface UserNavProps {
  className?: string;
  /** @deprecated Só existe o tema rebrand. Aceita pra não quebrar chamadores antigos. */
  variant?: 'terminal' | 'rebrand';
}

/** Itens do menu, na ordem do desenho. `Configurações` é sempre o primeiro. */
type MenuItem = {
  label: string;
  icon: typeof Settings;
  href?: string;
  onClick?: () => void;
};

export default function UserNav({ className }: UserNavProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Na própria /perfil o avatar levaria pra tela onde o usuário já está.
  const showMobileAvatar = !location.pathname.startsWith('/perfil');
  const { openReferral } = useReferral();
  const { profile, subscription } = useSettingsData();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // Mesma ordem de fallback da tela `/perfil`: quem cadastrou pelo Google tem
  // o nome no metadata, quem veio por e-mail só tem na tabela `users`.
  const name = (user?.user_metadata?.name as string | undefined) ?? profile?.name ?? undefined;
  const initials = getInitials(name);

  // Mostra a renovação da assinatura ativa. Sem data no banco, o bloco some —
  // melhor não mostrar nada do que mostrar uma data inventada.
  const activeSub =
    subscription?.betinho.status === 'premium'
      ? subscription.betinho
      : subscription?.analytics.status === 'premium'
        ? subscription.analytics
        : null;
  const renovaEm = activeSub?.periodEnd
    ? new Date(activeSub.periodEnd).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : null;

  const items: MenuItem[] = [
    { label: 'Configurações', icon: Settings, href: '/settings' },
    { label: 'Planos e preços', icon: CreditCard, href: '/planos' },
    { label: 'Indique um amigo', icon: Gift, onClick: openReferral },
    { label: 'Como usar', icon: BookOpen, href: '/como-usar' },
    { label: 'Falar com o time', icon: HelpCircle, href: 'mailto:tecnologia@smartbetting.app' },
  ];

  const go = (item: MenuItem) => {
    if (item.onClick) return item.onClick();
    if (item.href?.startsWith('mailto:')) {
      window.location.href = item.href;
      return;
    }
    if (item.href) navigate(item.href);
  };

  return (
    <>
      {/* Mobile: sem dropdown — o avatar abre a tela cheia `/perfil`. Fica aqui
          (e não no AnalyticsNav) pra reaproveitar as mesmas iniciais e evitar
          uma segunda consulta ao perfil. */}
      {showMobileAvatar && (
        <button
          type="button"
          onClick={() => navigate('/perfil')}
          aria-label="Perfil"
          className="md:hidden w-[30px] h-[30px] rounded-full bg-sand text-forest text-[11px] font-bold grid place-items-center shrink-0"
        >
          {initials}
        </button>
      )}

      <div className={`hidden md:flex items-center ${className ?? ''}`}>
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* `data-[state=open]` = estado "aberto" do desenho: borda mais firme
              e rótulo cheio, pra amarrar o pill ao painel. */}
          <Button
            variant="ghost"
            className="h-9 pl-2.5 pr-1.5 gap-[7px] rounded-full border border-white/15 bg-transparent hover:bg-white/10 data-[state=open]:bg-white/10 data-[state=open]:border-white/45 transition-colors"
            aria-label="Menu da conta"
          >
            <span className="text-[12px] font-medium text-white/85">Perfil</span>
            <Avatar className="h-[26px] w-[26px]">
              <AvatarFallback className="bg-sand text-forest text-[11px] font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-[296px] p-0 overflow-hidden rounded-[14px] bg-white border-sand-line shadow-[0_10px_30px_-10px_rgba(10,61,46,0.22)]"
        >
          {/* Identidade — areia, pra separar quem você é das ações */}
          <div className="flex items-center gap-3 p-4 bg-sand-50 border-b border-sand-line">
            <span className="w-10 h-10 rounded-full bg-forest text-white text-sm font-bold grid place-items-center shrink-0">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold tracking-[-0.01em] text-ink truncate">
                {name || 'Usuário'}
              </div>
              <div className="text-[11.5px] text-sand-ink-2 truncate">{user?.email}</div>
            </div>
          </div>

          {activeSub && (
            <div className="flex items-center justify-between gap-2.5 px-4 py-3 border-b border-sand-divider">
              <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-md bg-forest text-white text-[10px] font-bold tracking-[0.1em]">
                <Zap className="w-[11px] h-[11px] fill-amber-400" strokeWidth={0} />
                PREMIUM
              </span>
              {renovaEm && <span className="text-[11px] text-sand-ink-2">renova {renovaEm}</span>}
            </div>
          )}

          <div className="p-1.5 flex flex-col">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => go(item)}
                  className="h-[38px] px-2.5 rounded-[9px] flex items-center gap-2.5 text-[13px] font-medium text-sand-ink-strong hover:bg-sand-100 hover:text-forest transition-colors"
                >
                  <Icon className="w-4 h-4 text-forest shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-sand-chevron shrink-0" />
                </button>
              );
            })}
          </div>

          <div className="p-1.5 border-t border-sand-divider">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full h-[38px] px-2.5 rounded-[9px] flex items-center gap-2.5 text-[13px] font-medium text-sand-danger hover:bg-sand-danger-bg transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Sair da conta
            </button>
          </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
