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
} from '@/utils/futebol-estatisticas-da-partida';
import { cabeRotulo, pisoDaEscala, tetoDaEscala } from '@/utils/futebol-grafico-de-barras';
import { exato } from '@/utils/futebol-criterio';
import { Chip } from './Chip';
import { ITEM_SELETOR, SeletorDeMenu } from './SeletorDeMenu';
import { ReguaDeLinhas } from './ReguaDeLinhas';
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
 */

const LABEL = 'text-[10px] uppercase tracking-[0.14em] font-bold text-ink-3 shrink-0';

/**
 * A altura da área de desenho nesta aba.
 *
 * O padrão do desenhista são 96px, que nasceram para o gráfico embaixo de uma
 * premissa — ali ele divide o card com texto, corte e prestação de contas. Numa
 * aba dedicada isso deixa a barra achatada, e barra achatada não deixa comparar
 * altura, que é a única coisa que ela sabe fazer.
 */
const ALTURA_DO_GRAFICO = 180;

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
    const { paradas, padrao } = MERCADOS_NO_GRAFICO[mercado];
    const linha = linhaInicial != null && paradas.includes(linhaInicial) ? linhaInicial : padrao;
    return { ...ESCOLHA_PADRAO, mercado, linha };
  });

  const doMercado = MERCADOS_NO_GRAFICO[escolha.mercado];
  const { series, contagem, referencia, temLinha } = graficoDaEstatistica(escolha, historico);
  const teto = tetoDaEscala(series, referencia ?? undefined);
  const piso = pisoDaEscala(series);
  const comRotulo = cabeRotulo(series);
  /** Mercado binário não tem grandeza: vira quadro de jogo, não barra. */
  const ehQuadro = doMercado.metrica === 'resultado' || doMercado.metrica === 'ambos';

  const nomeDoLado = (lado: 'home' | 'away') => historico?.find((r) => r.side === lado)?.team_name ?? null;

  const muda = (parte: Partial<EscolhaDaEstatistica>) => setEscolha((atual) => ({ ...atual, ...parte }));

  /**
   * Trocar de mercado pode trocar a GRANDEZA, e aí a linha antiga não vale.
   *
   * ⚠️ Não basta perguntar se o número existe nas paradas do novo mercado: 2,5 é
   * parada em Gols e nos de saldo, mas em Gols é "dois gols e meio na partida" e
   * no saldo é "vencer por três". Mesmo número, grandezas diferentes.
   */
  const trocaMercado = (slug: MercadoDoGrafico) => {
    const destino = MERCADOS_NO_GRAFICO[slug];
    setEscolha((atual) => {
      const mesmaGrandeza = MERCADOS_NO_GRAFICO[atual.mercado].metrica === destino.metrica;
      const mantem = mesmaGrandeza && atual.linha != null && destino.paradas.includes(atual.linha);
      return { ...atual, mercado: slug, linha: mantem ? atual.linha : destino.padrao };
    });
  };

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
        {/* ⚠️ UMA linguagem de controle só. O mercado já foi barra de abas aqui,
            copiada da barra da página — que usa raio e borda cravados na mão, e
            não os tokens do rebrand. Além de fora do sistema, punha TRÊS
            gramáticas no mesmo cabeçalho: aba, chip e seletor. Agora mercado e
            time são chips; a hierarquia vem do rótulo e da ordem, não de widgets
            diferentes. */}
        {/* ⚠️ UMA linha de filtro só, e SEM seletor de time: os dois times estão
            sempre na tela. O seletor existiu e saiu — num confronto, ver um time
            de cada vez obriga a lembrar do outro para comparar, que é
            exatamente o trabalho que a escala compartilhada faz de graça.
            O nome de cada time aparece sobre as barras dele, no gráfico. */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={LABEL}>Mercado</span>
          {(Object.keys(MERCADOS_NO_GRAFICO) as MercadoDoGrafico[]).map((slug) => (
            <Chip key={slug} ativo={escolha.mercado === slug} onClick={() => trocaMercado(slug)}>
              {MERCADOS_NO_GRAFICO[slug].chip}
            </Chip>
          ))}

          <SeletorDeMenu rotulo="Janela" resumo={`Últimos ${escolha.janela}`} largura="sm:w-[168px]">
            {JANELAS_OFERECIDAS.map((j) => (
              <DropdownMenuCheckboxItem key={j} checked={escolha.janela === j} onSelect={() => muda({ janela: j })} className={ITEM_SELETOR}>
                {`Últimos ${j}`}
              </DropdownMenuCheckboxItem>
            ))}
          </SeletorDeMenu>

          <SeletorDeMenu rotulo="Mando" resumo={mandoAtual} largura="sm:w-[212px]">
            {MANDOS.map((m) => (
              <DropdownMenuCheckboxItem key={m.valor} checked={escolha.mando === m.valor} onSelect={() => muda({ mando: m.valor })} className={ITEM_SELETOR}>
                {m.rotulo}
              </DropdownMenuCheckboxItem>
            ))}
          </SeletorDeMenu>
        </div>

        {/* ⚠️ Uma FAIXA, não um painel. Este controle já foi uma caixa creme mais
            alta que o próprio gráfico — o comando ocupando mais espaço que a
            coisa comandada. O valor também aparece grudado na linha, dentro do
            gráfico, então repeti-lo aqui em tamanho grande era dizer duas vezes. */}
        {temLinha && doMercado.paradas.length > 0 && (
          <div className="flex items-center gap-2.5 mb-3">
            <span className={LABEL}>Linha</span>
            <ReguaDeLinhas
              paradas={doMercado.paradas}
              valor={escolha.linha}
              onEscolher={(v) => muda({ linha: v })}
              rotulo={fmtLinha}
            />
            <span className="tabular-nums text-[13px] font-bold text-ink shrink-0">
              {escolha.linha == null ? '—' : fmtLinha(escolha.linha)}
            </span>
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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
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
              altura={ALTURA_DO_GRAFICO}
              comRotulo={comRotulo}
              comPlacar
              rotuloDentro
              referencia={referencia}
            />

            {/* O número SEMPRE declara a base: existe premissa contando os
                últimos cinco contra a linha, e dois números da mesma forma só
                não se contradizem porque cada um diz de onde saiu. */}
            {contagem && contagem.de > 0 && (
              <div className="text-[12px] text-ink-2 mt-3">
                <strong className="font-bold text-ink">{contagem.acima}</strong> dos {contagem.de} jogos dos dois
                times passaram de {fmtLinha(referencia as number)}.
                <span className="block text-[10.5px] text-ink-3 mt-0.5">
                  Janela: últimos {escolha.janela} de cada time
                  {escolha.mando === 'proprio' ? ', só com o mando deste confronto' : ''}.
                </span>
              </div>
            )}

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
