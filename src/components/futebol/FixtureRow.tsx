import { Crest } from './Crest';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { fmtTime, isFinished, isLive } from '@/utils/futebol-datas';
import { interceptarCliqueSimples } from '@/utils/navegacao-por-link';
import { chancePct, ehDestaque, ehFaixaAlta, marketShort, pickLabel } from '@/utils/futebol-score';
import { ValorBloqueado } from '@/components/futebol/FutebolGate';
import { linhaBloqueada } from '@/utils/futebol-bloqueio';
import { settleFutebol, isHit } from '@/utils/futebol-settlement';
import type { FutebolFixture, FutebolValueBoardRow } from '@/services/futebol-data.service';

/**
 * Uma linha de jogo na lista.
 *
 * Times EMPILHADOS (casa em cima, fora embaixo), não lado a lado. A versão lado a
 * lado dava dois nomes truncados a ~100px em tela de 375px, e "A. × R." não é jogo
 * nenhum. Empilhado, o nome ganha a largura inteira da linha e cabe em qualquer
 * viewport. É também o formato do SofaScore, inclusive no desktop.
 *
 * A LEITURA vive na própria linha (protótipo "Futebol Jogos"): mercado, pick, odd,
 * chance e o Score em selo. É o que deixa varrer o dia inteiro sem clicar em nada,
 * e sobra para o painel só a pergunta "por quê".
 *
 * Em jogo encerrado o vencedor fica em destaque e o perdedor recua, pra varredura
 * ficar mais rápida do que ler dois placares.
 *
 * O confronto nunca espera pela leitura: ele vem da agenda do dia e não depende
 * do board. Quem espera é só a coluna da direita e o selo — ver
 * `leituraCarregando`.
 */
export function FixtureRow({
  fixture,
  best,
  leituraCarregando,
  selected = false,
  to,
  onClick,
  aoClicar,
  locked = false,
}: {
  fixture: FutebolFixture;
  best: FutebolValueBoardRow | null;
  /**
   * O board ainda está em voo.
   *
   * "Sem leitura ainda" é uma conclusão, e só cabe depois que ele respondeu.
   * Sem isto a linha nasce negando: `best` chega nulo enquanto a consulta corre,
   * e a agenda inteira afirma um vazio que ela ainda não sabe se é verdade.
   *
   * Obrigatória de propósito: com valor padrão, um consumidor novo herda o bug
   * por esquecimento, e o compilador não avisa.
   */
  leituraCarregando: boolean;
  selected?: boolean;
  /**
   * Para onde o NAVEGADOR leva: a tela do jogo.
   *
   * O clique simples não chega lá — ele é interceptado e abre o painel lateral.
   * Mas o clique do meio, o Ctrl+clique e o «abrir em nova aba» do botão direito
   * escapam do intercepto e usam este destino. É o comportamento pedido na #341:
   * na aba nova o usuário quer o jogo inteiro, não a lista com o painel aberto.
   */
  to: string;
  /**
   * O que o clique SIMPLES faz, quando não é ir para `to`.
   *
   * Opcional de propósito. Sem ele, o `<Link>` navega sozinho e o clique simples
   * leva ao mesmo lugar que o clique do meio — que é o caso da maioria das
   * telas. Passá-lo apontando para o próprio `to` seria cancelar o link para
   * refazer à mão o que ele já faria.
   */
  onClick?: () => void;
  /**
   * Avisa que a linha foi clicada, em QUALQUER forma de clique.
   *
   * Separado do `onClick` de propósito, e a diferença importa. O `onClick` só
   * roda no clique simples — ele passa por `interceptarCliqueSimples`, que sai
   * do caminho no clique do meio e no Ctrl+clique para não matar a aba nova. E
   * há tela que nem passa `onClick` (a de campeonato, que não tem painel).
   *
   * Pendurar a telemetria no `onClick` perderia, então, todo abrir-em-nova-aba
   * e a tela de campeonato inteira — e o número sairia menor que a realidade
   * sem ninguém desconfiar, que é o pior tipo de erro de medição.
   */
  aoClicar?: () => void;
  /**
   * Sem acesso à camada de valor (nem assinatura, nem teste grátis vivo).
   *
   * Opcional e falso por padrão porque nem toda tela que desenha a linha tem o
   * acesso em mãos — mas onde ela mostra pick, odd e chance, tem de ter. Esta
   * linha era o furo: a agenda entregava de graça exatamente os três números
   * que a lista de Oportunidades borra.
   */
  locked?: boolean;
}) {
  const fim = isFinished(fixture.status_short);
  const live = isLive(fixture.status_short);
  /**
   * O apito já foi, esteja a bola rolando ou o jogo encerrado.
   *
   * A leitura da agenda separava só encerrado de não-encerrado, e o jogo ao
   * vivo caía no lado errado da conta: prometia odds futuras para uma partida
   * em andamento, três centímetros ao lado do próprio selo "Ao vivo".
   */
  const apitou = fim || live;
  const temPlacar = fim || live;
  const gh = fixture.goals_home;
  const ga = fixture.goals_away;
  const casaVenceu = fim && gh != null && ga != null && gh > ga;
  const foraVenceu = fim && gh != null && ga != null && ga > gh;

  const nomeCls = (venceu: boolean, perdeu: boolean) =>
    `truncate flex-1 min-w-0 text-[13px] tracking-tight ${
      venceu ? 'font-bold text-ink' : perdeu ? 'font-medium text-ink-3' : 'font-semibold text-ink'
    }`;
  const golCls = (venceu: boolean, perdeu: boolean) =>
    `w-5 shrink-0 text-right text-[13px] tabular-nums ${
      venceu ? 'font-bold text-ink' : perdeu ? 'font-medium text-ink-3' : 'font-semibold text-ink'
    }`;

  const alto = ehFaixaAlta(best?.faixa);
  const chance = best ? chancePct(best.prob_justa_fechamento) : null;
  // Jogo já encerrado fica aberto: o passado é registro do que foi publicado, não
  // pick para apostar. Mesma exceção da lista de Oportunidades.
  const borra = !!locked && !fim;
  // Duas portas para o mesmo cadeado, e as duas precisam existir. `borra` é o
  // que a TELA sabe (o acesso chegou pelo hook). `linhaBloqueada` é o que o
  // BANCO já decidiu: desde a guarda de acesso, a linha do board chega com as
  // colunas nulas, e sem este teste `best.best_odd.toFixed(2)` estoura antes de
  // qualquer condição da tela rodar.
  const bloqueado = borra || linhaBloqueada(best);

  // Jogo encerrado não precisa mais do Score, que é uma previsão: o que importa
  // ali é se a leitura bateu. O selo vira ✓ ou ✕ pelo placar.
  const liquidacao =
    fim && best ? settleFutebol(best, gh, ga) : null;
  const bateu = liquidacao != null ? isHit(liquidacao) : null;

  return (
    <Link
      to={to}
      onClick={(e) => {
        // A telemetria vem primeiro e sem condição: ela mede o CLIQUE, e o
        // clique já aconteceu, decida o intercepto o que decidir depois.
        aoClicar?.();
        if (onClick) interceptarCliqueSimples(onClick)(e);
      }}
      // O botão do MEIO não passa por `onClick`.
      //
      // O `click` do DOM cobre o botão esquerdo — com ou sem Ctrl, Shift, Alt —
      // mas o do meio dispara `auxclick`, um evento separado. Sem esta linha, o
      // "abrir em nova aba" com a rodinha, que é justamente o caminho que a
      // #341 preservou de propósito nesta linha, não seria medido: o número
      // sairia menor que a realidade e ninguém desconfiaria.
      //
      // Só a telemetria, e nada do intercepto: o clique do meio tem de
      // continuar abrindo a aba nova, que é o pedido explícito do usuário.
      onAuxClick={(e) => {
        if (e.button === 1) aoClicar?.();
      }}
      aria-current={selected ? 'true' : undefined}
      className="w-full text-left px-3 sm:px-4 py-2.5 flex items-center gap-2.5 sm:gap-3.5 transition"
      style={{
        borderTop: '1px solid #f1e9d6',
        background: selected ? '#fbfdfb' : undefined,
        boxShadow: selected ? 'inset 3px 0 0 #0a3d2e' : undefined,
      }}
    >
      <div className="w-10 sm:w-11 shrink-0 text-center">
        {live ? (
          <span className="text-[9px] uppercase tracking-[0.1em] font-bold text-status-danger">Ao vivo</span>
        ) : fim ? (
          <span className="text-[9px] uppercase tracking-[0.1em] font-bold" style={{ color: '#8d8672' }}>Fim</span>
        ) : (
          <span className="text-[12.5px] font-semibold tabular-nums text-ink">{fmtTime(fixture.kickoff_utc) || '—'}</span>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2 min-w-0">
          <Crest name={fixture.home_team_name} id={fixture.home_team_id} size={20} />
          <span className={nomeCls(casaVenceu, foraVenceu)}>{fixture.home_team_name}</span>
          {temPlacar && <span className={golCls(casaVenceu, foraVenceu)}>{gh ?? 0}</span>}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <Crest name={fixture.away_team_name} id={fixture.away_team_id} size={20} />
          <span className={nomeCls(foraVenceu, casaVenceu)}>{fixture.away_team_name}</span>
          {temPlacar && <span className={golCls(foraVenceu, casaVenceu)}>{ga ?? 0}</span>}
        </div>
      </div>

      {/* A leitura da linha, em três estados. Enquanto o board não respondeu, o
          esqueleto; com odds coletadas, o pick; sem elas, a frase em cinza em vez
          de um pick inventado. No celular cabem o pick e a odd, e o rótulo do
          mercado e a chance ficam para o desktop. */}
      {/* ⚠️ A ALTURA É RESERVADA AQUI, e não deixada por conta do esqueleto.
          Com 34 jogos numa tela, esta coluna é a maior fonte de instabilidade
          do produto: ela cresce quando a leitura chega, e cada linha empurra
          todas as de baixo.

          O comentário que morava embaixo dizia que as barras mantinham "a
          altura igual nos dois tamanhos". Não mantinham, e por uma distância
          grande — medido no navegador, com o board respondido:

            · celular: esqueleto 11px  →  carregado 34px   (+23 por linha)
            · desktop: esqueleto 40px  →  carregado 52px   (+12 por linha)

          No celular o engano era duplo: duas das três barras são `sm:block`, e
          o conteúdo carregado ali TAMBÉM tem duas linhas (aposta e odd), não
          uma. Sobrava uma barra de 11px no lugar de 34px de texto.

          O `min-h` resolve para TODOS os estados, e não só para o esqueleto: a
          linha bloqueada e a "sem leitura" são mais curtas que a leitura
          pronta, então reservar a maior delas impede qualquer um dos quatro
          casos de mexer na página. Os números vêm da medição acima. */}
      <div className="w-[96px] sm:w-[160px] shrink-0 text-right min-w-0 min-h-[34px] sm:min-h-[52px]">
        {leituraCarregando ? (
          // As barras espelham as linhas que vão chegar: no celular a aposta e
          // a odd; no desktop, o rótulo do mercado antes delas. As alturas e as
          // margens são as do texto real, medidas, para o esqueleto preencher o
          // espaço reservado em vez de flutuar dentro dele.
          <div data-testid="linha-leitura-carregando" aria-busy="true" className="flex flex-col items-end">
            <Skeleton className="hidden sm:block h-[14px] w-[52px] bg-canvas-2" />
            <Skeleton className="h-[17px] sm:h-[18px] sm:mt-0.5 w-[74px] bg-canvas-2" />
            <Skeleton className="h-[16px] sm:h-[17px] mt-px w-[56px] bg-canvas-2" />
          </div>
        ) : (
        <>
        <span className="hidden sm:block text-[9px] uppercase tracking-[0.14em] font-semibold" style={{ color: '#8d8672' }}>
          {best ? marketShort(best.market) : apitou ? 'sem leitura' : 'sem leitura ainda'}
        </span>
        {best && bloqueado ? (
          // A linha existe e não é entregue. Dizer "sem leitura" aqui seria
          // mentir sobre o dia: há leitura, ela é de assinante.
          <span className="inline-flex items-center text-[11px]" style={{ color: '#8d8672' }}>
            <ValorBloqueado rotulo="assinantes" />
          </span>
        ) : best ? (
          <>
            <span className="block sm:mt-0.5 text-[11.5px] sm:text-[12.5px] font-semibold text-ink truncate">
              {pickLabel(best, fixture.home_team_name, fixture.away_team_name)}
            </span>
            <span className="block mt-px text-[10.5px] sm:text-[11px] tabular-nums truncate" style={{ color: '#8d8672' }}>
              odd {best.best_odd.toFixed(2)}
              {chance != null ? <span className="hidden sm:inline">{` · ${chance}% chance`}</span> : null}
            </span>
          </>
        ) : (
          <span className="block sm:mt-0.5 text-[10.5px] sm:text-[11px] truncate" style={{ color: '#8d8672' }}>
            <span className="sm:hidden">sem leitura</span>
            {/* Depois do apito a agenda não sabe se houve leitura, só que não há
                mais: o board é point-in-time e o expurgo tira a linha no apito,
                então a agenda passa a ler um lugar onde o jogo já não está.

                As duas frases anteriores afirmavam mais do que isso. Em jogo AO
                VIVO dizia "odds entram perto do jogo", promessa de futuro com a
                bola rolando. Em jogo ENCERRADO dizia "não teve odds coletadas",
                e teve — o mesmo jogo aparecia no histórico com quatro
                oportunidades e odd em cada uma. Ambas reportadas no smoke test
                da virada (#309). */}
            <span className="hidden sm:inline">{apitou ? 'a leitura sai antes do apito' : 'odds entram perto do jogo'}</span>
          </span>
        )}
        </>
        )}
      </div>

      {leituraCarregando ? (
        // Mesmo tamanho do selo pronto: o travessão é a conclusão "não tem
        // Score" em forma de símbolo, e ela ainda não pode ser afirmada.
        <Skeleton
          data-testid="linha-selo-carregando"
          aria-busy="true"
          className="shrink-0 w-8 h-8 sm:w-[38px] sm:h-[38px] bg-canvas-2"
          style={{ borderRadius: 11 }}
        />
      ) : (
      <div
        className="shrink-0 grid place-items-center tabular-nums font-bold w-8 h-8 sm:w-[38px] sm:h-[38px] text-[13px] sm:text-[14px]"
        style={
          !best
            ? { borderRadius: 11, background: '#fdfbf6', border: '1px dashed #e5d9bd', color: '#c4bda8' }
            : bateu != null
              ? bateu
                ? { borderRadius: 11, background: '#dcefe2', border: '1px solid #a9d4bb', color: '#0a3d2e' }
                : { borderRadius: 11, background: '#fbeeec', border: '1px solid #f0c8c1', color: '#b8341c' }
              : alto
                ? { borderRadius: 11, background: '#0a3d2e', color: '#fff' }
                : ehDestaque(best.faixa)
                  ? { borderRadius: 11, background: '#fdf3d9', border: '1px solid #eccf85', color: '#b8870f' }
                  : { borderRadius: 11, background: '#f4eddc', color: '#8d8672' }
        }
        title={bateu != null ? (bateu ? 'a leitura bateu' : 'a leitura não bateu') : undefined}
      >
        {!best ? '—' : bateu != null ? (bateu ? '✓' : '✕') : best.score}
      </div>
      )}
    </Link>
  );
}
