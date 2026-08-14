import { useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { rodadaCurta } from '@/utils/futebol-rodadas';

/**
 * A régua de rodadas do campeonato.
 *
 * No lugar do stepper de "‹ Rodada 22 ›", que só dizia onde você está e obrigava
 * a clicar 15 vezes pra chegar na rodada 7. Aqui a temporada inteira está à
 * mostra: primeira, última, uma janela em volta da atual e "…" no meio do
 * caminho. Rodada passada fica areia (já jogou), futura fica branca com borda,
 * a atual fica verde com o ponto âmbar.
 *
 * Em mata-mata a mesma régua serve pras fases, e aí não tem janela nem "…":
 * são poucas, cabem todas (protótipo "Futebol Campeonato").
 */

const JANELA = 3; // rodadas de cada lado da atual, no desktop

export function ReguaRodadas({
  rounds,
  idx,
  onIdx,
  jogosNaRodada,
  porPontos,
}: {
  rounds: string[];
  idx: number;
  onIdx: (i: number) => void;
  jogosNaRodada: number;
  porPontos: boolean;
}) {
  const ativoRef = useRef<HTMLButtonElement | null>(null);
  const trilhaRef = useRef<HTMLDivElement | null>(null);

  /** Índices visíveis, com marcador de corte onde a sequência pula. */
  const paradas = useMemo(() => {
    const total = rounds.length;
    if (!total) return [] as Array<{ tipo: 'corte'; chave: string } | { tipo: 'rodada'; i: number }>;

    const set = new Set<number>();
    if (porPontos && total > JANELA * 2 + 3) {
      set.add(0);
      set.add(total - 1);
      for (let i = idx - JANELA; i <= idx + JANELA; i++) if (i >= 0 && i < total) set.add(i);
    } else {
      for (let i = 0; i < total; i++) set.add(i);
    }

    const ordenados = [...set].sort((a, b) => a - b);
    const saida: Array<{ tipo: 'corte'; chave: string } | { tipo: 'rodada'; i: number }> = [];
    let anterior: number | null = null;
    ordenados.forEach((i) => {
      if (anterior != null && i - anterior > 1) saida.push({ tipo: 'corte', chave: `c${i}` });
      saida.push({ tipo: 'rodada', i });
      anterior = i;
    });
    return saida;
  }, [rounds.length, idx, porPontos]);

  // Em tela estreita a régua rola, e sem isto ela abre no começo da temporada: no
  // celular a Libertadores mostrava "Pré 1" com as oitavas fora da vista. Mexo no
  // scrollLeft da trilha em vez de usar scrollIntoView, que também rolava a
  // PÁGINA e não reagia quando a lista de fases chegava depois do primeiro
  // desenho. O rAF é pra medir com a régua já do tamanho final.
  useEffect(() => {
    const centralizar = () => {
      const trilha = trilhaRef.current;
      const ativo = ativoRef.current;
      if (!trilha || !ativo) return;
      trilha.scrollLeft = ativo.offsetLeft - (trilha.clientWidth - ativo.clientWidth) / 2;
    };
    const raf = requestAnimationFrame(centralizar);
    // Segunda tentativa: em carregamento de página inteira a fonte e os escudos
    // chegam depois e mudam a largura dos chips, e a régua voltava pro começo.
    const tarde = setTimeout(centralizar, 350);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tarde);
    };
  }, [idx, rounds.length]);

  if (!rounds.length) return null;

  const jogadas = idx; // tudo que vem antes da rodada aberta já aconteceu

  return (
    <div
      className="bg-white rounded-rebrand-lg px-3 py-2 flex items-center gap-2 min-w-0"
      style={{ border: '1px solid #ded2b6' }}
    >
      <span
        className="hidden sm:block shrink-0 text-[9.5px] uppercase tracking-[0.14em] font-bold pr-1"
        style={{ color: '#8d8672' }}
      >
        {porPontos ? 'Rodada' : 'Fase'}
      </span>

      <button
        onClick={() => onIdx(Math.max(0, idx - 1))}
        disabled={idx <= 0}
        className="shrink-0 w-7 h-7 grid place-items-center rounded-rebrand-sm transition disabled:opacity-30 hover:bg-canvas-2"
        style={{ color: '#8d8672', background: '#f8f4ea' }}
        aria-label="Rodada anterior"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div ref={trilhaRef} className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0">
        {paradas.map((p) =>
          p.tipo === 'corte' ? (
            <span key={p.chave} className="shrink-0 text-[12px] px-0.5" style={{ color: '#c4bda8' }}>
              …
            </span>
          ) : (
            <button
              key={rounds[p.i]}
              ref={p.i === idx ? ativoRef : undefined}
              onClick={() => onIdx(p.i)}
              aria-current={p.i === idx ? 'true' : undefined}
              className="shrink-0 h-7 rounded-rebrand-sm inline-flex items-center gap-1.5 tabular-nums transition"
              style={
                p.i === idx
                  ? { padding: '0 13px', background: '#0a3d2e', color: '#fff', font: '700 12.5px Inter, sans-serif' }
                  : p.i < idx
                    ? { padding: '0 10px', background: '#f1e9d6', color: '#8d8672', font: '600 12px Inter, sans-serif' }
                    : {
                        padding: '0 10px',
                        background: '#fff',
                        border: '1px solid #ded2b6',
                        color: '#3f463d',
                        font: '600 12px Inter, sans-serif',
                      }
              }
            >
              {rodadaCurta(rounds[p.i])}
              {p.i === idx && (
                <span className="w-[5px] h-[5px] rounded-full" style={{ background: '#fbbf24' }} />
              )}
            </button>
          ),
        )}
      </div>

      <button
        onClick={() => onIdx(Math.min(rounds.length - 1, idx + 1))}
        disabled={idx >= rounds.length - 1}
        className="shrink-0 w-7 h-7 grid place-items-center rounded-rebrand-sm transition disabled:opacity-30 hover:bg-canvas-2"
        style={{ color: '#8d8672', background: '#f8f4ea' }}
        aria-label="Próxima rodada"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      <span className="hidden lg:block ml-auto shrink-0 text-[11px]" style={{ color: '#8d8672' }}>
        {porPontos
          ? `${jogadas} ${jogadas === 1 ? 'rodada jogada' : 'rodadas jogadas'} · ${jogosNaRodada} ${jogosNaRodada === 1 ? 'jogo' : 'jogos'} nesta`
          : `${rounds.length} fases · ${jogosNaRodada} ${jogosNaRodada === 1 ? 'jogo' : 'jogos'} nesta`}
      </span>
    </div>
  );
}
