import {
  ehSimulacao,
  liquidarTudo,
  PESO_MEDIDO,
  totalDe,
  type LinhaPublicada,
  type PesoPorFaixa,
} from './placar-agregacao';
import { emN, epPct, roiPct, taxaPct, tomDoRoi } from './placar-formato';
import { EvolucaoDoRoi } from './EvolucaoDoRoi';
import { MatrizDoPlacar } from './MatrizDoPlacar';
import type { Granularidade } from './placar-evolucao';
import { porLadoDoMercado } from './placar-por-premissa';
import { PremissasDoLado } from './PremissasDoLado';
import { QUEBRAS, celulasDa, type Quebra } from './placar-quebras';
import type { Eixo, Periodo } from './placar-periodo';
import { seloDeOculto, type MercadoOculto } from './placar-vitrine';
import { TabelaComparada } from './TabelaComparada';
/**
 * Um número do topo, com o que ele significa embaixo.
 *
 * `ordem` existe por causa do celular: em duas colunas, os seis cartões viram
 * três fileiras, e ROI e acerto — que são a resposta — caíam na terceira. As
 * classes trocam a ORDEM VISUAL sem mexer na leitura do documento, que continua
 * indo do que foi publicado ao que ele rendeu.
 */
function Numero({
  valor,
  rotulo,
  tom,
  ordem,
}: {
  valor: string;
  rotulo: string;
  tom?: string;
  ordem?: string;
}) {
  return (
    <div className={`rounded-rebrand-md border border-line-2 bg-white px-4 py-3 ${ordem ?? ''}`}>
      <p className={`font-display text-2xl font-black tabular-nums ${tom ?? 'text-ink'}`}>
        {valor}
      </p>
      <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-dim">
        {rotulo}
      </p>
    </div>
  );
}

/**
 * O placar da metodologia.
 *
 * Recebe as oportunidades publicadas do período e liquida na hora, com a regra
 * do site (ADR 0002). Não busca nada: quem consulta é a página, e assim esta
 * tela é testável com uma lista na mão.
 *
 * As duas frases do topo não são enfeite. A primeira diz que o que está medido é
 * a FOTO DE NASCIMENTO, para ninguém comparar este número com o histórico do
 * assinante e concluir que um dos dois está errado. A segunda diz que a
 * candidata recusada pelo funil não está aqui — sem ela, o sócio olha a tabela e
 * conclui que o corte está certo, quando a tela nunca teve como saber.
 */
export function Placar({
  publicadas,
  avisos = [],
  ocultos = [],
  foraDaVitrine = 0,
  periodo,
  eixo,
  granularidade,
  aoMudarGranularidade,
  pesos = PESO_MEDIDO,
  comparacao,
}: {
  publicadas: LinhaPublicada[];
  /** Os mercados fora da vitrine hoje, para a tabela marcar quais são. */
  ocultos?: MercadoOculto[];
  /**
   * Quantas oportunidades ficaram de fora porque a conta foi restrita à vitrine.
   *
   * Zero quando a conta é do board inteiro, que é o padrão. Dizer o número é o
   * que impede a tela virar duas telas diferentes sem o sócio perceber qual
   * delas está lendo.
   */
  foraDaVitrine?: number;
  /**
   * O que o período escolhido exige dizer antes de o sócio ler a tabela.
   *
   * Vem de fora porque quem sabe o período é quem o escolheu. Fica acima dos
   * números de propósito: um aviso embaixo da tabela chega depois da conclusão.
   */
  avisos?: string[];
  /** A janela e o eixo, que o gráfico precisa para escolher a granularidade. */
  periodo: Periodo;
  eixo: Eixo;
  /** O degrau do tempo: as colunas das matrizes e as barras do gráfico. */
  granularidade: Granularidade;
  aoMudarGranularidade: (g: Granularidade) => void;
  /** Quanto apostar por faixa. Diferente de um em qualquer faixa vira simulação. */
  pesos?: PesoPorFaixa;
  /** O segundo período, quando o sócio está comparando. */
  comparacao?: {
    publicadas: LinhaPublicada[];
    rotuloDeA: string;
    rotuloDeB: string;
  };
}) {
  const { liquidadas, pendentes, foraDaSimulacao } = liquidarTudo(publicadas, pesos);
  const total = totalDe(liquidadas, pendentes, foraDaSimulacao);
  const liquidadasB = comparacao ? liquidarTudo(comparacao.publicadas, pesos).liquidadas : [];
  const simulando = ehSimulacao(pesos);
  const porPremissa = porLadoDoMercado(liquidadas);

  const tabela = (quebra: Quebra) => {
    const selo = quebra.marcaOculto
      ? (chave: string) => seloDeOculto(chave, ocultos)
      : undefined;

    return comparacao ? (
      <TabelaComparada
        key={quebra.titulo}
        quebra={quebra}
        a={celulasDa(quebra, liquidadas)}
        b={celulasDa(quebra, liquidadasB)}
        selo={selo}
        rotuloDeA={comparacao.rotuloDeA}
        rotuloDeB={comparacao.rotuloDeB}
      />
    ) : (
      // Sem comparação, o tempo vai para as colunas: a linha inteira conta se
      // caiu sempre ou caiu num dia, e a célula abre o que estava dentro dela.
      // Comparando, quem ocupa as colunas são os dois períodos, e aí a matriz
      // não cabe — duas matrizes lado a lado não se leem.
      <MatrizDoPlacar
        key={quebra.titulo}
        quebra={quebra}
        liquidadas={liquidadas}
        granularidade={granularidade}
        eixo={eixo}
        selo={selo}
      />
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Três frases que a tela não pode deixar de dizer, e que também não podem
          ocupar meia tela antes do primeiro número: elas moram atrás de um
          resumo, fechado por padrão. Quem lê o painel todo dia leu uma vez;
          quem chega hoje abre. */}
      <details className="mb-5 max-w-3xl text-[13px] text-ink-2">
        <summary className="cursor-pointer font-bold text-ink-2 hover:text-ink">
          Como este número é medido
        </summary>
        <p className="mt-2">
          Cada oportunidade vale <strong className="text-ink">uma unidade</strong>, medida pela odd,
          pela nota e pela faixa com que ela foi publicada — a foto de nascimento, e não o estado
          dela no apito, que é o que o assinante vê no histórico dele.
        </p>
        <p className="mt-2">
          Só entra aqui o que foi <strong className="text-ink">publicado</strong>. A candidata que o
          funil recusou vive no BigQuery e o site não a alcança, então esta tela não responde se o
          corte está apertado demais nem se falta premissa.
        </p>
        <p className="mt-2">
          Taxa de acerto não conta anulada no denominador; o ROI conta, com lucro zero. É por isso
          que os dois números têm bases diferentes.
        </p>
      </details>

      {avisos.map((aviso) => (
        <p
          key={aviso.slice(0, 40)}
          className="mb-4 max-w-3xl rounded-rebrand-md border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900"
        >
          <strong>Atenção:</strong> {aviso}
        </p>
      ))}

      {simulando && (
        <p className="mb-4 max-w-3xl rounded-rebrand-md border border-forest bg-forest/[0.06] px-4 py-3 text-[13px] text-ink">
          <strong>Simulação ligada.</strong> As unidades por faixa não são as medidas:{' '}
          {Object.entries(pesos)
            .map(([faixa, peso]) => `${faixa} ${String(peso).replace('.', ',')}u`)
            .join(' · ')}
          . O ROI abaixo é o que teria acontecido com esses tamanhos, sobre as mesmas apostas — e o
          erro-padrão passa a ser aproximado, porque ele é calculado por unidade e não ponderado.
          {total.foraDaSimulacao > 0 &&
            ` ${total.foraDaSimulacao} oportunidade(s) ficaram fora por peso zero.`}
        </p>
      )}

      {/* Os números do topo são sempre do período principal. Dois totais lado a
          lado brigariam com a tabela comparada, que é onde a comparação mora.

          Acertos e anuladas aparecem em número absoluto, e não só dentro da
          taxa: são eles que explicam por que a taxa e o ROI têm denominadores
          diferentes. */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Numero valor={String(total.publicadas)} rotulo="Publicadas" />
        <Numero valor={String(total.n)} rotulo="Liquidadas" />
        <Numero valor={String(total.pendentes)} rotulo="Pendentes" />
        <Numero valor={String(total.anuladas)} rotulo="Anuladas" />
        <Numero
          valor={taxaPct(total.taxa)}
          rotulo={`Acerto: ${total.acertos} ${emN(total.n - total.anuladas)}`}
          ordem="order-[-1] sm:order-none"
        />
        <Numero
          valor={roiPct(total.roi)}
          rotulo={`ROI ± ${epPct(total.ep)} ${simulando ? `em ${String(total.unidades).replace('.', ',')}u` : emN(total.n)}`}
          tom={tomDoRoi(total.roi)}
          ordem="order-[-2] sm:order-none"
        />
      </div>

      {total.pendentes > 0 && (
        <p className="mb-6 text-[13px] text-ink-2">
          {total.pendentes === 1
            ? 'Uma oportunidade ainda não liquidou'
            : `${total.pendentes} oportunidades ainda não liquidaram`}{' '}
          — jogo por acabar, jogo sem placar no fato, ou mercado que a regra de liquidação ainda não
          conhece. Nenhuma delas entra nas contas acima, e a conta muda quando elas liquidarem.
        </p>
      )}

      {foraDaVitrine > 0 && (
        <p className="mb-6 text-[13px] text-ink-2">
          A conta está restrita à <strong className="text-ink">vitrine</strong>:{' '}
          {foraDaVitrine === 1
            ? 'uma oportunidade ficou de fora'
            : `${foraDaVitrine} oportunidades ficaram de fora`}{' '}
          porque o assinante não as viu. Esta é a leitura do produto; a do board inteiro é a outra.
        </p>
      )}

      {/* O gráfico vem antes das tabelas: a primeira pergunta é se está
          melhorando, e só depois onde. Do macro para o micro. */}
      <div className="mb-5">
        <EvolucaoDoRoi
          liquidadas={liquidadas}
          periodo={periodo}
          eixo={eixo}
          granularidade={granularidade}
          aoMudarGranularidade={aoMudarGranularidade}
        />
      </div>

      <div className="grid gap-5">{QUEBRAS.map(tabela)}</div>

      <div className="mt-8 border-t border-line-2 pt-6">
        <h2 className="font-display text-xl font-black text-ink">ROI por premissa</h2>
        <p className="mt-1 max-w-3xl text-[13px] text-ink-2">
          Sempre dentro do lado do mercado, porque o ROI do lado é a linha de base. A coluna que
          decide é a diferença entre acesa e apagada. A flag vem recalculada do mart, então mudar o
          critério de uma premissa reescreve o passado — e o quanto ela acendeu, o insumo, ainda não
          chega neste banco.
        </p>

        <div className="mt-5 grid gap-5">
          {porPremissa.map((lado) => (
            <PremissasDoLado key={lado.chave} lado={lado} />
          ))}
          {porPremissa.length === 0 && (
            <p className="rounded-rebrand-md border border-line-2 bg-white px-5 py-8 text-[14px] text-ink-2">
              Nenhuma oportunidade liquidada no período.
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
