import { useNavigate } from 'react-router-dom';
import {
  Settings,
  Wallet,
  CreditCard,
  Gift,
  HelpCircle,
  LogOut,
  ChevronRight,
  Zap,
} from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { useAuth } from '@/hooks/use-auth';
import { useBets } from '@/hooks/use-bets';
import { useSettingsData } from '@/hooks/use-settings-data';
import { useReferral } from '@/components/ReferralProvider';
import { getInitials } from '@/lib/user-display';

/**
 * Tela de Perfil — o equivalente mobile do dropdown do pill no desktop.
 * Handoff "Perfil — estados" (docs/design-system/handoff-perfil.md).
 *
 * A regra do desenho: mesmo conteúdo nas duas plataformas, formato diferente.
 * "Configurações" deixou de ser navegação global e virou o primeiro item daqui.
 */

type Row = {
  label: string;
  icon: typeof Settings;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
};

export default function Perfil() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { openReferral } = useReferral();
  const { profile, subscription } = useSettingsData();
  const { stats } = useBets(user?.id ?? '');

  const name = (user?.user_metadata?.name as string | undefined) ?? profile?.name ?? undefined;
  const initials = getInitials(name);
  const isPremium =
    subscription?.betinho.status === 'premium' || subscription?.analytics.status === 'premium';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const rows: Row[] = [
    { label: 'Configurações', icon: Settings, href: '/settings' },
    { label: 'Minha banca e apostas', icon: Wallet, href: '/bets' },
    { label: 'Plano e pagamento', icon: CreditCard, href: '/planos' },
    { label: 'Indique um amigo', icon: Gift, onClick: openReferral },
    { label: 'Ajuda e suporte', icon: HelpCircle, href: '/como-usar' },
    { label: 'Sair da conta', icon: LogOut, onClick: handleSignOut, danger: true },
  ];

  const go = (row: Row) => {
    if (row.onClick) return row.onClick();
    if (row.href) navigate(row.href);
  };

  // Só mostra o bloco de números quando já carregou. Zerado tem significado
  // (usuário sem aposta), então não escondemos o zero — escondemos o "ainda
  // não sei".
  // Uma casa decimal, igual à tela de Apostas. Arredondar pra inteiro faria
  // -0,6% virar -1% aqui e -0,6% lá — dois números pra mesma métrica.
  const pct = (n: number) => `${n.toFixed(1).replace('.', ',')}%`;
  const kpis = stats
    ? [
        { label: 'Apostas', value: String(stats.totalBets) },
        { label: 'Acerto', value: pct(stats.winRate) },
        { label: 'ROI', value: `${stats.roi >= 0 ? '+' : ''}${pct(stats.roi)}`, forest: true },
      ]
    : null;

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      {/* Sem `mobileAction`: a engrenagem do desenho duplicava o item
          "Configurações" logo abaixo. E sem `mobileTitle`, pra manter a logo no
          canto — é o único ponto fixo de marca no mobile. A tab bar já marca
          que você está no Perfil. */}
      <AnalyticsNav variant="rebrand" />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-4 sm:py-8 flex flex-col gap-3.5">
        {/* Identidade */}
        <section className="bg-white border border-sand-line rounded-2xl p-4 flex items-center gap-3.5">
          <span className="w-[52px] h-[52px] rounded-full bg-forest text-white text-lg font-bold grid place-items-center shrink-0">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold tracking-[-0.02em] text-ink truncate">
              {name || 'Usuário'}
            </div>
            <div className="text-xs text-sand-ink-2 truncate">{user?.email}</div>
            {isPremium && (
              <span className="inline-flex items-center gap-1.5 h-5 px-[7px] mt-[7px] rounded-[5px] bg-forest text-white text-[9.5px] font-bold tracking-[0.1em]">
                <Zap className="w-2.5 h-2.5 fill-amber-400" strokeWidth={0} />
                PREMIUM
              </span>
            )}
          </div>
        </section>

        {/* Números da conta */}
        {kpis && (
          <section className="grid grid-cols-3 gap-2">
            {kpis.map((k) => (
              <div key={k.label} className="bg-sand border border-sand-line rounded-xl px-[11px] py-2.5">
                <div className="text-[8.5px] uppercase tracking-[0.14em] font-semibold text-sand-ink-2">
                  {k.label}
                </div>
                <div
                  className={`text-[17px] font-bold tabular-nums mt-0.5 ${k.forest ? 'text-forest' : 'text-ink'}`}
                >
                  {k.value}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Ações */}
        <section className="bg-white border border-sand-line rounded-2xl overflow-hidden">
          {rows.map((row, i) => {
            const Icon = row.icon;
            const last = i === rows.length - 1;
            return (
              <button
                key={row.label}
                type="button"
                onClick={() => go(row)}
                className={`w-full h-[52px] px-3.5 flex items-center gap-3 text-[13.5px] font-medium transition-colors ${
                  last ? '' : 'border-b border-sand-100'
                } ${row.danger ? 'text-sand-danger hover:bg-sand-danger-bg' : 'text-ink hover:bg-sand-50'}`}
              >
                <span
                  className={`w-8 h-8 rounded-[9px] grid place-items-center shrink-0 ${
                    row.danger ? 'bg-sand-danger-bg text-sand-danger' : 'bg-sand-100 text-forest'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <span className="flex-1 text-left">{row.label}</span>
                {!row.danger && <ChevronRight className="w-[15px] h-[15px] text-sand-chevron shrink-0" />}
              </button>
            );
          })}
        </section>
      </main>
    </div>
  );
}
