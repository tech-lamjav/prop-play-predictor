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
 * Quantos dias para trás vale perguntar.
 *
 * O atraso do espelho é de HORAS. O que continua preso depois de uma semana não
 * é espelho atrasado: é jogo que o coletor não acompanha, porque a competição
 * está desligada no `leagues_config` (issue #478), e para esse não existe placar
 * fresco em lugar nenhum. Perguntar por ele só engorda o parâmetro para sempre.
 */
export const JANELA_DO_FRESCO_DIAS = 7;

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
 * Sim quando o apito já passou, nenhum status diz que acabou, e o jogo é
 * recente. O relógio manda sobre o status porque o status atrasa — é a mesma
 * razão pela qual `hasKickoffPassed` existe.
 */
export function precisaDoFresco(
  status: string | null | undefined,
  kickoffUtc: string | null | undefined,
  agoraMs: number,
  janelaDias = JANELA_DO_FRESCO_DIAS,
): boolean {
  // "Acabou" é o mesmo "acabou" do resto do módulo: adiado e cancelado também
  // são fim de linha, mas não têm placar, e a RPC só devolve FT, AET e PEN.
  if (isFinished(status)) return false;
  if (!hasKickoffPassed(kickoffUtc, new Date(agoraMs))) return false;
  const kickoff = parseUtc(kickoffUtc);
  if (!kickoff) return false;
  return agoraMs - kickoff.getTime() <= janelaDias * 864e5;
}

/** Os ids a perguntar, sem repetir e em ordem estável (a chave da consulta é a lista). */
export function idsSemFecho(
  jogos: readonly JogoComPlacar[],
  agoraMs: number,
  janelaDias = JANELA_DO_FRESCO_DIAS,
): number[] {
  const ids = new Set<number>();
  for (const j of jogos) {
    if (!precisaDoFresco(j.status_short, j.kickoff_utc, agoraMs, janelaDias)) continue;
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
    if (!p || j.status_short === p.status_short) return j;
    mudou = true;
    return { ...j, status_short: p.status_short, goals_home: p.goals_home, goals_away: p.goals_away };
  });
  return mudou ? saida : (jogos as T[]);
}
