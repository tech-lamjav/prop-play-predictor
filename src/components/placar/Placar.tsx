import { liquidarTudo, totalDe, type LinhaPublicada } from './placar-agregacao';
import { emN, epPct, roiPct, taxaPct, tomDoRoi } from './placar-formato';
import { QUEBRAS, QUEBRAS_DE_PREMISSA, celulasDa, type Quebra } from './placar-quebras';
import { seloDeOculto, type MercadoOculto } from './placar-vitrine';
import { TabelaComparada } from './TabelaComparada';
import { TabelaDoPlacar } from './TabelaDoPlacar';
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
  foraDaEscala = 0,
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
   * Quantas oportunidades saíram por estarem na escala antiga do Score.
   *
   * Acontece no primeiro dia da série comparável: a virada do denominador entrou
   * às 14h35 UTC de 04/09, e as linhas da madrugada daquele dia têm nota na
   * régua velha. Elas saem para a série continuar comparável, e o número é dito
   * porque um recorte silencioso é o mesmo defeito de um denominador escondido.
   */
  foraDaEscala?: number;
  /**
   * O que o período escolhido exige dizer antes de o sócio ler a tabela.
   *
   * Vem de fora porque quem sabe o período é quem o escolheu. Fica acima dos
   * números de propósito: um aviso embaixo da tabela chega depois da conclusão.
   */
  avisos?: string[];
  /** O segundo período, quando o sócio está comparando. */
  comparacao?: {
    publicadas: LinhaPublicada[];
    rotuloDeA: string;
    rotuloDeB: string;
  };
}) {
  const { liquidadas, pendentes } = liquidarTudo(publicadas);
  const total = totalDe(liquidadas, pendentes);
  const liquidadasB = comparacao ? liquidarTudo(comparacao.publicadas).liquidadas : [];

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
      <TabelaDoPlacar
        key={quebra.titulo}
        quebra={quebra}
        celulas={celulasDa(quebra, liquidadas)}
        selo={selo}
      />
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <p className="mb-4 max-w-3xl text-[14px] text-ink-2">
        Cada oportunidade vale <strong className="text-ink">uma unidade</strong>, medida pela odd,
        pela nota e pela faixa com que ela foi publicada — a foto de nascimento, e não o estado dela
        no apito, que é o que o assinante vê no histórico dele.
      </p>
      <p className="mb-6 max-w-3xl text-[14px] text-ink-2">
        Só entra aqui o que foi <strong className="text-ink">publicado</strong>. A candidata que o
        funil recusou vive no BigQuery e o site não a alcança, então esta tela não responde se o
        corte está apertado demais nem se falta premissa.
      </p>

      {avisos.map((aviso) => (
        <p
          key={aviso.slice(0, 40)}
          className="mb-4 max-w-3xl rounded-rebrand-md border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900"
        >
          <strong>Atenção:</strong> {aviso}
        </p>
      ))}

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
        />
        <Numero
          valor={roiPct(total.roi)}
          rotulo={`ROI ± ${epPct(total.ep)} ${emN(total.n)}`}
          tom={tomDoRoi(total.roi)}
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

      {foraDaEscala > 0 && (
        <p className="mb-6 text-[13px] text-ink-2">
          {foraDaEscala === 1
            ? 'Uma oportunidade ficou de fora'
            : `${foraDaEscala} oportunidades ficaram de fora`}{' '}
          por terem nascido antes das 14h35 UTC de 04/09, com a nota na escala antiga do Score.
          Mantê-las faria a série comparável misturar duas réguas.
        </p>
      )}

      <div className="grid gap-5">{QUEBRAS.map(tabela)}</div>

      <div className="mt-8 border-t border-line-2 pt-6">
        <h2 className="font-display text-xl font-black text-ink">O que dá para dizer de premissa</h2>
        <p className="mt-2 max-w-3xl text-[14px] text-ink-2">
          <strong className="text-ink">Isto não é ROI por premissa.</strong> Quais premissas
          acenderam em cada linha não está guardado: o histórico tem a soma dos pesos, não a lista. A
          evidência que a tela do jogo mostra para uma linha antiga é reconstruída com as flags de
          HOJE, então ela não serve para medir o passado. Responder &quot;quando a premissa X
          acendeu, qual foi o ROI&quot; exige guardar as premissas acesas no momento da publicação, e
          isso é trabalho no mart.
        </p>
        <p className="mt-2 max-w-3xl text-[14px] text-ink-2">
          O que está abaixo são as aproximações que existem com fidelidade histórica.
        </p>

        <div className="mt-5 grid gap-5">{QUEBRAS_DE_PREMISSA.map(tabela)}</div>
      </div>
    </div>
  );
}
