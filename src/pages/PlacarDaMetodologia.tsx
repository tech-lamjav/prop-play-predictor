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
  recorteDaSerieComparavel,
  rotuloDoPeriodo,
  type Eixo,
  type Periodo,
} from '@/components/placar/placar-periodo';
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
  const { vitrine } = useVitrine();

  /**
   * O que a RPC devolveu, recortado pelas três escolhas da tela.
   *
   * A ordem importa e é sempre esta: o EIXO primeiro, porque a RPC devolve o que
   * toca a janela pelos dois; depois a ESCALA, que tira o que nasceu antes da
   * virada quando a janela é a comparável; depois a VITRINE, se o sócio pediu a
   * leitura do produto. Escrito uma vez porque os dois períodos passam pelo
   * mesmo funil — e um deles tomar um caminho diferente seria uma comparação
   * entre coisas diferentes.
   */
  const recortar = (linhas: LinhaPublicada[], janela: Periodo) => {
    const noEixo = filtrarPeloEixo(linhas, eixo, janela);
    const { linhas: naEscala, foraDaEscala } = recorteDaSerieComparavel(noEixo, janela);
    const publicadas = soVitrine ? soAVitrine(naEscala, vitrine) : naEscala;
    return { publicadas, foraDaEscala, foraDaVitrine: naEscala.length - publicadas.length };
  };

  const estado = useOportunidadesPublicadas(periodo.de, periodo.ate);
  const a = recortar(estado.tipo === 'pronto' ? estado.publicadas : [], periodo);

  // A segunda consulta só sai quando há comparação. As datas iguais fazem dela
  // uma chamada vazia e barata quando não há, sem um hook condicional.
  const estadoB = useOportunidadesPublicadas(
    periodoB?.de ?? periodo.de,
    periodoB?.ate ?? periodo.de,
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
        <CabecalhoDoPlacar resumo={resumo} />

        <BarraDeFiltros
          periodo={periodo}
          periodoB={periodoB}
          hoje={hoje}
          eixo={eixo}
          soVitrine={soVitrine}
          aoAplicarPeriodo={(novo, novoB) => {
            setPeriodo(novo);
            setPeriodoB(novoB);
          }}
          aoMudarEixo={setEixo}
          aoMudarVitrine={setSoVitrine}
        />

        {estado.tipo === 'pronto' ? (
          <Placar
            publicadas={a.publicadas}
            periodo={periodo}
            eixo={eixo}
            avisos={avisosDoPeriodo(periodo, eixo)}
            ocultos={vitrine}
            foraDaVitrine={a.foraDaVitrine}
            foraDaEscala={a.foraDaEscala}
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
