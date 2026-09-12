import { quebrar, liquidarTudo, totalDoPeriodo, type LinhaPublicada } from './placar-agregacao';
import { emN, epPct, roiPct, taxaPct } from './placar-formato';
import { rotuloDoMercado } from './placar-vocabulario';
import { TabelaDoPlacar } from './TabelaDoPlacar';

/** Um número do topo, com o que ele significa embaixo. */
function Numero({ valor, rotulo, tom }: { valor: string; rotulo: string; tom?: 'bom' | 'ruim' }) {
  return (
    <div className="rounded-rebrand-md border border-line-2 bg-white px-4 py-3">
      <p
        className={`font-display text-2xl font-black tabular-nums ${
          tom === 'bom' ? 'text-forest' : tom === 'ruim' ? 'text-red-600' : 'text-ink'
        }`}
      >
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
export function Placar({ publicadas }: { publicadas: LinhaPublicada[] }) {
  const total = totalDoPeriodo(publicadas);
  const { liquidadas } = liquidarTudo(publicadas);
  const porMercado = quebrar(liquidadas, (l) => l.market);

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

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Numero valor={String(total.publicadas)} rotulo="Publicadas" />
        <Numero valor={String(total.n)} rotulo="Liquidadas" />
        <Numero valor={String(total.pendentes)} rotulo="Pendentes" />
        <Numero
          valor={taxaPct(total.taxa)}
          rotulo={`Acerto ${emN(total.n - total.anuladas)}`}
        />
        <Numero
          valor={roiPct(total.roi)}
          rotulo={`ROI ± ${epPct(total.ep)} ${emN(total.n)}`}
          tom={total.roi > 0 ? 'bom' : total.roi < 0 ? 'ruim' : undefined}
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

      <TabelaDoPlacar
        titulo="Por mercado"
        explicacao="Onde a metodologia está ganhando e onde está perdendo. Acerto alto com ROI negativo é mercado de odd curta; o contrário é mercado que paga bem e erra muito."
        celulas={porMercado}
        rotulo={rotuloDoMercado}
      />
    </div>
  );
}
