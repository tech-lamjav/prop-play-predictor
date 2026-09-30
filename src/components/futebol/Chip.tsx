import { cn } from '@/lib/utils';

/**
 * O chip de filtro do futebol.
 *
 * 44px de alvo no celular e 32 no desktop: são os pixels que o dedo pede, e sem
 * eles escolher filtro no telefone vira uma mira. Fundo forest quando ativo.
 *
 * Mora aqui porque virou o terceiro: a fileira de Oportunidades, o jogo a jogo
 * da aba de Estatísticas e o recorte das médias da temporada. As três tinham as
 * mesmas classes escritas à mão, e classe repetida é o que faz um controle
 * ganhar altura nova numa tela e não nas outras.
 */
export function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'h-11 sm:h-8 px-3 rounded-rebrand-sm text-[12px] font-semibold border transition-colors shrink-0',
        ativo ? 'bg-forest text-canvas border-forest' : 'bg-white text-ink border-line hover:bg-canvas-2',
      )}
    >
      {children}
    </button>
  );
}
