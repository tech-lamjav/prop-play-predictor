import { useState } from 'react';
import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';
import { DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import {
  ehMercadoDoGrafico,
  ESCOLHA_PADRAO,
  graficoDaEstatistica,
  JANELAS_OFERECIDAS,
  MERCADOS_NO_GRAFICO,
  type EscolhaDaEstatistica,
  type MandoDaEstatistica,
  type MercadoDoGrafico,
  type QuemNoGrafico,
} from '@/utils/futebol-estatisticas-da-partida';
import { cabeRotulo, pisoDaEscala, tetoDaEscala } from '@/utils/futebol-grafico-de-barras';
import { exato } from '@/utils/futebol-criterio';
import { Chip } from './Chip';
import { ITEM_SELETOR, SeletorDeMenu } from './SeletorDeMenu';
import { BarrasEmSequencia, COR_CONTRA, COR_FAVOR, SerieResultados } from './GraficoDeBarras';

/**
 * O jogo a jogo dos dois times, na aba de Estatísticas.
 *
 * ⚠️ O que ele mostra é **estatística da partida**, e não **evidência** de
 * premissa. É essa fronteira que autoriza mercado, janela, mando e time a serem
 * escolha de quem olha: o gráfico da aba de mercados tem tudo travado pelo
 * modelo, porque lá ele responde por um número que o modelo calculou.
 *
 * A LINHA aqui é referência, não aposta: nada é liquidado, não há lado escolhido
 * e não há preço. Mexer nela repinta as barras e não toca nos valores.
 *
 * Dois desenhos, escolhidos pelo MERCADO: mercado com grandeza vira barras num
 * gráfico só, com a linha atravessando; mercado binário vira quadro de jogos,
 * sem linha e um time por vez.
 */

const LABEL = 'text-[10px] uppercase tracking-[0.14em] font-bold text-ink-3';

const MANDOS: { valor: MandoDaEstatistica; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos os jogos' },
  // Nomeia a REGRA e não um lado: o recorte é o mandante em casa E o visitante
  // fora, que são mandos opostos.
  { valor: 'proprio', rotulo: 'Mando deste jogo' },
];

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
    const { paradas, padrao, aceitaOsDois } = MERCADOS_NO_GRAFICO[mercado];
    const linha = linhaInicial != null && paradas.includes(linhaInicial) ? linhaInicial : padrao;
    return { ...ESCOLHA_PADRAO, mercado, linha, quem: aceitaOsDois ? ESCOLHA_PADRAO.quem : 'mandante' };
  });

  const doMercado = MERCADOS_NO_GRAFICO[escolha.mercado];
  const { series, contagem, referencia, temLinha } = graficoDaEstatistica(escolha, historico);
  const teto = tetoDaEscala(series, referencia ?? undefined);
  const piso = pisoDaEscala(series);
  const comRotulo = cabeRotulo(series);
  /** Mercado binário não tem grandeza: vira quadro de jogo, não barra. */
  const ehQuadro = doMercado.metrica === 'resultado' || doMercado.metrica === 'ambos';

  const nomeDoLado = (lado: 'home' | 'away') => historico?.find((r) => r.side === lado)?.team_name ?? null;
  const mandante = nomeDoLado('home');
  const visitante = nomeDoLado('away');
  const quemNoTexto = escolha.quem === 'mandante' ? mandante : escolha.quem === 'visitante' ? visitante : null;

  const muda = (parte: Partial<EscolhaDaEstatistica>) => setEscolha((atual) => ({ ...atual, ...parte }));

  /**
   * Trocar de mercado pode trocar a GRANDEZA, e aí a linha antiga não vale.
   *
   * ⚠️ Não basta perguntar se o número existe nas paradas do novo mercado: 2,5 é
   * parada em Gols e nos de saldo, mas em Gols é "dois gols e meio na partida" e
   * no saldo é "vencer por três". Mesmo número, grandezas diferentes.
   *
   * E mercado binário não aceita os dois times juntos: quem estava em "os dois"
   * cai no mandante, senão o seletor ficaria com um estado que o desenho não
   * sabe mostrar.
   */
  const trocaMercado = (slug: MercadoDoGrafico) => {
    const destino = MERCADOS_NO_GRAFICO[slug];
    setEscolha((atual) => {
      const mesmaGrandeza = MERCADOS_NO_GRAFICO[atual.mercado].metrica === destino.metrica;
      const mantem = mesmaGrandeza && atual.linha != null && destino.paradas.includes(atual.linha);
      return {
        ...atual,
        mercado: slug,
        linha: mantem ? atual.linha : destino.padrao,
        quem: destino.aceitaOsDois || atual.quem !== 'ambos' ? atual.quem : 'mandante',
      };
    });
  };

  const iDaLinha = doMercado.paradas.findIndex((p) => p === escolha.linha);
  const mandoAtual = MANDOS.find((m) => m.valor === escolha.mando)!.rotulo;
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
        {/* ⚠️ DUAS linhas, e não uma fileira rotulada por filtro. Eram quatro
            empilhadas, e juntas ocupavam quase a altura do próprio gráfico.
            O mercado é a dimensão principal e fica exposto como aba; o resto
            cabe numa linha só.

            As abas usam o idioma da barra de abas DESTA PÁGINA, e não o
            controle do kit: a tela já mostra uma barra de abas duas fileiras
            acima, e um segundo estilo de aba aqui seriam duas gramáticas para o
            mesmo gesto. */}
        <div
          className="inline-flex min-w-0 max-w-full overflow-x-auto no-scrollbar p-[3px] rounded-[11px] mb-3"
          style={{ background: 'var(--canvas-2)', border: '1px solid #ded2b6' }}
        >
          {(Object.keys(MERCADOS_NO_GRAFICO) as MercadoDoGrafico[]).map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => trocaMercado(slug)}
              className={`h-8 px-4 shrink-0 whitespace-nowrap rounded-lg text-[13px] cursor-pointer transition border-0 ${
                escolha.mercado === slug ? 'bg-white text-ink font-semibold shadow-sm' : 'bg-transparent text-ink-2 font-medium'
              }`}
            >
              {MERCADOS_NO_GRAFICO[slug].chip}
            </button>
          ))}
        </div>

        {/* O TIME primeiro: é a pergunta mais grossa — de quem estamos falando —
            e as outras se aplicam dentro dela. */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={`${LABEL} shrink-0`}>Times</span>
          {doMercado.aceitaOsDois && (
            <Chip ativo={escolha.quem === 'ambos'} onClick={() => muda({ quem: 'ambos' })}>Os dois</Chip>
          )}
          {(['mandante', 'visitante'] as QuemNoGrafico[]).map((q) => (
            <Chip key={q} ativo={escolha.quem === q} onClick={() => muda({ quem: q })}>
              {(q === 'mandante' ? mandante : visitante) ?? (q === 'mandante' ? 'Mandante' : 'Visitante')}
            </Chip>
          ))}

          <SeletorDeMenu rotulo="Janela" resumo={`Últimos ${escolha.janela}`} largura="sm:w-[168px]">
            {JANELAS_OFERECIDAS.map((j) => (
              <DropdownMenuCheckboxItem
                key={j}
                checked={escolha.janela === j}
                onSelect={() => muda({ janela: j })}
                className={ITEM_SELETOR}
              >
                {`Últimos ${j}`}
              </DropdownMenuCheckboxItem>
            ))}
          </SeletorDeMenu>

          <SeletorDeMenu rotulo="Mando" resumo={mandoAtual} largura="sm:w-[212px]">
            {MANDOS.map((m) => (
              <DropdownMenuCheckboxItem
                key={m.valor}
                checked={escolha.mando === m.valor}
                onSelect={() => muda({ mando: m.valor })}
                className={ITEM_SELETOR}
              >
                {m.rotulo}
              </DropdownMenuCheckboxItem>
            ))}
          </SeletorDeMenu>
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
            {/* O número SEMPRE declara a base: existe premissa contando os
                últimos cinco contra a linha, e dois números da mesma forma só
                não se contradizem porque cada um diz de onde saiu. */}
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
        ) : ehQuadro ? (
          <div className="flex flex-col gap-4">
            {series.map((s) => (
              <div key={s.chave}>
                <div className="text-[11.5px] font-semibold text-ink truncate mb-2">{s.titulo}</div>
                <SerieResultados s={s} corPor={doMercado.metrica === 'ambos' ? 'valor' : 'resultado'} />
              </div>
            ))}
            <div className="text-[11px] leading-relaxed" style={{ color: '#8d8672' }}>{series[0].comoLer}</div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-start gap-1 mb-3 md:flex-row md:items-center md:gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COR_FAVOR }} />
                <span className="text-[10.5px] text-ink-2">acima da linha</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COR_CONTRA }} />
                <span className="text-[10.5px] text-ink-3">abaixo</span>
              </span>
              <span className="text-[10.5px]" style={{ color: '#8d8672' }}>A cor compara, não diz se foi bom.</span>
            </div>

            <BarrasEmSequencia
              series={series}
              teto={teto}
              piso={piso}
              comRotulo={comRotulo}
              comPlacar
              rotuloDentro
              referencia={referencia}
            />

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
