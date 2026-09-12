import {
  ATALHOS,
  EXPLICACAO_DO_EIXO,
  ROTULO_DO_EIXO,
  periodoAnterior,
  type Eixo,
  type Periodo,
} from './placar-periodo';

/**
 * A janela que o placar está olhando, e por qual data ela conta.
 *
 * O eixo fica ao lado do período, e não escondido num menu, porque ele muda a
 * PERGUNTA e não a apresentação: por apito o número é o resultado da semana, por
 * detecção é a régua que publicou naquela semana. Ver os dois rótulos lado a
 * lado é o que impede alguém ler um número respondendo a outra pergunta.
 */
export function FiltroDoPlacar({
  atalho,
  periodo,
  eixo,
  soVitrine,
  periodoB,
  aoMudarPeriodo,
  aoMudarEixo,
  aoMudarVitrine,
  aoMudarComparacao,
}: {
  atalho: string;
  periodo: Periodo;
  eixo: Eixo;
  soVitrine: boolean;
  /** O segundo período, ou `null` quando não se está comparando. */
  periodoB: Periodo | null;
  aoMudarPeriodo: (atalho: string, periodo: Periodo) => void;
  aoMudarEixo: (eixo: Eixo) => void;
  aoMudarVitrine: (soVitrine: boolean) => void;
  aoMudarComparacao: (periodoB: Periodo | null) => void;
}) {
  const botao = (ativo: boolean) =>
    `rounded-rebrand-sm border px-3 py-1.5 text-[13px] font-bold transition ${
      ativo
        ? 'border-ink bg-ink text-white'
        : 'border-line-2 bg-white text-ink-2 hover:border-ink hover:text-ink'
    }`;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-rebrand-md border border-line-2 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-dim">
          Período
        </span>
        {ATALHOS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={botao(atalho === a.id)}
            onClick={() => aoMudarPeriodo(a.id, a.periodo(periodo.ate))}
          >
            {a.rotulo}
          </button>
        ))}

        {atalho === 'personalizado' && (
          <span className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label="Início do período"
              value={periodo.de}
              max={periodo.ate}
              onChange={(e) => aoMudarPeriodo(atalho, { ...periodo, de: e.target.value })}
              className="rounded-rebrand-sm border border-line-2 px-2 py-1 text-[13px] text-ink"
            />
            <span className="text-[13px] text-ink-dim">até</span>
            <input
              type="date"
              aria-label="Fim do período"
              value={periodo.ate}
              min={periodo.de}
              onChange={(e) => aoMudarPeriodo(atalho, { ...periodo, ate: e.target.value })}
              className="rounded-rebrand-sm border border-line-2 px-2 py-1 text-[13px] text-ink"
            />
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-dim">
          Conta
        </span>
        {(['jogo', 'deteccao'] as Eixo[]).map((e) => (
          <button
            key={e}
            type="button"
            className={botao(eixo === e)}
            onClick={() => aoMudarEixo(e)}
            title={EXPLICACAO_DO_EIXO[e]}
          >
            {ROTULO_DO_EIXO[e]}
          </button>
        ))}
        <span className="text-[13px] text-ink-2">{EXPLICACAO_DO_EIXO[eixo]}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-dim">
          Mercados
        </span>
        {/* O padrão é o board inteiro, e essa é a diferença deliberada em
            relação ao script de terminal: decidir se um mercado oculto volta é
            uma das decisões que esta tela existe para sustentar. */}
        <button
          type="button"
          className={botao(!soVitrine)}
          onClick={() => aoMudarVitrine(false)}
          title="Inclui o mercado que saiu da vitrine. Responde como está a metodologia."
        >
          Board inteiro
        </button>
        <button
          type="button"
          className={botao(soVitrine)}
          onClick={() => aoMudarVitrine(true)}
          title="Só o que o assinante viu. Responde como foi o produto."
        >
          Só a vitrine
        </button>
        <span className="text-[13px] text-ink-2">
          {soVitrine
            ? 'Só o que o assinante viu: responde como foi o produto.'
            : 'Inclui o mercado fora da vitrine: responde como está a metodologia.'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-dim">
          Comparar
        </span>
        {/* O padrão da comparação é a janela anterior de mesmo tamanho: comparar
            uma semana contra um mês compara também dois tamanhos de amostra. */}
        <button
          type="button"
          className={botao(periodoB === null)}
          onClick={() => aoMudarComparacao(null)}
        >
          Um período só
        </button>
        <button
          type="button"
          className={botao(periodoB !== null)}
          onClick={() => aoMudarComparacao(periodoB ?? periodoAnterior(periodo))}
        >
          Com o período anterior
        </button>

        {periodoB && (
          <span className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label="Início do período de comparação"
              value={periodoB.de}
              max={periodoB.ate}
              onChange={(e) => aoMudarComparacao({ ...periodoB, de: e.target.value })}
              className="rounded-rebrand-sm border border-line-2 px-2 py-1 text-[13px] text-ink"
            />
            <span className="text-[13px] text-ink-dim">até</span>
            <input
              type="date"
              aria-label="Fim do período de comparação"
              value={periodoB.ate}
              min={periodoB.de}
              onChange={(e) => aoMudarComparacao({ ...periodoB, ate: e.target.value })}
              className="rounded-rebrand-sm border border-line-2 px-2 py-1 text-[13px] text-ink"
            />
          </span>
        )}
      </div>
    </div>
  );
}
