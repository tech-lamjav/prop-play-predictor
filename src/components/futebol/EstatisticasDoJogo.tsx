import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';
import {
  ehMercadoDoGrafico,
  ESCOLHA_PADRAO,
  graficoDaEstatistica,
  JANELAS_OFERECIDAS,
  MERCADOS_NO_GRAFICO,
  type EscolhaDaEstatistica,
  type MercadoDoGrafico,
  type QuemNoGrafico,
} from '@/utils/futebol-estatisticas-da-partida';
import { cabeRotulo, pisoDaEscala, tetoDaEscala } from '@/utils/futebol-grafico-de-barras';
import { exato } from '@/utils/futebol-criterio';
import { Chip } from './Chip';
import { BlocoSerie, COR_CONTRA, COR_FAVOR } from './GraficoDeBarras';

/**
 * O jogo a jogo dos dois times, na aba de Estatísticas.
 *
 * ⚠️ O que ele mostra é **estatística da partida**, e não **evidência** de
 * premissa. É essa fronteira que autoriza mercado, janela, mando e time a serem
 * escolha de quem olha: o gráfico da aba de mercados tem tudo travado pelo
 * modelo, porque lá ele responde por um número que o modelo calculou.
 *
 * E a LINHA aqui é referência, não aposta: nada é liquidado, não há lado
 * escolhido e não há preço. Mexer nela repinta as barras e não toca nos valores.
 */

const LABEL = 'text-[10px] uppercase tracking-[0.14em] font-bold text-ink-3';

function Fileira({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className={`${LABEL} shrink-0 w-[56px]`}>{rotulo}</span>
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">{children}</div>
    </div>
  );
}

/**
 * A linha sai como está: 1,75 é 1,75, não 1,8. É o `exato` do módulo do
 * critério — havia uma cópia desta expressão aqui, e ela já é a função de lá.
 */
const fmtLinha = exato;

export function EstatisticasDoJogo({
  historico,
  carregando,
  mercadoInicial,
  linhaInicial,
}: {
  historico: FutebolFixtureHistorico[] | undefined;
  carregando: boolean;
  /** O mercado que a pessoa vinha lendo, para a aba não recomeçar do zero. */
  mercadoInicial?: string;
  /** A linha daquele mercado. Daqui em diante ela é livre: aqui é referência. */
  linhaInicial?: number | null;
}) {
  const [escolha, setEscolha] = useState<EscolhaDaEstatistica>(() => {
    const mercado = ehMercadoDoGrafico(mercadoInicial) ? mercadoInicial : ESCOLHA_PADRAO.mercado;
    const { paradas, padrao } = MERCADOS_NO_GRAFICO[mercado];
    // A linha do link só vale se existir na régua deste mercado; fora disso, a
    // padrão. Nunca nula num mercado que tem linha: nascer sem ela desligaria
    // justamente a coisa que este gráfico veio fazer.
    const linha = linhaInicial != null && paradas.includes(linhaInicial) ? linhaInicial : padrao;
    return { ...ESCOLHA_PADRAO, mercado, linha };
  });

  const { series, contagem, referencia, temLinha } = graficoDaEstatistica(escolha, historico);
  const teto = tetoDaEscala(series, referencia ?? undefined);
  const piso = pisoDaEscala(series);
  const comRotulo = cabeRotulo(series);
  const doMercado = MERCADOS_NO_GRAFICO[escolha.mercado];

  const nomeDoLado = (lado: 'home' | 'away') => historico?.find((r) => r.side === lado)?.team_name ?? null;
  const mandante = nomeDoLado('home');
  const visitante = nomeDoLado('away');
  const quemNoTexto = escolha.quem === 'mandante' ? mandante : escolha.quem === 'visitante' ? visitante : null;

  const muda = (parte: Partial<EscolhaDaEstatistica>) => setEscolha((atual) => ({ ...atual, ...parte }));

  /**
   * Trocar de mercado pode trocar a GRANDEZA, e aí a linha antiga não vale.
   *
   * ⚠️ Não basta perguntar se o número existe nas paradas do novo mercado. Ele
   * costuma existir: 2,5 é parada em Gols e nos de saldo. Só que 2,5 em Gols é
   * "dois gols e meio na partida" e 2,5 em Dupla chance é "vencer por três" —
   * mesmo número, grandezas diferentes, e a tela trocaria uma pela outra sem
   * dizer nada. Carrega só quando a métrica é a mesma; fora isso, a padrão do
   * mercado novo.
   */
  const trocaMercado = (slug: MercadoDoGrafico) => {
    const destino = MERCADOS_NO_GRAFICO[slug];
    setEscolha((atual) => {
      const mesmaGrandeza = MERCADOS_NO_GRAFICO[atual.mercado].metrica === destino.metrica;
      const mantem = mesmaGrandeza && atual.linha != null && destino.paradas.includes(atual.linha);
      return { ...atual, mercado: slug, linha: mantem ? atual.linha : destino.padrao };
    });
  };

  const iDaLinha = doMercado.paradas.findIndex((p) => p === escolha.linha);
  /** A cor diz o quê. No binário não há "linha", há o fato de os dois marcarem. */
  const legendaAcima = temLinha ? 'acima da linha' : 'os dois marcaram';

  /**
   * O time que o recorte deixou de fora, quando o outro sobrou. Sem isto a aba
   * desenha um time calada sobre o outro — e a escala passa a ser só dele, o
   * contrário do que a escala compartilhada promete.
   */
  const semSerie = (['home', 'away'] as const)
    .map((lado) => nomeDoLado(lado))
    .filter((nome): nome is string => !!nome)
    .filter((nome) => !series.some((s) => s.teamName === nome));

  return (
    <div className="rounded-rebrand-xl overflow-hidden bg-white border border-line">
      <div className="px-5 py-3 border-b border-line">
        <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">Jogo a jogo</div>
        <div className="text-[10px] text-ink-3 mt-0.5">
          O desempenho recente dos dois times. Não é a leitura do modelo.
        </div>
      </div>

      <div className="p-5">
        <div className="flex flex-col gap-2.5 mb-4">
          <Fileira rotulo="Mercado">
            {(Object.keys(MERCADOS_NO_GRAFICO) as MercadoDoGrafico[]).map((slug) => (
              <Chip key={slug} ativo={escolha.mercado === slug} onClick={() => trocaMercado(slug)}>
                {MERCADOS_NO_GRAFICO[slug].chip}
              </Chip>
            ))}
          </Fileira>
          <Fileira rotulo="Times">
            <Chip ativo={escolha.quem === 'ambos'} onClick={() => muda({ quem: 'ambos' })}>Os dois</Chip>
            {(['mandante', 'visitante'] as QuemNoGrafico[]).map((q) => (
              <Chip key={q} ativo={escolha.quem === q} onClick={() => muda({ quem: q })}>
                {(q === 'mandante' ? mandante : visitante) ?? (q === 'mandante' ? 'Mandante' : 'Visitante')}
              </Chip>
            ))}
          </Fileira>
          <Fileira rotulo="Janela">
            {JANELAS_OFERECIDAS.map((j) => (
              <Chip key={j} ativo={escolha.janela === j} onClick={() => muda({ janela: j })}>{`Últimos ${j}`}</Chip>
            ))}
          </Fileira>
          <Fileira rotulo="Mando">
            <Chip ativo={escolha.mando === 'todos'} onClick={() => muda({ mando: 'todos' })}>Todos os jogos</Chip>
            {/* Nomeia a REGRA e não um lado: o recorte é o mandante em casa E o
                visitante fora, que são mandos opostos. */}
            <Chip ativo={escolha.mando === 'proprio'} onClick={() => muda({ mando: 'proprio' })}>Mando deste jogo</Chip>
          </Fileira>
        </div>

        {temLinha && doMercado.paradas.length > 0 && (
          <div className="rounded-rebrand-md bg-canvas-2 px-4 py-3 mb-4">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className={LABEL}>Linha de referência</span>
              <span className="tabular-nums text-[15px] font-bold text-ink">
                {escolha.linha == null ? '—' : fmtLinha(escolha.linha)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={doMercado.paradas.length - 1}
              step={1}
              value={iDaLinha < 0 ? 0 : iDaLinha}
              aria-label="Linha de referência"
              onChange={(e) => muda({ linha: doMercado.paradas[Number(e.target.value)] })}
              className="w-full h-11 cursor-pointer accent-[color:var(--forest)]"
            />
            {/* O número SEMPRE nomeia a própria base. Existe premissa que conta
                os últimos cinco contra a linha, com janela travada pelo modelo:
                dois números da mesma forma só não se contradizem porque cada um
                declara de onde saiu. */}
            {/* ⚠️ A frase declara a BASE inteira, e não só um número.
                Ela dizia "N dos últimos M", com M somando as barras dos DOIS
                times — então com janela 10 e os dois no gráfico ela anunciava
                "os últimos 20", uma janela que ninguém escolheu, sem dizer de
                quais times nem que o recorte de mando estava ligado.
                Existe premissa que conta os últimos cinco contra a linha, com
                janela travada pelo modelo: dois números da mesma forma só não se
                contradizem porque cada um diz de onde saiu. */}
            {contagem && contagem.de > 0 && (
              <div className="text-[12px] text-ink-2 mt-1">
                <strong className="font-bold text-ink">{contagem.acima}</strong> dos {contagem.de} jogos{' '}
                {escolha.quem === 'ambos' ? 'dos dois times' : `do ${quemNoTexto ?? 'time'}`} passaram de{' '}
                {fmtLinha(referencia as number)}.
                <span className="block text-[10.5px] text-ink-3 mt-0.5">
                  Janela: últimos {escolha.janela} de cada time
                  {escolha.mando === 'proprio' ? ', só com o mando deste confronto' : ''}.
                </span>
              </div>
            )}
          </div>
        )}

        {carregando ? (
          <p className="text-[13px] py-6 text-center" style={{ color: '#8d8672' }}>Carregando os jogos anteriores.</p>
        ) : !series.length ? (
          <p className="text-[13px] py-6 text-center" style={{ color: '#8d8672' }}>
            {escolha.mando === 'proprio'
              ? 'Nenhum dos jogos recentes bate com o mando deste confronto. Experimente todos os jogos.'
              : 'Sem jogos anteriores para estes times.'}
          </p>
        ) : (
          <>
            <div className="flex flex-col items-start gap-1 mb-3 md:flex-row md:items-center md:gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COR_FAVOR }} />
                <span className="text-[10.5px] text-ink-2">{legendaAcima}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COR_CONTRA }} />
                <span className="text-[10.5px] text-ink-3">abaixo</span>
              </span>
              <span className="text-[10.5px]" style={{ color: '#8d8672' }}>A cor compara, não diz se foi bom.</span>
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-start gap-4 md:gap-3">
              {series.map((s, i) => (
                <div
                  key={s.chave}
                  className={cn('flex min-w-0', i > 0 && 'pt-4 border-t md:pt-0 md:pl-3 md:border-t-0 md:border-l border-line')}
                  style={{ flexGrow: s.jogos.length, flexBasis: 0 }}
                >
                  <BlocoSerie
                    s={s}
                    teto={teto}
                    piso={piso}
                    comRotulo={comRotulo}
                    comPlacar
                    rotuloDentro
                    mostraComoLer={false}
                  />
                </div>
              ))}
            </div>

            {semSerie.length > 0 && (
              <div className="text-[11px] leading-relaxed mt-3 text-ink-2">
                {semSerie.join(' e ')} não tem jogo nesse recorte, então o gráfico mostra um time só — e a
                escala é a dele, não a dos dois.
              </div>
            )}

            <div className="text-[11px] leading-relaxed mt-3" style={{ color: '#8d8672' }}>{series[0].comoLer}</div>
          </>
        )}
      </div>
    </div>
  );
}
