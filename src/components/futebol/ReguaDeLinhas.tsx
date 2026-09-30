import { useRef, useState } from 'react';

/**
 * A régua de paradas da aba de Estatísticas.
 *
 * A mecânica é a da régua da bancada, e é reuso deliberado: medir a trilha UMA
 * vez no toque, soltar quando o navegador perde a captura do ponteiro, e andar
 * de parada em parada pelas setas. Cada um desses três é um defeito que alguém
 * já pagou para descobrir, e reescrever do zero os traria de volta.
 *
 * ⚠️ O que NÃO vem de lá são as cores nem os conceitos. Lá a régua vive sobre
 * fundo verde-escuro, com trilha e bolinhas em branco translúcido — aqui o card
 * é branco e elas sumiriam. E lá o tamanho e o brilho de cada bolinha saem de
 * QUANTAS PREMISSAS sustentam aquela linha, com destaque âmbar na melhor
 * leitura. Isto aqui é **estatística da partida**, não evidência de premissa:
 * trazer aquele vocabulário quebraria a fronteira que separa as duas telas.
 * Aqui toda parada vale o mesmo, porque a régua não sabe nada sobre modelo.
 */
export function ReguaDeLinhas({
  paradas,
  valor,
  onEscolher,
  rotulo,
  aria = 'Linha de referência',
}: {
  paradas: number[];
  valor: number | null;
  onEscolher: (v: number) => void;
  rotulo: (v: number) => string;
  aria?: string;
}) {
  const trilha = useRef<HTMLDivElement | null>(null);
  /**
   * A medida vale o arrasto inteiro, e é tirada uma vez só. Remedindo a cada
   * movimento, qualquer mudança de largura no meio do caminho reposiciona a mão
   * de quem está arrastando: o mesmo ponto do cursor vira outra parada.
   */
  const medida = useRef<DOMRect | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const soltar = () => {
    setArrastando(false);
    medida.current = null;
  };

  const i = valor == null ? -1 : paradas.findIndex((p) => Math.abs(p - valor) < 0.011);
  const idx = i < 0 ? 0 : i;
  const pos = paradas.length > 1 ? (idx / (paradas.length - 1)) * 100 : 0;

  const escolherPorX = (clientX: number) => {
    const r = medida.current ?? trilha.current?.getBoundingClientRect();
    if (!r || !r.width || paradas.length < 2) return;
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onEscolher(paradas[Math.round(t * (paradas.length - 1))]);
  };

  return (
    <div className="flex-1 min-w-[180px]">
      <div
        ref={trilha}
        role="slider"
        tabIndex={0}
        aria-label={aria}
        aria-valuemin={paradas[0]}
        aria-valuemax={paradas[paradas.length - 1]}
        aria-valuenow={valor ?? undefined}
        aria-valuetext={valor == null ? undefined : rotulo(valor)}
        className="relative h-9 cursor-pointer select-none touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          medida.current = e.currentTarget.getBoundingClientRect();
          setArrastando(true);
          escolherPorX(e.clientX);
        }}
        onPointerMove={(e) => arrastando && escolherPorX(e.clientX)}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        // Sem isto, um pointerup fora do elemento deixava `arrastando` travado em
        // true e a trilha seguia respondendo ao mouse depois de solta.
        onLostPointerCapture={soltar}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            onEscolher(paradas[Math.max(0, idx - 1)]);
          }
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            onEscolher(paradas[Math.min(paradas.length - 1, idx + 1)]);
          }
        }}
      >
        <div className="absolute left-0 right-0 top-[16px] h-1.5 rounded-full bg-canvas-2" />
        <div className="absolute left-0 top-[16px] h-1.5 rounded-full" style={{ width: `${pos}%`, background: 'var(--forest)' }} />

        {/* Uma bolinha por parada: sem elas a pessoa arrasta às cegas e só
            descobre onde pôde parar pelo número que muda ao lado. Todas do
            mesmo tamanho — a régua aqui não sabe nada sobre modelo, então não
            tem por que uma parada valer mais que a outra. */}
        {paradas.map((p, k) => {
          const atual = k === idx;
          return (
            <span
              key={p}
              className="absolute rounded-full pointer-events-none"
              title={rotulo(p)}
              style={{
                left: `${(k / (paradas.length - 1)) * 100}%`,
                top: atual ? 16 : 17.5,
                width: atual ? 7 : 4,
                height: atual ? 7 : 4,
                transform: 'translateX(-50%)',
                background: atual ? 'var(--forest)' : 'var(--ink-3)',
                opacity: atual ? 1 : 0.55,
              }}
            />
          );
        })}

        <span
          className="absolute top-[11px] w-[18px] h-[18px] rounded-full pointer-events-none bg-white"
          style={{
            left: `${pos}%`,
            transform: 'translateX(-50%)',
            border: '3px solid var(--forest)',
            boxShadow: '0 1px 4px rgba(0,0,0,.18)',
          }}
        />
      </div>
      <div className="flex justify-between text-[9.5px] tabular-nums text-ink-3">
        <span>{rotulo(paradas[0])}</span>
        <span>{rotulo(paradas[paradas.length - 1])}</span>
      </div>
    </div>
  );
}
