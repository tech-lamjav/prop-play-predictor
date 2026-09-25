import { cn } from '@/lib/utils';
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

const COR_RES: Record<'V' | 'E' | 'D', { bg: string; fg: string }> = {
  V: { bg: '#dcefe2', fg: '#0a3d2e' },
  E: { bg: '#eef0eb', fg: '#5a625a' },
  D: { bg: '#fbeeec', fg: '#b8341c' },
};

/**
 * Sequência de resultados: um quadro por jogo, com placar, escudo e adversário.
 *
 * Vive aqui pelo mesmo motivo que `BlocoSerie`: ganhou um segundo leitor. A
 * métrica `resultado` não tem quantidade — vitória não é "mais alto" que
 * empate —, então desenhá-la como barra é a tela afirmando uma grandeza que não
 * existe. Quem tem série de resultado usa isto, não barra.
 */
export function SerieResultados({ s, corPor = 'resultado' }: { s: SerieHistorico; corPor?: 'resultado' | 'valor' }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {s.jogos.map((j) => {
        // Em "ambos marcam" a cor não é vitória nem derrota: é o fato ter
        // acontecido ou não. Pintar de verde uma vitória em que só um time
        // marcou seria a cor respondendo outra pergunta que a do seletor.
        const c = corPor === 'valor' ? (j.valor ? COR_RES.V : COR_RES.D) : COR_RES[j.resultado];
        return (
          <div
            key={`${j.ordem}-${j.data}`}
            className="rounded-lg px-2 py-1.5"
            style={{ background: c.bg }}
            title={`${dia(j.data)} · ${j.emCasa ? 'em casa' : 'fora'} contra ${j.adversario}`}
          >
            <div className="tabular-nums text-[12.5px] font-bold leading-none text-center" style={{ color: c.fg }}>
              {j.placar}
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <Crest name={j.adversario} id={j.adversarioId} size={13} />
              <span className="text-[9.5px] truncate max-w-[58px]" style={{ color: c.fg, opacity: 0.8 }}>
                {j.adversario}
              </span>
            </div>
            {/* A DATA, porque sem ela o quadro não diz qual jogo é o mais
                recente — e num histórico a ordem é metade da informação. */}
            <div className="tabular-nums text-[9px] mt-0.5 text-center" style={{ color: c.fg, opacity: 0.65 }}>
              {dia(j.data)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Um bloco do gráfico unificado: as barras de um time, na escala comum. */
/**
 * O placar na forma compacta do eixo. O "×" é o separador que a tela de
 * confrontos diretos já usa; "4 a 0" não cabe embaixo de uma barra.
 */
const placarCurto = (placar: string) => placar.replace(' a ', '×');

/** Abaixo disto a barra não tem altura para segurar o rótulo por dentro. */
const ALTURA_MINIMA_PARA_ROTULO_DENTRO = 18;

/**
 * UM gráfico só, com as séries em sequência na mesma área de desenho.
 *
 * A diferença para `BlocoSerie` não é de estilo: lá cada série tem a PRÓPRIA
 * caixa, aqui existe uma caixa só. É isso que faz a linha de referência
 * atravessar os dois times de ponta a ponta, em vez de virar dois traços
 * paralelos que o olho tem de casar sozinho.
 *
 * Em SEQUÊNCIA, e não emparelhado nem intercalado por data: emparelhar sugere
 * que o primeiro jogo de um time "corresponde" ao primeiro do outro, e eles não
 * têm relação nenhuma; intercalar mistura duas linhas do tempo que os times não
 * compartilham.
 *
 * ⚠️ A geometria da barra está escrita aqui e também em `BlocoSerie`.
 * Duplicação consciente: reformar o `BlocoSerie` mexeria no gráfico das
 * premissas, que é a tela de maior tráfego e cuja aparência ninguém pediu para
 * mudar. Fundir os dois exige poder conferir pixel.
 */
export function BarrasEmSequencia({
  series,
  teto,
  piso = 0,
  altura = PLOT,
  comRotulo,
  comPlacar = false,
  rotuloDentro = false,
  referencia,
}: {
  series: SerieHistorico[];
  teto: number;
  piso?: number;
  /**
   * A altura da área de desenho. Parâmetro, e não a constante: os 96px nasceram
   * para o gráfico embaixo de uma premissa, que divide espaço com o card
   * inteiro. Numa aba dedicada isso deixa as barras achatadas e o eixo curto
   * demais para comparar altura, que é a única coisa que a barra sabe fazer.
   */
  altura?: number;
  comRotulo: boolean;
  comPlacar?: boolean;
  rotuloDentro?: boolean;
  referencia?: number | null;
}) {
  const util = altura - TOPO_ROTULO;
  const amplitude = teto - piso || 1;
  const zero = ((0 - piso) / amplitude) * util;
  const alturaDe = (v: number) => (Math.abs(v) / amplitude) * util;
  const posDe = (v: number) => zero + (v / amplitude) * util;
  const temNegativo = piso < 0;
  /** Cada grupo ocupa a fatia de largura proporcional aos jogos que tem. */
  const fatia = (s: SerieHistorico) => ({ flexGrow: s.jogos.length, flexBasis: 0 });
  const divisor = (i: number) => (i > 0 ? 'pl-2 border-l border-line' : '');

  return (
    <div>
      {/* Um rótulo por grupo, na mesma proporção das barras, para o nome ficar
          sobre as barras que ele nomeia. */}
      <div className="flex gap-[3px] mb-2">
        {series.map((s, i) => (
          <div key={`h-${s.chave}`} style={fatia(s)} className={cn('flex items-center gap-1.5 min-w-0', divisor(i))}>
            <Crest name={s.teamName} id={s.teamId} size={16} />
            <span className="text-[11.5px] font-semibold text-ink truncate">{s.titulo}</span>
            {s.sub && <span className="text-[10.5px] text-ink-3 shrink-0">{s.sub}</span>}
          </div>
        ))}
      </div>

      <div className="relative" style={{ height: PLOT }}>
        <div className="absolute inset-0 flex gap-[3px]">
          {series.map((s, i) => (
            <div key={`p-${s.chave}`} style={fatia(s)} className={cn('flex items-end gap-[3px] min-w-0', divisor(i))}>
              {s.jogos.map((j) => {
                const v = j.valor;
                const alt = v == null ? 3 : Math.max(3, alturaDe(v));
                const base = v == null || v >= 0 ? zero : zero - alt;
                const dentro = rotuloDentro && alt >= ALTURA_MINIMA_PARA_ROTULO_DENTRO;
                return (
                  <div
                    key={`${j.ordem}-${j.data}`}
                    className="relative flex-1 min-w-[6px] max-w-[44px] h-full"
                    title={`${dia(j.data)} · ${j.emCasa ? 'em casa' : 'fora'} contra ${j.adversario} · ${j.placar}${
                      v != null ? ` · ${rotuloValor(v, s.metrica)}` : ' · sem dado'
                    }`}
                  >
                    {comRotulo && (
                      <span
                        className={cn(
                          'absolute left-0 right-0 text-center tabular-nums text-[9.5px] leading-none',
                          dentro ? 'font-bold' : 'font-semibold',
                        )}
                        style={{
                          color: dentro ? (j.favorece ? 'var(--canvas)' : 'var(--ink)') : 'var(--ink-2)',
                          bottom: dentro ? (v != null && v < 0 ? base + alt - 12 : base + 3) : base + alt + 4,
                        }}
                      >
                        {v == null ? '·' : rotuloValor(v, s.metrica)}
                      </span>
                    )}
                    <div
                      className={cn('absolute left-0 right-0', v != null && v < 0 ? 'rounded-b-[3px]' : 'rounded-t-[3px]')}
                      style={{
                        bottom: base,
                        height: alt,
                        background: v == null ? '#e3e6e0' : j.favorece ? COR_FAVOR : COR_CONTRA,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* A linha atravessa o gráfico INTEIRO. É a continuidade que o desenho
            em duas caixas não conseguia dar. */}
        {/* O valor GRUDADO na linha, como na referência da NBA. Fora dela, o
            número vivia num painel acima do gráfico, e era preciso casar dois
            lugares para saber onde a linha estava. */}
        {referencia != null && (
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed pointer-events-none"
            style={{ borderColor: 'var(--ink)', bottom: posDe(referencia) }}
          >
            <span
              className="absolute right-0 -translate-y-1/2 tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded text-canvas"
              style={{ background: 'var(--ink)' }}
            >
              {String(referencia).replace('.', ',')}
            </span>
          </div>
        )}
        {temNegativo && (
          <div className="absolute left-0 right-0 border-t pointer-events-none" style={{ borderColor: 'var(--ink-3)', bottom: zero }} />
        )}
      </div>

      <div className="flex gap-[3px] mt-1.5">
        {series.map((s, i) => (
          <div key={`e-${s.chave}`} style={fatia(s)} className={cn('flex items-start gap-[3px] min-w-0', divisor(i))}>
            {s.jogos.map((j) => (
              <div key={`c-${j.ordem}-${j.data}`} className="flex-1 min-w-[6px] max-w-[44px] flex flex-col items-center gap-0.5">
                <Crest name={j.adversario} id={j.adversarioId} size={comRotulo ? 15 : 11} />
                {comPlacar && comRotulo && (
                  <span className="tabular-nums text-[8.5px] leading-none text-ink-3">{placarCurto(j.placar)}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BlocoSerie({
  s,
  teto,
  piso = 0,
  comRotulo,
  comPlacar = false,
  rotuloDentro = false,
  mostraComoLer,
  referencia,
}: {
  s: SerieHistorico;
  teto: number;
  /**
   * O fundo da escala. Zero em tudo que só cresce para cima; negativo no saldo
   * de gols, onde a barra precisa descer a partir de uma linha de base.
   */
  piso?: number;
  comRotulo: boolean;
  /**
   * Placar embaixo do escudo. ⚠️ Desligado por padrão: o gráfico das premissas
   * não pediu isso, e mudar a aparência dele não é o que esta mudança veio
   * fazer. Segue a mesma régua de largura do rótulo — abaixo dela não cabe.
   */
  comPlacar?: boolean;
  /**
   * Rótulo DENTRO da barra, como na tela de jogador da NBA. Também desligado
   * por padrão, e também só para a aba de Estatísticas. Cai para fora quando a
   * barra é baixa demais para segurá-lo.
   */
  rotuloDentro?: boolean;
  /** As séries do card medem coisas diferentes, então cada uma se explica. */
  mostraComoLer: boolean;
  referencia?: Story['referencia'];
}) {
  const util = PLOT - TOPO_ROTULO;
  const amplitude = teto - piso || 1;
  /** Onde o zero cai, medido do fundo do gráfico. É 0 quando não há negativo. */
  const zero = ((0 - piso) / amplitude) * util;
  const alturaDe = (v: number) => (Math.abs(v) / amplitude) * util;
  const temNegativo = piso < 0;
  const y = (v: number) => zero + ((v - 0) / amplitude) * util;
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
        {/* ⚠️ DOIS caminhos de desenho, de propósito.
            O de cima é o original, byte por byte, e é o que as premissas usam:
            barra colada no fundo, crescendo para cima. O de baixo só entra
            quando existe valor negativo — hoje, só o saldo de gols do mercado
            de handicap. Mantê-los separados é o que garante que o gráfico das
            premissas não mudou um pixel, e eu não tenho como conferir pixel por
            leitura de código. Quem puder olhar os dois lado a lado pode fundi-los. */}
        {!temNegativo ? (
          <div className="absolute inset-0 flex items-end gap-[3px]">
            {s.jogos.map((j) => (
              <div
                key={`${j.ordem}-${j.data}`}
                className="flex-1 min-w-[6px] max-w-[44px] flex flex-col items-center justify-end"
                title={`${dia(j.data)} · ${j.emCasa ? 'em casa' : 'fora'} contra ${j.adversario} · ${j.placar}${
                  j.valor != null ? ` · ${rotuloValor(j.valor, s.metrica)}` : ' · sem dado'
                }`}
              >
                {(() => {
                  const alt = j.valor == null ? 3 : Math.max(3, y(j.valor));
                  const dentro = rotuloDentro && alt >= ALTURA_MINIMA_PARA_ROTULO_DENTRO;
                  const texto = j.valor == null ? '·' : rotuloValor(j.valor, s.metrica);
                  return (
                    <>
                      {comRotulo && !dentro && (
                        <span className="tabular-nums text-[9.5px] font-semibold leading-none mb-1" style={{ color: 'var(--ink-2)' }}>
                          {texto}
                        </span>
                      )}
                      <div
                        className="w-full rounded-t-[3px] relative"
                        style={{
                          height: alt,
                          background: j.valor == null ? '#e3e6e0' : j.favorece ? COR_FAVOR : COR_CONTRA,
                        }}
                      >
                        {comRotulo && dentro && (
                          <span
                            className="absolute left-0 right-0 bottom-[3px] text-center tabular-nums text-[9.5px] font-bold leading-none"
                            style={{ color: j.favorece ? 'var(--canvas)' : 'var(--ink)' }}
                          >
                            {texto}
                          </span>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-stretch gap-[3px]">
            {s.jogos.map((j) => {
              const v = j.valor;
              const alt = v == null ? 3 : Math.max(3, alturaDe(v));
              const base = v == null || v >= 0 ? zero : zero - alt;
              return (
                <div
                  key={`${j.ordem}-${j.data}`}
                  className="relative flex-1 min-w-[6px] max-w-[44px]"
                  title={`${dia(j.data)} · ${j.emCasa ? 'em casa' : 'fora'} contra ${j.adversario} · ${j.placar}${
                    v != null ? ` · ${rotuloValor(v, s.metrica)}` : ' · sem dado'
                  }`}
                >
                  {/* 4px, o mesmo respiro do `mb-1` do caminho de cima: os dois
                      desenhos precisam ser indistinguíveis onde medem a mesma
                      coisa, senão a barra muda de aparência ao trocar de
                      mercado e ninguém descobre por quê. */}
                  {comRotulo && (() => {
                    const dentro = rotuloDentro && alt >= ALTURA_MINIMA_PARA_ROTULO_DENTRO;
                    // Dentro, o rótulo encosta na LINHA DO ZERO dos dois lados:
                    // logo acima dela na barra que sobe, logo abaixo na que
                    // desce. É o que mantém os números alinhados numa fileira só.
                    const posicao = !dentro
                      ? base + alt + 4
                      : v != null && v < 0
                        ? base + alt - 12
                        : base + 3;
                    return (
                      <span
                        className={cn(
                          'absolute left-0 right-0 text-center tabular-nums text-[9.5px] leading-none',
                          dentro ? 'font-bold' : 'font-semibold',
                        )}
                        style={{
                          color: dentro ? (j.favorece ? 'var(--canvas)' : 'var(--ink)') : 'var(--ink-2)',
                          bottom: posicao,
                        }}
                      >
                        {v == null ? '·' : rotuloValor(v, s.metrica)}
                      </span>
                    );
                  })()}
                  {/* Arredondada na ponta LIVRE: em cima quando sobe, embaixo
                      quando desce. O mesmo raio de 3px do outro caminho — eram
                      2px e quadrada dos dois lados, e essa foi a primeira
                      divergência entre os dois desenhos, nascida junto com eles. */}
                  <div
                    className={cn('absolute left-0 right-0', v != null && v < 0 ? 'rounded-b-[3px]' : 'rounded-t-[3px]')}
                    style={{
                      bottom: base,
                      height: alt,
                      background: v == null ? '#e3e6e0' : j.favorece ? COR_FAVOR : COR_CONTRA,
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
        {/* A linha do zero, que é o que dá sentido à barra que desce. */}
        {temNegativo && (
          <div className="absolute left-0 right-0 border-t pointer-events-none" style={{ borderColor: 'var(--ink-3)', bottom: zero }} />
        )}
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
          <div key={`c-${j.ordem}-${j.data}`} className="flex-1 min-w-[6px] max-w-[44px] flex flex-col items-center gap-0.5">
            <Crest name={j.adversario} id={j.adversarioId} size={comRotulo ? 15 : 11} />
            {/* O placar, na mesma régua de largura do rótulo: abaixo dela a
                barra tem seis pixels e nada legível cabe embaixo dela. */}
            {comPlacar && comRotulo && (
              <span className="tabular-nums text-[8.5px] leading-none text-ink-3">{placarCurto(j.placar)}</span>
            )}
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
