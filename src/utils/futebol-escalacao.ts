// ============================================================
// futebol-escalacao.ts — como a tela nomeia a escalação
// ============================================================
// A fonte NÃO publica escalação provável, em momento nenhum. O que existe são
// duas fases, e elas são coisas diferentes:
//
//   'confirmed' — a escalação anunciada, que sai perto de 1h antes do apito
//   'real'      — o registro de quem entrou em campo, montado depois do jogo
//
// A RPC devolve UMA fase por jogo (migration 098): prefere a confirmada e cai
// para a real quando não houver confirmada. A tela nunca recebe as duas
// misturadas, então aqui só decidimos como chamar o que chegou.
//
// Isto é apresentação. Nada aqui decide pontuação: o Score usa a escalação
// confirmada por correção — pontuar com a real seria decidir uma aposta
// pré-jogo com informação que só existe depois.
// ============================================================

/** Item que carrega a fase. Serve para as duas listas (times e jogadores). */
interface ComFase {
  lineup_phase?: string | null;
}

export interface RotuloEscalacao {
  titulo: string;
  subtitulo: string | null;
}

/**
 * Qual fase a tela recebeu, ou null se não veio escalação nenhuma.
 *
 * Lê primeiro a lista de JOGADORES, que é o conteúdo principal do card, e cai
 * para a de times. As duas são decididas em separado no banco e discordam entre
 * si — escalação confirmada existe em 4 jogos na tabela de times e em 137 na de
 * jogadores —, então a ordem de preferência precisa ser declarada em vez de
 * acontecer por acaso.
 */
export function faseDaEscalacao(
  times: ComFase[] | null | undefined,
  jogadores: ComFase[] | null | undefined,
): string | null {
  return primeiraFase(jogadores) ?? primeiraFase(times);
}

function primeiraFase(itens: ComFase[] | null | undefined): string | null {
  if (!itens?.length) return null;
  for (const item of itens) {
    const fase = item?.lineup_phase;
    if (fase) return fase;
  }
  return null;
}

/**
 * Título e subtítulo do card, a partir da fase e do estado do jogo.
 *
 * Fase desconhecida cai no caso sem escalação de propósito: se a fonte passar a
 * publicar uma terceira fase, é melhor a tela dizer que não sabe do que
 * apresentar um registro novo com o nome de um antigo.
 */
export function rotuloEscalacao(
  fase: string | null | undefined,
  jogoComecou: boolean,
): RotuloEscalacao {
  if (fase === 'confirmed') {
    return { titulo: 'Escalação confirmada', subtitulo: 'anunciada antes do jogo' };
  }
  if (fase === 'real') {
    return { titulo: 'Quem entrou em campo', subtitulo: 'registro do jogo' };
  }
  // Sem escalação. Só promete o horário quando ainda dá tempo de ela sair.
  return jogoComecou
    ? { titulo: 'Escalação não registrada', subtitulo: null }
    : { titulo: 'Escalação ainda não anunciada', subtitulo: 'costuma sair cerca de 1h antes' };
}
