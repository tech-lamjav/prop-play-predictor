import {
  POSICOES,
  POSICOES_CALCULADAS,
  ROTULO_DA_POSICAO,
  TOM_DA_POSICAO,
  type Posicao,
} from './crm-painel';

/**
 * O funil inteiro numa faixa, e cada posição é um filtro.
 *
 * A barra é proporcional à maior posição, e não ao total: com quatrocentos em
 * "Novo" e quatro em "Boletada", proporção ao total faria as cinco últimas
 * posições desaparecerem — e o gargalo é justamente lá que se vê.
 *
 * As duas últimas posições vêm do banco, não da mão de ninguém. A faixa marca
 * isso: um número que o sócio não consegue mudar arrastando precisa avisar que
 * não se muda arrastando.
 */
export function FaixaDoFunil({
  contagem,
  selecionada,
  aoSelecionar,
}: {
  contagem: Record<Posicao, number>;
  selecionada: Posicao | null;
  aoSelecionar: (posicao: Posicao | null) => void;
}) {
  const maior = Math.max(1, ...POSICOES.map((p) => contagem[p]));

  return (
    <section
      role="region"
      aria-label="Funil"
      className="rounded-rebrand-md border border-line-2 bg-white p-4"
    >
      <div className="flex items-end gap-2 overflow-x-auto">
        {POSICOES.map((posicao) => {
          const valor = contagem[posicao];
          const calculada = POSICOES_CALCULADAS.includes(posicao);
          const ativa = selecionada === posicao;

          return (
            <button
              key={posicao}
              type="button"
              // Clicar de novo na posição ativa limpa o filtro: sem isso, sair
              // dele exige achar um "limpar" em outro canto da tela.
              onClick={() => aoSelecionar(ativa ? null : posicao)}
              aria-pressed={ativa}
              className={`min-w-[84px] flex-1 rounded-rebrand-sm border px-2 pb-2 pt-3 text-left transition ${
                ativa ? 'border-forest bg-forest/5' : 'border-transparent hover:bg-canvas'
              }`}
            >
              <p className="font-display text-3xl font-black tabular-nums text-ink">{valor}</p>
              <div className="mt-1.5 h-2 w-full rounded-full bg-canvas">
                <div
                  // A mesma escala do ponto da tabela: uma posição tem a mesma cor
                  // nos dois lugares, senão são dois vocabulários para uma coisa.
                  className={`h-2 rounded-full ${TOM_DA_POSICAO[posicao]}`}
                  style={{ width: `${Math.round((valor / maior) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[12px] font-bold leading-tight text-ink">
                {ROTULO_DA_POSICAO[posicao]}
              </p>
              {calculada && (
                <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-dim">
                  o banco responde
                </p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
