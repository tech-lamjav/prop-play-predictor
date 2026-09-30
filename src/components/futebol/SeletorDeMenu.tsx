import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * O seletor compacto do futebol: rótulo, resumo e seta.
 *
 * Saiu da fileira de filtros de Oportunidades quando o cabeçalho da aba de
 * Estatísticas passou a precisar do mesmo controle. Escrever um novo traria de
 * volta dois defeitos que este já tem consertados, e nenhum dos dois é óbvio
 * antes de acontecer no telefone de alguém.
 */

/**
 * O item do menu, com alvo de toque de gente.
 *
 * `min-h-11` no celular são os 44px que o dedo pede; no desktop o item volta ao
 * tamanho de mouse. Antes eram 13px de texto num item de ~28px, e escolher
 * faixa no telefone virava uma mira.
 */
export const ITEM_SELETOR =
  'cursor-pointer text-[13px] text-ink min-h-11 sm:min-h-0 focus:bg-forest-tint focus:text-forest data-[highlighted]:bg-forest-tint data-[highlighted]:text-forest data-[state=checked]:bg-forest-tint data-[state=checked]:text-forest data-[state=checked]:font-semibold';

const GATILHO_CLS =
  'inline-flex w-full items-center gap-1.5 h-9 px-3 rounded-rebrand-sm border border-line bg-white text-[12px] font-semibold text-ink hover:bg-canvas-2 transition';

/**
 * ⚠️ ABRE NO CLIQUE, e não no `pointerdown` que o Radix usa por padrão. No
 * telefone o dedo encosta no filtro para ROLAR A PÁGINA, e o menu abria antes
 * de o dedo levantar — era a "sensibilidade" que fazia os filtros parecerem
 * disparar sozinhos. O `preventDefault` no pointerdown desliga a abertura do
 * Radix e o `onClick` assume: clique só nasce quando o toque começa e termina
 * no mesmo lugar, que é exatamente a diferença entre tocar e arrastar.
 *
 * O "Pronto" existe pelo outro lado da mesma queixa. Num seletor de marcar
 * vários o menu precisa ficar aberto entre os cliques, então a única saída era
 * acertar um toque FORA dele — e fora, no celular, costuma ser outro filtro. Só
 * aparece no celular: no desktop, clicar fora é gesto de todo mundo.
 */
export function SeletorDeMenu({
  rotulo,
  resumo,
  largura,
  align = 'start',
  children,
}: {
  rotulo: string;
  resumo: string;
  largura: string;
  align?: 'start' | 'end';
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <DropdownMenu open={aberto} onOpenChange={setAberto}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${rotulo} ${resumo}`}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => setAberto((estava) => !estava)}
          className={cn(GATILHO_CLS, largura)}
        >
          <span className="text-ink-3 font-medium uppercase tracking-[0.1em] text-[10px] shrink-0">{rotulo}</span>
          <span className="truncate">{resumo}</span>
          <ChevronDown className="ml-auto w-3.5 h-3.5 shrink-0 text-ink-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className="theme-bolao bg-white border-line min-w-[184px]"
      >
        {children}
        <DropdownMenuSeparator className="sm:hidden" />
        <DropdownMenuItem
          onSelect={() => setAberto(false)}
          className="sm:hidden justify-center min-h-11 text-[13px] font-semibold text-forest focus:bg-forest-tint focus:text-forest"
        >
          Pronto
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
