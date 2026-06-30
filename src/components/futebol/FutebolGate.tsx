import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import { useFutebolAccess } from '@/hooks/use-futebol-data';
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
 * Chip discreto de status do trial pro cabeçalho (padrão de mercado).
 * Busca o acesso sozinho — só renderizar nas rotas de Futebol.
 * - trial: pílula neutra "Teste · Nd" (vira âmbar nos últimos 2 dias)
 * - expirado: "Assinar Futebol" (forest)
 * - deslogado: "7 dias grátis" (forest)
 * - assinante: nada
 */
export function FutebolTrialChip() {
  const navigate = useNavigate();
  const { data: access } = useFutebolAccess();
  if (!access || access.state === 'subscribed') return null;

  if (access.state === 'trial') {
    const d = access.days_left ?? 0;
    const ending = d <= 2;
    return (
      <button
        onClick={() => navigate('/futebol/assinar')}
        title={`Teste grátis · ${d} ${dayWord(d)} restantes`}
        className={`hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[11px] font-semibold border transition ${
          ending ? 'border-amber/50 bg-amber/15 text-amber-2 hover:bg-amber/25' : 'border-line bg-canvas-2 text-ink-2 hover:bg-canvas'
        }`}
      >
        <Sparkles className="w-3 h-3" /> Teste · {d}d
      </button>
    );
  }

  const expired = access.state === 'expired';
  return (
    <button
      onClick={() => navigate(expired ? '/futebol/assinar' : '/auth')}
      className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-bold bg-forest text-canvas hover:bg-forest-2 transition"
    >
      {expired ? <Lock className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
      {expired ? 'Assinar Futebol' : '7 dias grátis'}
    </button>
  );
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
  // Durante o trial (estado saudável) NÃO mostramos faixa — o chip do cabeçalho
  // cuida disso. A faixa forte fica só pra expirado/deslogado (hora de agir).
  if (!access || access.state === 'subscribed' || access.state === 'trial') return null;

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
