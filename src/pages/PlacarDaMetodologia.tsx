import { useState } from 'react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Seo } from '@/components/Seo';
import { CabecalhoDoPlacar } from '@/components/placar/CabecalhoDoPlacar';
import { FiltroDoPlacar } from '@/components/placar/FiltroDoPlacar';
import { Placar } from '@/components/placar/Placar';
import {
  avisosDoPeriodo,
  filtrarPeloEixo,
  periodoPadrao,
  type Eixo,
  type Periodo,
} from '@/components/placar/placar-periodo';
import { soAVitrine } from '@/components/placar/placar-vitrine';
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
  const [atalho, setAtalho] = useState('serie');
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoPadrao(hoje));
  const [eixo, setEixo] = useState<Eixo>('jogo');
  // O padrão é o board inteiro, ao contrário do script de terminal: a decisão
  // sobre um mercado oculto é uma das que esta tela sustenta.
  const [soVitrine, setSoVitrine] = useState(false);
  const { vitrine } = useVitrine();

  const estado = useOportunidadesPublicadas(periodo.de, periodo.ate);
  const noPeriodo =
    estado.tipo === 'pronto' ? filtrarPeloEixo(estado.publicadas, eixo, periodo) : [];
  const publicadas = soVitrine ? soAVitrine(noPeriodo, vitrine) : noPeriodo;

  const resumo =
    estado.tipo === 'pronto'
      ? `${publicadas.length} ${
          publicadas.length === 1 ? 'oportunidade publicada' : 'oportunidades publicadas'
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

        <div className="mx-auto max-w-6xl px-4 pt-6">
          <FiltroDoPlacar
            atalho={atalho}
            periodo={periodo}
            eixo={eixo}
            aoMudarPeriodo={(id, novo) => {
              setAtalho(id);
              setPeriodo(novo);
            }}
            aoMudarEixo={setEixo}
            soVitrine={soVitrine}
            aoMudarVitrine={setSoVitrine}
          />
        </div>

        {estado.tipo === 'pronto' ? (
          <Placar
            publicadas={publicadas}
            avisos={avisosDoPeriodo(periodo, eixo)}
            ocultos={vitrine}
            foraDaVitrine={noPeriodo.length - publicadas.length}
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
