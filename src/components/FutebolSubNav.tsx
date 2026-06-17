import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, Zap, ListOrdered } from 'lucide-react';

// Sub-navegação do módulo Futebol (3 abas top-level). Fica logo abaixo da
// AnalyticsNav, com estado ativo, em todas as telas principais do módulo.
const TABS = [
  { to: '/futebol', label: 'Hoje', icon: CalendarDays },
  { to: '/futebol/oportunidades', label: 'Oportunidades', icon: Zap },
  { to: '/futebol/jogos', label: 'Jogos', icon: ListOrdered },
] as const;

export default function FutebolSubNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isActive = (to: string) => (to === '/futebol' ? pathname === '/futebol' : pathname.startsWith(to));

  return (
    <div className="border-b border-line bg-white">
      <div className="max-w-6xl w-full mx-auto px-4 md:px-6 flex gap-1">
        {TABS.map((t) => {
          const active = isActive(t.to);
          const Icon = t.icon;
          return (
            <button
              key={t.to}
              onClick={() => navigate(t.to)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                active ? 'border-forest text-forest font-semibold' : 'border-transparent text-ink-2 hover:text-ink'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
