import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import type { FutebolAccess } from '@/services/futebol-data.service';

/**
 * Reverse trial do Futebol (7 dias, sem cartão). A camada de VALOR (o pick em si)
 * fica borrada pra quem não tem acesso; o resto (Score, análise) é livre.
 */

/** Borra o conteúdo (FOMO) quando `active`. Mantém o layout/espaço. */
export function Blur({ active, children, strength = 6, className = '' }: { active: boolean; children: ReactNode; strength?: number; className?: string }) {
  if (!active) return <>{children}</>;
  return (
    <span aria-hidden className={`inline-block select-none pointer-events-none align-middle ${className}`} style={{ filter: `blur(${strength}px)` }}>
      {children}
    </span>
  );
}

/** Selo de cadeado pequeno, pra sinalizar o que está bloqueado. */
export function LockPill({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-forest/10 text-forest text-[10px] font-bold px-2 py-0.5 ${className}`}>
      <Lock className="w-2.5 h-2.5" /> Premium
    </span>
  );
}

function dayWord(n: number | null): string {
  return n === 1 ? 'dia' : 'dias';
}

/**
 * Faixa de estado do acesso, pra colocar no topo das telas de valor:
 * - trial: contador "X dias restantes"
 * - expired: CTA pra assinar
 * - anon: CTA pra criar conta (libera 7 dias)
 * - subscribed: nada
 */
export function FutebolAccessBanner({ access, className = '' }: { access?: FutebolAccess; className?: string }) {
  const navigate = useNavigate();
  if (!access || access.state === 'subscribed') return null;

  if (access.state === 'trial') {
    return (
      <div className={`flex items-center gap-2 rounded-rebrand-md border border-amber/40 bg-amber/10 px-4 py-2.5 text-[12px] text-amber-2 ${className}`}>
        <Sparkles className="w-4 h-4 shrink-0" />
        <span className="font-semibold">Teste grátis · {access.days_left} {dayWord(access.days_left)} restantes.</span>
        <span className="text-ink-3 hidden sm:inline">Acesso completo às oportunidades de valor.</span>
      </div>
    );
  }

  const expired = access.state === 'expired';
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-rebrand-md border border-forest/30 bg-forest/[0.06] px-4 py-3 ${className}`}>
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <span className="w-8 h-8 rounded-full bg-forest text-canvas grid place-items-center shrink-0"><Lock className="w-4 h-4" /></span>
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-ink">{expired ? 'Seu teste grátis acabou' : 'Veja as oportunidades — 7 dias grátis'}</div>
          <p className="text-[12px] text-ink-2 leading-snug">
            {expired
              ? 'As oportunidades de valor estão bloqueadas. Assine o Futebol pra continuar vendo os picks.'
              : 'Crie sua conta e libere os picks de valor por 7 dias, sem cartão.'}
          </p>
        </div>
      </div>
      <button
        onClick={() => navigate(expired ? '/futebol/assinar' : '/auth')}
        className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-rebrand-sm bg-forest text-canvas text-[12px] font-bold px-4 h-9 hover:bg-forest-2 transition"
      >
        {expired ? 'Assinar Futebol' : 'Criar conta grátis'}
      </button>
    </div>
  );
}
