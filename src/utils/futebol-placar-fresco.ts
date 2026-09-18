import type { FutebolPlacarFresco } from '@/services/futebol-data.service';
import { hasKickoffPassed, isFinished, parseUtc } from '@/utils/futebol-datas';

/**
 * O placar fresco: quando perguntar ao coletor, e como sobrepor.
 *
 * Existem duas fontes para o mesmo fato. `public.fixtures` é do COLETOR, que
 * pergunta o placar de 2 em 2 minutos enquanto o jogo rola. `futebol.fact_fixtures`
 * é o ESPELHO, carregado pelo pipeline de analytics, e é dele que todas as RPCs
 * do painel leem. Entre o jogo acabar de madrugada e o espelho recarregar, a
 * tela mostra um jogo encerrado como se estivesse em andamento — em 17/09 foram
 * 19 linhas assim, de dois jogos (migration 152, PR #472).
 *
 * A regra de QUEM perguntar mora aqui, e não em cada tela, porque ela já foi
 * escrita errado uma vez: a primeira versão pedia pelo calendário inteiro, que
 * traz a temporada de oito ligas, e arrastava todo jogo adiado desde janeiro.
 */


/**
 * ⚠️ NÃO EXISTE JANELA DE DIAS AQUI, E ISSO É DECISÃO.
 *
 * A primeira versão desta função tinha uma: sete dias para trás, com a
 * justificativa de que "o atraso do espelho é de horas, e o que segue preso
 * depois de uma semana é liga desligada no `leagues_config`". As duas metades
 * estavam erradas.
 *
 * A premissa morreu no mesmo dia: a issue #478 ligou as oito competições que o
 * painel publica, então jogo antigo preso em `2H` passou a ser exatamente o que
 * o coletor SABE responder.
 *
 * E o preço caía na tela que já funcionava. A lista de Oportunidades navega 30
 * dias para trás (`HISTORY_WINDOW_DAYS`); com a janela, o sócio que abrisse um
 * dia de duas semanas atrás via a aposta sem resultado PARA SEMPRE, porque
 * ninguém mais perguntava por aquele jogo.
 *
 * Quem limita o tamanho da pergunta é QUEM CHAMA, passando só o recorte que a
 * tela mostra — o dia da agenda, o dia da lista, o jogo aberto. Era isso que a
 * issue #479 pedia desde o começo, e a janela foi o atalho que tomou o lugar
 * disso. Passar o calendário inteiro aqui é o defeito; cortar por data não é o
 * conserto.
 */

export type JogoComPlacar = {
  fixture_id: number;
  status_short: string | null;
  goals_home: number | null;
  goals_away: number | null;
  kickoff_utc: string | null;
};

/**
 * Este jogo precisa do placar do coletor?
 *
 * Sim quando o apito já passou e nenhum status diz que acabou. O relógio manda
 * sobre o status porque o status atrasa — é a mesma razão pela qual
 * `hasKickoffPassed` existe.
 */
export function precisaDoFresco(
  status: string | null | undefined,
  kickoffUtc: string | null | undefined,
  agoraMs: number,
): boolean {
  // "Acabou" é o mesmo "acabou" do resto do módulo: adiado e cancelado também
  // são fim de linha, mas não têm placar, e a RPC só devolve FT, AET e PEN.
  if (isFinished(status)) return false;
  return hasKickoffPassed(kickoffUtc, new Date(agoraMs));
}

/** Os ids a perguntar, sem repetir e em ordem estável (a chave da consulta é a lista). */
export function idsSemFecho(
  jogos: readonly JogoComPlacar[],
  agoraMs: number,
): number[] {
  const ids = new Set<number>();
  for (const j of jogos) {
    if (!precisaDoFresco(j.status_short, j.kickoff_utc, agoraMs)) continue;
    ids.add(j.fixture_id);
  }
  return [...ids].sort((a, b) => a - b);
}

/**
 * Os mesmos jogos, com o placar do coletor sobreposto onde ele existe.
 *
 * ⚠️ STATUS E PLACAR ANDAM JUNTOS. Sobrepor só os gols deixaria a tela com um
 * jogo "em andamento" exibindo placar final — e, pior, com uma aposta que não
 * liquida, porque quem decide a liquidação é o status. Por isso o fresco entra
 * como bloco, e só existe para jogo encerrado COM placar nos dois lados (a RPC
 * não devolve outra coisa).
 *
 * Devolve o mesmo array quando não há o que sobrepor: a identidade importa para
 * os `useMemo` de quem chama.
 */
export function comPlacarFresco<T extends JogoComPlacar>(
  jogos: readonly T[],
  fresco: readonly FutebolPlacarFresco[] | undefined,
): T[] {
  if (!fresco?.length) return jogos as T[];
  const porId = new Map(fresco.map((p) => [p.fixture_id, p]));
  let mudou = false;
  const saida = jogos.map((j) => {
    const p = porId.get(j.fixture_id);
    if (!p) return j;
    // Compara os TRÊS campos, e não só o status.
    //
    // A primeira versão saía cedo quando os status batiam, e isso descartava
    // placar bom: o espelho pode chegar em `FT` com os gols ainda nulos (ele
    // carrega em duas etapas), e nesse instante os status são iguais e os
    // números não. O resultado era jogo encerrado exibindo "—" na tela, que é
    // o defeito que esta função existe para não deixar acontecer.
    if (
      j.status_short === p.status_short &&
      j.goals_home === p.goals_home &&
      j.goals_away === p.goals_away
    ) {
      return j;
    }
    mudou = true;
    return { ...j, status_short: p.status_short, goals_home: p.goals_home, goals_away: p.goals_away };
  });
  return mudou ? saida : (jogos as T[]);
}
