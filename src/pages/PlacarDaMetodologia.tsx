import AnalyticsNav from '@/components/AnalyticsNav';
import { Seo } from '@/components/Seo';
import { CabecalhoDoPlacar } from '@/components/placar/CabecalhoDoPlacar';
import { Placar } from '@/components/placar/Placar';
import { INICIO_DA_SERIE_COMPARAVEL } from '@/components/placar/placar-vocabulario';
import { useOportunidadesPublicadas } from '@/hooks/use-oportunidades-publicadas';
import { brtToday } from '@/utils/futebol-datas';

/**
 * O placar da metodologia, o segundo andar da área de sócios.
 *
 * Abre na SÉRIE COMPARÁVEL: de 04/09/2026, quando o denominador do Score trocou,
 * até hoje. Antes dessa data a nota está em outra escala, e um padrão que
 * incluísse o período inteiro somaria duas escalas sem avisar.
 *
 * O dia entra por `brtToday()` e não por `new Date()` na tela: o produto conta
 * dia em Brasília, e em UTC um jogo de sábado à noite cairia no domingo.
 */
export default function PlacarDaMetodologia() {
  const hoje = brtToday();
  const estado = useOportunidadesPublicadas(INICIO_DA_SERIE_COMPARAVEL, hoje);

  const resumo =
    estado.tipo === 'pronto'
      ? `${estado.publicadas.length} ${
          estado.publicadas.length === 1 ? 'oportunidade publicada' : 'oportunidades publicadas'
        } desde 04/09`
      : estado.tipo === 'erro'
        ? 'placar indisponível'
        : 'carregando…';

  return (
    <>
      <Seo noindex title="Metodologia | Smart Betting" />
      <AnalyticsNav />

      <div className="theme-bolao min-h-screen bg-canvas text-ink">
        <CabecalhoDoPlacar resumo={resumo} />

        {estado.tipo === 'pronto' ? (
          <Placar publicadas={estado.publicadas} />
        ) : (
          <div className="mx-auto max-w-6xl px-4 py-10">
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
