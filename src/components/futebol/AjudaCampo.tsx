import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * O rótulo de um número com um (i) que explica o que ele é.
 *
 * Popover e não tooltip: tooltip abre no hover, e metade do público lê isto no
 * celular, onde hover não existe. Aqui o toque abre, o Esc e o toque fora
 * fecham, e o teclado alcança o botão.
 *
 * As explicações moram neste arquivo, e não soltas na tela, porque os mesmos
 * quatro números aparecem no destaque da home, nos cards e no painel — três
 * cópias da mesma frase é como a copy diverge (foi o que aconteceu com a copy
 * das premissas, issue #272).
 */

export function AjudaCampo({
  rotulo,
  titulo,
  texto,
  escuro,
}: {
  rotulo: string;
  titulo: string;
  texto: string;
  /** No fundo forest do destaque; no card claro fica false. */
  escuro?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`text-[9px] uppercase tracking-[0.14em] font-semibold ${escuro ? '' : 'text-ink-3'}`}
        style={escuro ? { color: 'rgba(255,255,255,0.5)' } : undefined}
      >
        {rotulo}
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`O que é ${titulo}`}
            className={`grid h-4 w-4 place-items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${
              escuro ? 'hover:bg-white/15' : 'hover:bg-canvas-2'
            }`}
            style={escuro ? { color: 'rgba(255,255,255,0.5)', outlineColor: '#fbbf24' } : undefined}
          >
            <Info className={`h-3 w-3 ${escuro ? '' : 'text-ink-3'}`} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-64 rounded-rebrand-md border border-line bg-white p-3.5 text-ink shadow-lg"
        >
          {/* Forest, e não o cinza de rótulo: dentro do cartão branco o cinza
              somia contra o texto e o título deixava de ancorar a leitura. */}
          <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-forest">{titulo}</div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{texto}</p>
        </PopoverContent>
      </Popover>
    </span>
  );
}
