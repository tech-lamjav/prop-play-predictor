import { type SerieHistorico, type Story } from '@/utils/futebol-historico';
import { dia, rotuloMedia, rotuloValor } from '@/utils/futebol-grafico-de-barras';
import { Crest } from './Crest';

/**
 * O bloco de barras de UMA série, e os formatadores que ele usa.
 *
 * Mora aqui, e não dentro da aba de premissas onde nasceu, porque passou a ter
 * dois leitores: o gráfico que prova a premissa e o da aba de Estatísticas. A
 * gramática visual é a mesma nos dois — barra por jogo, escala compartilhada,
 * média tracejada âmbar, escudo do adversário encostado embaixo — e é isso que
 * deixa quem aprendeu a ler um ler o outro sem reaprender.
 *
 * ⚠️ Escrever um segundo desenhista era o caminho curto e é o defeito conhecido
 * deste canto do código: `seriesDaEspecificacao` existe porque duas funções
 * calculando a mesma série divergiram (#350), e a mesma coisa vale para pixel.
 * Dois desenhos da mesma barra acabam com padding, altura mínima e cor
 * diferentes, e ninguém compara duas abas lado a lado para notar.
 *
 * O que cada elemento existe para responder:
 *   rótulo em cima da barra → quanto foi naquele jogo
 *   escudo embaixo         → contra quem foi
 *   linha tracejada âmbar  → a média da série
 *   rótulo na ponta da linha → qual é essa média, sem precisar medir no olho
 */

/**
 * A cor da barra. Na aba de premissas ela diz o que o jogo significa PARA A
 * SAÍDA ESCOLHIDA; na de Estatísticas, onde não há saída escolhida, diz apenas
 * acima ou abaixo da média. Quem decide o significado é a série, pela `direcao`
 * e pela régua que produziu `favorece` — o desenho só pinta.
 */
export const COR_FAVOR = '#0a3d2e';
export const COR_CONTRA = '#c9cec6';

export const PLOT = 96;
const TOPO_ROTULO = 16;

/** Um bloco do gráfico unificado: as barras de um time, na escala comum. */
export function BlocoSerie({
  s,
  teto,
  comRotulo,
  mostraComoLer,
  referencia,
}: {
  s: SerieHistorico;
  teto: number;
  comRotulo: boolean;
  /** As séries do card medem coisas diferentes, então cada uma se explica. */
  mostraComoLer: boolean;
  referencia?: Story['referencia'];
}) {
  const y = (v: number) => (v / teto) * (PLOT - TOPO_ROTULO);
  return (
    <div className="min-w-0" style={{ flexGrow: s.jogos.length, flexBasis: 0 }}>
      {/* O escudo e o nome ficam em cima do PRÓPRIO gráfico: na legenda longe dele
          não dava para saber qual metade era de quem. */}
      <div className="flex items-center gap-1.5 mb-2 min-w-0">
        <Crest name={s.teamName} id={s.teamId} size={16} />
        <span className="text-[11.5px] font-semibold text-ink truncate">{s.titulo}</span>
        {s.sub && <span className="text-[10.5px] text-ink-3 shrink-0">{s.sub}</span>}
      </div>
      {/* A barra se ajusta à largura, sem rolagem — e isso passou a caber
          porque o RECORTE mudou.

          Enquanto a tela desenhava o histórico inteiro, 25 barras em ~290px
          davam menos de 12px cada: nesse tamanho não se compara altura nenhuma,
          o escudo fica ilegível e o rótulo de valor não aparece. A saída da vez
          foi barra fixa de 28px com rolagem lateral.

          Com a janela alinhada ao modelo — dez jogos — são ~25px por barra numa
          fileira só. Rolagem para dezessete pixels de sobra seria complexidade
          sem troco, e o panorama de ver tudo de uma vez volta de graça. */}
      <div className="relative" style={{ height: PLOT }}>
        <div className="absolute inset-0 flex items-end gap-[3px]">
          {s.jogos.map((j) => (
            <div
              key={`${j.ordem}-${j.data}`}
              className="flex-1 min-w-[6px] max-w-[44px] flex flex-col items-center justify-end"
              title={`${dia(j.data)} · ${j.emCasa ? 'em casa' : 'fora'} contra ${j.adversario} · ${j.placar}${
                j.valor != null ? ` · ${rotuloValor(j.valor, s.metrica)}` : ' · sem dado'
              }`}
            >
              {comRotulo && (
                <span className="tabular-nums text-[9.5px] font-semibold leading-none mb-1" style={{ color: 'var(--ink-2)' }}>
                  {j.valor == null ? '·' : rotuloValor(j.valor, s.metrica)}
                </span>
              )}
              <div
                className="w-full rounded-t-[3px]"
                style={{
                  height: j.valor == null ? 3 : Math.max(3, y(j.valor)),
                  background: j.valor == null ? '#e3e6e0' : j.favorece ? COR_FAVOR : COR_CONTRA,
                }}
              />
            </div>
          ))}
        </div>
        {referencia && (
          <div
            className="absolute left-0 right-0 border-t border-dashed pointer-events-none"
            style={{ borderColor: 'var(--ink-3)', bottom: y(referencia.valor) }}
          />
        )}
        {s.media != null && s.mostraMedia && (
          <>
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed pointer-events-none"
              style={{ borderColor: '#d4a017', bottom: y(s.media) }}
            />
            <span
              className="absolute right-0 tabular-nums text-[9.5px] font-bold px-1 rounded bg-white/90 pointer-events-none"
              style={{ color: '#b8870f', bottom: y(s.media) + 2 }}
            >
              {rotuloMedia(s.media, s.metrica)}
            </span>
          </>
        )}
      </div>
      {/* Contra quem foi cada jogo. Encostado nas barras, sempre: o escudo é a
          legenda do eixo, e qualquer coisa entre os dois quebra a leitura de
          "esta barra foi contra este time". */}
      <div className="flex items-start gap-[3px] mt-1.5">
        {s.jogos.map((j) => (
          <div key={`c-${j.ordem}-${j.data}`} className="flex-1 min-w-[6px] max-w-[44px] flex justify-center">
            <Crest name={j.adversario} id={j.adversarioId} size={comRotulo ? 15 : 11} />
          </div>
        ))}
      </div>
      {/* A explicação DESTE gráfico, quando as séries do card medem coisas
          diferentes. Onde medem a mesma, a story traz uma só, embaixo dos dois
          — repeti-la em cada um seria dizer duas vezes. */}
      {mostraComoLer && (
        <div className="text-[11px] leading-relaxed mt-2" style={{ color: '#8d8672' }}>
          {s.comoLer}
        </div>
      )}
    </div>
  );
}
