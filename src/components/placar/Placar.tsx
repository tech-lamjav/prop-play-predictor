import {
  FAIXAS_DE_ODD,
  FAIXAS_DO_SCORE,
  faixaDeOdd,
  faixaDoScore,
  liquidarTudo,
  quebrar,
  quebrarNaOrdem,
  totalDoPeriodo,
  type LinhaPublicada,
} from './placar-agregacao';
import { emN, epPct, roiPct, taxaPct } from './placar-formato';
import { rotuloDoMercado } from './placar-vocabulario';
import {
  FAIXAS_DE_PONTOS,
  FAIXAS_SEM_DADO,
  GRUPOS_DE_CORROBORACAO,
  GRUPOS_DE_PENALIDADE,
  faixaDePontos,
  faixaSemDado,
  grupoDeCorroboracao,
  grupoDePenalidade,
} from './placar-premissas';
import { seloDeOculto, type MercadoOculto } from './placar-vitrine';
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
export function Placar({
  publicadas,
  avisos = [],
  ocultos = [],
  foraDaVitrine = 0,
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
}) {
  const total = totalDoPeriodo(publicadas);
  const { liquidadas } = liquidarTudo(publicadas);
  const porMercado = quebrar(liquidadas, (l) => l.market);
  const porFaixaDeScore = quebrarNaOrdem(liquidadas, (l) => faixaDoScore(l.score), FAIXAS_DO_SCORE);
  const porFaixaDeOdd = quebrarNaOrdem(
    liquidadas,
    // A odd da publicação; a linha sem odd nunca chega aqui, porque sem preço
    // ela não liquida.
    (l) => faixaDeOdd(l.best_odd ?? 0),
    FAIXAS_DE_ODD,
  );
  const porCampeonato = quebrar(liquidadas, (l) => l.competition ?? 'Sem campeonato');
  const porPontos = quebrarNaOrdem(liquidadas, (l) => faixaDePontos(l.pts_premissas), FAIXAS_DE_PONTOS);
  const porSemDado = quebrarNaOrdem(liquidadas, (l) => faixaSemDado(l.premissas_sem_dado), FAIXAS_SEM_DADO);
  const porCorroboracao = quebrarNaOrdem(liquidadas, grupoDeCorroboracao, GRUPOS_DE_CORROBORACAO);
  const porPenalidade = quebrarNaOrdem(liquidadas, grupoDePenalidade, GRUPOS_DE_PENALIDADE);

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

      {foraDaVitrine > 0 && (
        <p className="mb-6 text-[13px] text-ink-2">
          A conta está restrita à <strong className="text-ink">vitrine</strong>:{' '}
          {foraDaVitrine === 1
            ? 'uma oportunidade ficou de fora'
            : `${foraDaVitrine} oportunidades ficaram de fora`}{' '}
          porque o assinante não as viu. Esta é a leitura do produto; a do board inteiro é a outra.
        </p>
      )}

      <div className="grid gap-5">
        <TabelaDoPlacar
          titulo="Por mercado"
          explicacao="Onde a metodologia está ganhando e onde está perdendo. Acerto alto com ROI negativo é mercado de odd curta; o contrário é mercado que paga bem e erra muito."
          celulas={porMercado}
          rotulo={rotuloDoMercado}
          marca={(slug) => seloDeOculto(slug, ocultos)}
        />

        <TabelaDoPlacar
          titulo="Por faixa de Score"
          explicacao="A promessa central do método: nota maior deveria render mais. Se a coluna de ROI não sobe com a faixa, a nota não está ordenando o resultado — e é a diferença entre faixas, não o número de uma delas, que responde isso."
          celulas={porFaixaDeScore}
        />

        <TabelaDoPlacar
          titulo="Por faixa de odd"
          explicacao="Odd curta e odd longa não se comportam igual, e a porta de odd por mercado foi desenhada supondo isso. Aqui é onde a suposição aparece medida."
          celulas={porFaixaDeOdd}
        />

        <TabelaDoPlacar
          titulo="Por campeonato"
          explicacao="Da base maior para a menor, porque é o tamanho da base que diz se vale comparar. Campeonato de mata-mata degrada as premissas, e esta é a tabela onde isso aparece."
          celulas={porCampeonato}
        />
      </div>

      <div className="mt-8 border-t border-line-2 pt-6">
        <h2 className="font-display text-xl font-black text-ink">O que dá para dizer de premissa</h2>
        <p className="mt-2 max-w-3xl text-[14px] text-ink-2">
          <strong className="text-ink">Isto não é ROI por premissa.</strong> Quais premissas
          acenderam em cada linha não está guardado: o histórico tem a soma dos pesos, não a lista.
          A evidência que a tela do jogo mostra para uma linha antiga é reconstruída com as flags de
          HOJE, então ela não serve para medir o passado. Responder &quot;quando a premissa X
          acendeu, qual foi o ROI&quot; exige guardar as premissas acesas no momento da publicação,
          e isso é trabalho no mart.
        </p>
        <p className="mt-2 max-w-3xl text-[14px] text-ink-2">
          O que está abaixo são as aproximações que existem com fidelidade histórica.
        </p>

        <div className="mt-5 grid gap-5">
          <TabelaDoPlacar
            titulo="Por pontos de premissa"
            explicacao="A soma dos pesos que acenderam. Serve para ver se mais evidência rende mais — mas o teto de pontos é diferente por mercado (30 no Resultado, 40 em Gols), então a mesma faixa não significa a mesma coisa nos dois."
            celulas={porPontos}
          />

          <TabelaDoPlacar
            titulo="Por premissas sem dado"
            explicacao="Quantas premissas não puderam ser avaliadas por falta de dado. Se publicar com evidência faltando sai caro, é aqui que aparece."
            celulas={porSemDado}
          />

          <TabelaDoPlacar
            titulo="Por corroboração de preço"
            explicacao="Os dois sinais que falam do preço, em grupos que não se sobrepõem: cada aposta entra em um só. O modelo da API vale zero ponto na nota desde a recalibragem, e esta tabela é onde isso se confirma ou não."
            celulas={porCorroboracao}
          />

          <TabelaDoPlacar
            titulo="Por penalidade aplicada"
            explicacao="A penalidade protege ou só corta aposta boa? Grupos exclusivos: aposta com duas flags entra em &quot;mais de uma&quot;, e não nas duas."
            celulas={porPenalidade}
          />
        </div>
      </div>
    </div>
  );
}
