// ============================================================================
// futebol-grade-de-jogos.ts — quais jogos cabem na coluna da home
// ============================================================================
// A coluna da direita da home listava a agenda inteira. Num sábado isso são 33
// partidas empilhadas ao lado de quatro cards de oportunidade: a página ganhava
// uma rolagem que só existe de um lado, e o topo da lista ficava tomado pelos
// jogos das 8h da manhã — os que menos importam às 15h.
//
// A regra tem duas partes, e a segunda é o ponto:
//
//   1. cabe um número fixo de linhas, para a coluna terminar na mesma altura
//      das oportunidades ao lado;
//   2. jogo que já apitou SAI e um que ainda vai acontecer ENTRA no lugar.
//
// Sem a segunda, o limite pioraria o problema em vez de resolver: às 22h a
// coluna mostraria as nove primeiras partidas do dia, todas encerradas.
//
// O fim do dia é o caso que decide o desenho. Depois que o último jogo começa
// não há nada por vir, e uma lista vazia seria pior que uma lista velha — então
// ela completa com os que apitaram mais recentemente, que são justamente os que
// ainda estão em campo ou acabaram de sair dele.
// ============================================================================
import { parseUtc } from '@/utils/futebol-datas';

/**
 * Quantas linhas cabem na coluna.
 *
 * Nove porque é o que empata a altura com os quatro cards de oportunidade ao
 * lado — é medida de layout, não de conteúdo, e é por isso que mora aqui em vez
 * de virar parâmetro de tela.
 */
export const JOGOS_NA_GRADE = 9;

type ComHorario = { kickoff_utc?: string | null; date_utc?: string | null };

function inicioMs(jogo: ComHorario): number | null {
  return parseUtc(jogo.kickoff_utc || jogo.date_utc)?.getTime() ?? null;
}

/**
 * Os jogos do dia que ficam na coluna: primeiro os que ainda não começaram.
 *
 * Recebe a lista JÁ do dia selecionado e devolve no máximo `limite`, sempre em
 * ordem de horário. Jogo sem horário legível fica fora: ele não dá para situar
 * antes ou depois do apito, e é a única informação que a linha realmente usa.
 *
 * Num dia futuro nada começou, então isto devolve as primeiras `limite` — que é
 * exatamente o que se espera de uma agenda de amanhã.
 */
export function selecionarJogosDaGrade<T extends ComHorario>(
  jogosDoDia: readonly T[],
  agoraMs: number,
  limite: number = JOGOS_NA_GRADE,
): T[] {
  const comHorario = jogosDoDia
    .map((jogo) => ({ jogo, inicio: inicioMs(jogo) }))
    .filter((x): x is { jogo: T; inicio: number } => x.inicio != null)
    .sort((a, b) => a.inicio - b.inicio);

  const porVir = comHorario.filter((x) => x.inicio > agoraMs);
  const jaApitaram = comHorario.filter((x) => x.inicio <= agoraMs);

  // Completa do fim para o começo: os últimos a apitar são os que ainda estão em
  // campo. Pegar do começo encheria a coluna com o jogo das 8h da manhã.
  //
  // O ternário existe porque `slice(-0)` devolve o ARRAY INTEIRO, e não vazio:
  // sem ele, um dia cheio de jogos por vir traria junto todos os já encerrados,
  // que é o oposto do que a regra promete.
  const completar = Math.max(0, limite - porVir.length);
  const anteriores = completar > 0 ? jaApitaram.slice(-completar) : [];
  const escolhidos = [...anteriores, ...porVir].slice(0, limite);

  return escolhidos.sort((a, b) => a.inicio - b.inicio).map((x) => x.jogo);
}
