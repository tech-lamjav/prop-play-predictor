import { Sparkles } from 'lucide-react';

// Marcação de "dados de exemplo" mostrada quando a tela é preenchida com
// conteúdo fictício: durante o tour guiado (variant 'tour') ou quando a NBA
// está de férias e não há nada real pra mostrar (variant 'offseason'). Usa
// ambers default do Tailwind (não tokens de tema) pra funcionar igual em
// theme-bolao e theme-rebrand.

export function DemoRibbon({
  show,
  variant = 'tour',
}: {
  show: boolean;
  variant?: 'tour' | 'offseason';
}) {
  if (!show) return null;
  return (
    <div className="bg-amber-100 border border-amber-300 text-amber-800 rounded-md">
      <div className="px-4 py-2 flex items-center justify-center gap-2 text-center text-[12.5px] font-medium">
        <Sparkles className="w-3.5 h-3.5 shrink-0" />
        {variant === 'offseason' ? (
          <span>
            <b className="font-semibold">A NBA está de férias</b> · você está vendo um exemplo de como a tela fica na temporada.
          </span>
        ) : (
          <span>
            <b className="font-semibold">Dados de exemplo</b> · só pra você conhecer a tela; nada aqui é real.
          </span>
        )}
      </div>
    </div>
  );
}

/** Selo curto "exemplo" pra marcar cards/itens fictícios individualmente. */
export function DemoBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 ${className}`}
    >
      exemplo
    </span>
  );
}
