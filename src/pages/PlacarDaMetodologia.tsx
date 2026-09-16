import { useState } from 'react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Seo } from '@/components/Seo';
import { CabecalhoDoPlacar } from '@/components/placar/CabecalhoDoPlacar';
import { BarraDeFiltros } from '@/components/placar/BarraDeFiltros';
import { Placar } from '@/components/placar/Placar';
import {
  avisosDoPeriodo,
  filtrarPeloEixo,
  periodoPadrao,
  rotuloDoPeriodo,
  type Eixo,
  type Periodo,
} from '@/components/placar/placar-periodo';
import { PESO_DE_ABERTURA, type PesoPorFaixa } from '@/components/placar/placar-agregacao';
import {
  abrirGaveta,
  granularidadesDe,
  type GavetaAberta,
  type Granularidade,
} from '@/components/placar/placar-evolucao';
import { aplicarRecorte, SEM_RECORTE, type Recorte } from '@/components/placar/placar-filtros';
import { soAVitrine } from '@/components/placar/placar-vitrine';
import type { LinhaPublicada } from '@/components/placar/placar-agregacao';
import { useOportunidadesPublicadas } from '@/hooks/use-oportunidades-publicadas';
import { useVitrine } from '@/hooks/use-futebol-data';
import { brtToday } from '@/utils/futebol-datas';

/**
 * O placar da metodologia, o segundo andar da área de sócios.
 *
 * Abre na SÉRIE COMPARÁVEL: de 04/09/2026, quando o denominador do Score trocou,
 * até hoje. Antes dessa data a nota está em outra escala, e um padrão que
 * incluísse o período inteiro somaria duas réguas sem avisar.
 *
 * O dia entra por `brtToday()` e não por `new Date()` na tela: o produto conta
 * dia em Brasília, e em UTC um jogo de sábado à noite cairia no domingo.
 *
 * A consulta segue o período, e o eixo filtra o que veio: a RPC devolve o que
 * toca a janela pelos DOIS eixos, então quem escolheu o eixo tem de recortar.
 */
export default function PlacarDaMetodologia() {
  const hoje = brtToday();
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoPadrao(hoje));
  const [eixo, setEixo] = useState<Eixo>('jogo');
  // O padrão é o board inteiro, ao contrário do script de terminal: a decisão
  // sobre um mercado oculto é uma das que esta tela sustenta.
  const [soVitrine, setSoVitrine] = useState(false);
  const [periodoB, setPeriodoB] = useState<Periodo | null>(null);
  /**
   * O degrau do tempo, um para a tela toda.
   *
   * Nasce no mais largo que o período sustenta — mês quando há dois meses,
   * senão semana — porque a leitura começa no macro. O clique numa barra do
   * gráfico desce este degrau, e as colunas das matrizes descem com ele: a tela
   * inteira dá um passo para dentro, em vez de cada bloco ter o seu.
   */
  const [granularidade, setGranularidade] = useState<Granularidade>(
    () => granularidadesDe(periodoPadrao(hoje))[0],
  );
  const [recorte, setRecorte] = useState<Recorte>(SEM_RECORTE);
  const [pesos, setPesos] = useState<PesoPorFaixa>(PESO_DE_ABERTURA);
  /**
   * A gaveta que um clique numa barra do gráfico abriu.
   *
   * Mora aqui junto do período e do degrau porque ela É um período: o resumo do
   * cabeçalho, os avisos da janela e a conta do que ficou fora da vitrine saem
   * todos daqui. Enquanto foi estado de dentro do gráfico, abrir um dia mudava
   * só as barras, e a tela somava duas janelas ao mesmo tempo sem dizer qual
   * era qual.
   */
  const [gaveta, setGaveta] = useState<GavetaAberta | null>(null);
  const { vitrine, limiares } = useVitrine();

  /** A janela que a tela inteira está lendo: a da gaveta, quando há uma. */
  const janela = gaveta?.janela ?? periodo;

  /**
   * Fechar é sempre dois passos: devolver o degrau de onde a gaveta veio e
   * limpar o estado. Escrito uma vez porque três caminhos fecham — o botão do
   * gráfico, o da faixa, e trocar período ou eixo —, e um deles fazer só metade
   * deixava a tela no degrau de baixo sem gaveta nenhuma para explicar.
   */
  const fecharGaveta = () => {
    if (gaveta) setGranularidade(gaveta.volta);
    setGaveta(null);
  };

  /**
   * O que a RPC devolveu, recortado pelas três escolhas da tela.
   *
   * A ordem importa e é sempre esta: o EIXO primeiro, porque a RPC devolve o que
   * toca a janela pelos dois; depois o RECORTE de faixa e de valor que o sócio
   * escolheu; depois a VITRINE, se o sócio pediu a
   * leitura do produto. Escrito uma vez porque os dois períodos passam pelo
   * mesmo funil — e um deles tomar um caminho diferente seria uma comparação
   * entre coisas diferentes.
   */
  const recortar = (linhas: LinhaPublicada[], janela: Periodo) => {
    const noEixo = aplicarRecorte(filtrarPeloEixo(linhas, eixo, janela), recorte);
    const publicadas = soVitrine ? soAVitrine(noEixo, vitrine, Date.now(), limiares) : noEixo;
    return { publicadas, foraDaVitrine: noEixo.length - publicadas.length };
  };

  const estado = useOportunidadesPublicadas(periodo.de, periodo.ate);
  const a = recortar(estado.tipo === 'pronto' ? estado.publicadas : [], janela);

  // A segunda consulta só sai quando há comparação. Sem ela, fica desligada —
  // e não uma chamada com datas iguais, que parecia barata e rodava a consulta
  // inteira do placar de novo.
  const estadoB = useOportunidadesPublicadas(
    periodoB?.de ?? periodo.de,
    periodoB?.ate ?? periodo.de,
    periodoB !== null,
  );
  const publicadasB =
    periodoB && estadoB.tipo === 'pronto' ? recortar(estadoB.publicadas, periodoB).publicadas : [];

  const resumo =
    estado.tipo === 'pronto'
      ? `${a.publicadas.length} ${
          a.publicadas.length === 1 ? 'oportunidade publicada' : 'oportunidades publicadas'
        } no período`
      : estado.tipo === 'erro'
        ? 'placar indisponível'
        : 'carregando…';

  return (
    <>
      <Seo noindex title="Metodologia | Smart Betting" />
      <AnalyticsNav />

      <div className="theme-bolao min-h-screen bg-canvas text-ink">
        <CabecalhoDoPlacar resumo={resumo}>
          <BarraDeFiltros
          periodo={periodo}
          periodoB={periodoB}
          hoje={hoje}
          eixo={eixo}
          soVitrine={soVitrine}
          aoAplicarPeriodo={(novo, novoB) => {
            // A gaveta é um recorte de dentro da janela antiga: ela não
            // sobrevive a uma janela nova, nem a ligar a comparação.
            fecharGaveta();
            setPeriodo(novo);
            setPeriodoB(novoB);
          }}
          aoMudarEixo={(novo) => {
            fecharGaveta();
            setEixo(novo);
          }}
          aoMudarVitrine={setSoVitrine}
          recorte={recorte}
          pesos={pesos}
            aoMudarRecorte={setRecorte}
            aoMudarPesos={setPesos}
          />
        </CabecalhoDoPlacar>

        {estado.tipo === 'pronto' ? (
          <Placar
            publicadas={a.publicadas}
            periodo={periodo}
            eixo={eixo}
            granularidade={granularidade}
            aoMudarGranularidade={setGranularidade}
            gaveta={gaveta}
            aoAbrirGaveta={(chave, de) => {
              const aberta = abrirGaveta(chave, de);
              if (!aberta) return;
              setGaveta(aberta);
              setGranularidade(aberta.degrau);
            }}
            aoFecharGaveta={fecharGaveta}
            pesos={pesos}
            avisos={avisosDoPeriodo(janela, eixo)}
            ocultos={vitrine}
            foraDaVitrine={a.foraDaVitrine}
            comparacao={
              periodoB
                ? {
                    publicadas: publicadasB,
                    rotuloDeA: rotuloDoPeriodo(periodo),
                    rotuloDeB: rotuloDoPeriodo(periodoB),
                  }
                : undefined
            }
          />
        ) : (
          <div className="mx-auto max-w-6xl px-4 pb-10">
            <p className="text-[14px] text-ink-2">
              {estado.tipo === 'erro'
                ? 'Não deu para carregar as oportunidades publicadas. Uma tabela vazia diria que a metodologia não publicou nada, o que é diferente de não ter resposta.'
                : 'Carregando…'}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
