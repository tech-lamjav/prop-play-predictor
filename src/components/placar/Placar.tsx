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
import type { GavetaAberta, Granularidade } from './placar-evolucao';
import { porLadoDoMercado } from './placar-por-premissa';
import { PremissasDoLado } from './PremissasDoLado';
import { QUEBRAS, celulasDa, type Quebra } from './placar-quebras';
import type { Eixo, Periodo } from './placar-periodo';
import { seloDeOculto, type MercadoOculto } from './placar-vitrine';
import { TabelaComparada } from './TabelaComparada';
import { QuebrasNoCelular } from './QuebrasNoCelular';
import { useIsMobile } from '@/hooks/use-mobile';
/** Um número do topo, com o que ele significa embaixo. */
function Numero({ valor, rotulo, tom }: { valor: string; rotulo: string; tom?: string }) {
  return (
    <div className="rounded-rebrand-md border border-line-2 bg-white px-4 py-3">
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
 * O topo no celular: um número em destaque, e o resto numa frase.
 *
 * Em duas colunas, os seis cartões do desktop viravam três fileiras e o ROI caía
 * na terceira. Aqui ele é O número da tela; o acerto vem logo embaixo, e
 * publicadas, liquidadas, pendentes e anuladas — que são contexto, não resposta —
 * viram uma linha.
 */
function NumerosNoCelular({
  total,
  simulando,
}: {
  total: ReturnType<typeof totalDe>;
  simulando: boolean;
}) {
  return (
    <div className="mb-6 rounded-rebrand-md border border-line-2 bg-white px-4 py-4">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-dim">
        ROI do período
      </p>
      <p className={`mt-1 font-display text-[48px] font-black leading-none ${tomDoRoi(total.roi)}`}>
        {roiPct(total.roi)}
      </p>
      <p className="mt-1.5 text-[12px] text-ink-dim">
        ± {epPct(total.ep)}{' '}
        {simulando ? `em ${String(total.unidades).replace('.', ',')}u` : emN(total.n)}
      </p>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2 border-t border-line-2 pt-3">
        <span className="font-display text-[22px] font-black leading-none text-ink">
          {taxaPct(total.taxa)}
        </span>
        <span className="text-[12px] text-ink-dim">
          de acerto · {total.acertos} {emN(total.n - total.anuladas)}
        </span>
      </p>
      <p className="mt-2 text-[12px] text-ink-2">
        {total.publicadas} publicadas · {total.n + total.foraDaSimulacao} liquidadas · {total.pendentes} pendentes ·{' '}
        {total.anuladas} anuladas
      </p>
    </div>
  );
}

/** O que a seção de premissas precisa dizer antes da primeira lista. */
const COMO_LER_AS_PREMISSAS =
  'Sempre dentro do lado do mercado, porque o ROI do lado é a linha de base. A coluna que decide é a diferença entre acesa e apagada. A flag vem recalculada do mart, então mudar o critério de uma premissa reescreve o passado — e o quanto ela acendeu, o insumo, ainda não chega neste banco.';

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
  gaveta,
  aoAbrirGaveta,
  aoFecharGaveta,
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
  /**
   * A gaveta aberta por um clique numa barra, quando há uma.
   *
   * Chega de fora já aplicada: as publicadas que entram aqui são as dela. Quem
   * é dono da janela é a página, que também soma o resumo do cabeçalho e
   * escolhe os avisos — se a gaveta morasse aqui, aqueles dois continuariam
   * falando do período inteiro em cima de uma tela que não é mais dele.
   */
  gaveta: GavetaAberta | null;
  aoAbrirGaveta: (chave: string, de: Granularidade) => void;
  aoFecharGaveta: () => void;
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
  const noCelular = useIsMobile();

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

      {/* A gaveta aberta é dita ANTES do primeiro número, e não só no cabeçalho
          do gráfico: quem rola até os cartões precisa saber de que janela eles
          são sem ter de subir para conferir. */}
      {gaveta && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-rebrand-md border border-forest bg-forest/[0.06] px-4 py-3 text-[13px] text-ink">
          <span>
            Aberto em <strong>{gaveta.rotulo}</strong>. Tudo nesta tela — os números do topo, o
            gráfico, as quebras e as premissas — conta só essa janela.
          </span>
          <button
            type="button"
            onClick={aoFecharGaveta}
            className="ml-auto shrink-0 rounded-rebrand-sm border border-forest px-2.5 py-1 text-[12px] font-bold text-forest transition hover:bg-forest hover:text-white"
          >
            Ver o período inteiro
          </button>
        </div>
      )}

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
      {noCelular ? (
        <NumerosNoCelular total={total} simulando={simulando} />
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Numero valor={String(total.publicadas)} rotulo="Publicadas" />
          {/* Liquidar é o jogo, não a aposta: a linha que a simulação mandou não
            apostar também liquidou. Sem somá-la, abrir a tela simulando
            encolhia este número calado. */}
        <Numero valor={String(total.n + total.foraDaSimulacao)} rotulo="Liquidadas" />
          <Numero valor={String(total.pendentes)} rotulo="Pendentes" />
          <Numero valor={String(total.anuladas)} rotulo="Anuladas" />
          <Numero
            valor={taxaPct(total.taxa)}
            rotulo={`Acerto: ${total.acertos} ${emN(total.n - total.anuladas)}`}
          />
          <Numero
            valor={roiPct(total.roi)}
            rotulo={`ROI ± ${epPct(total.ep)} ${simulando ? `em ${String(total.unidades).replace('.', ',')}u` : emN(total.n)}`}
            tom={tomDoRoi(total.roi)}
          />
        </div>
      )}

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
          gaveta={gaveta}
          aoAbrirGaveta={aoAbrirGaveta}
          aoFecharGaveta={aoFecharGaveta}
          comparando={comparacao !== undefined}
        />
      </div>

      {noCelular ? (
        <QuebrasNoCelular
          liquidadas={liquidadas}
          granularidade={granularidade}
          eixo={eixo}
          ocultos={ocultos}
          comparacao={
            comparacao
              ? {
                  liquidadasB,
                  rotuloDeA: comparacao.rotuloDeA,
                  rotuloDeB: comparacao.rotuloDeB,
                }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-5">{QUEBRAS.map(tabela)}</div>
      )}

      <div className="mt-8 border-t border-line-2 pt-6">
        <h2 className="font-display text-xl font-black text-ink">ROI por premissa</h2>
        {noCelular ? (
          <details className="mt-1 text-[13px] text-ink-2">
            <summary className="cursor-pointer font-bold text-ink-dim">Como ler</summary>
            <p className="mt-1">{COMO_LER_AS_PREMISSAS}</p>
          </details>
        ) : (
          <p className="mt-1 max-w-3xl text-[13px] text-ink-2">{COMO_LER_AS_PREMISSAS}</p>
        )}

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
