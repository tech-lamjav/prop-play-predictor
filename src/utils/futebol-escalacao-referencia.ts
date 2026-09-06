// ============================================================
// futebol-escalacao-referencia.ts — o que preenche a espera pela escalação
// ============================================================
// A aba de Escalações ficava vazia justamente no jogo que ainda vai acontecer,
// que é o único em que o assinante aposta. Não é bug de tela: na nossa base a
// escalação só aparece a partir do apito. Medido em 06/09/2026 — os três jogos
// em andamento tinham escalação confirmada com 46 jogadores cada, e os três a
// começar, dois deles a meia hora do apito, tinham zero.
//
// Enquanto a coleta não roda antes do jogo, o lugar é preenchido pela escalação
// do ÚLTIMO jogo de cada time. É a melhor previsão honesta que temos: quem o
// time botou em campo da última vez.
//
// Honesto exige dizer o que é. A tela nomeia o jogo de origem e a data, porque
// isto NÃO é a escalação desta partida e confundir as duas seria a tela mentindo
// com cara de dado. E some assim que a de verdade chega.
//
// Nada disto encosta no Score: pontuação usa a escalação confirmada DESTE jogo,
// e nunca a de outro.
// ============================================================

import type { FutebolFormResult } from '@/services/futebol-data.service';

/** O jogo mais recente do histórico, ou null quando não há histórico. */
export function ultimoJogoDoTime(
  form: FutebolFormResult[] | null | undefined,
): FutebolFormResult | null {
  if (!form?.length) return null;

  // Ordena por data em vez de confiar na ordem da RPC. A ordem dela não é
  // contrato nosso, e pegar o primeiro da lista deixaria a tela mostrar uma
  // escalação de três jogos atrás sem nada acusando.
  return [...form].sort(
    (a, b) => new Date(b.date_utc).getTime() - new Date(a.date_utc).getTime(),
  )[0];
}

/**
 * Os jogadores de um time noutro jogo, reetiquetados para o lado que ele ocupa
 * NESTE jogo.
 *
 * A reetiquetagem é o ponto: o Botafogo pode ter jogado como visitante na rodada
 * passada e ser mandante agora. Sem trocar o lado, ele seria desenhado na metade
 * do adversário. A posição em si continua valendo, porque o `grid` da fonte é
 * relativo ao ataque do próprio time, e não à metade do campo.
 */
export function escalacaoDoTime<T extends { team_id: number; team_side: 'home' | 'away' }>(
  jogadores: T[] | null | undefined,
  teamId: number | null | undefined,
  lado: 'home' | 'away',
): T[] {
  if (!jogadores?.length || teamId == null) return [];
  return jogadores
    .filter((p) => p.team_id === teamId)
    .map((p) => ({ ...p, team_side: lado }));
}
