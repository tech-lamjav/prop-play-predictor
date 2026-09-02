/**
 * Os endereços do módulo de futebol, montados num lugar só (issue #344).
 *
 * A tela do jogo sempre soube ler `?mercado=&saida=&linha=` e abrir já na saída
 * clicada. Só a tela de Oportunidades sabia escrever isso — a home e o painel da
 * agenda mandavam a URL pelada, e a tela caía no desempate padrão: normalmente
 * gols, na primeira linha. A pessoa clicava num pick e chegava noutro.
 *
 * Montar a URL aqui é o que impede a próxima origem de esquecer o filtro de
 * novo, e mantém as duas pontas do contrato — quem escreve e quem lê — a uma
 * busca de distância uma da outra.
 */

/** O mínimo para identificar uma saída num jogo. */
export type SaidaClicavel = {
  fixture_id: number;
  market: string | null | undefined;
  outcome: string | null | undefined;
  line_value: number | null | undefined;
};

/** A tela do jogo, sem filtro nenhum. */
export function hrefDoJogo(fixtureId: number): string {
  return `/futebol/jogo/${fixtureId}`;
}

/**
 * A tela do jogo já na saída clicada.
 *
 * Sem mercado ou sem saída, devolve a tela sem filtro em vez de um filtro pela
 * metade: o trilho da agenda mostra jogo, não oportunidade, e nem todo jogo tem
 * leitura com preço. Abrir a tela inteira é honesto; inventar filtro não.
 *
 * Filtro que não casa também não quebra nada do outro lado — `saidaComPreco`
 * cai no desempate normal quando não encontra a saída pedida.
 */
export function hrefDaSaida(saida: SaidaClicavel | null | undefined, fixtureIdDeReserva?: number): string {
  const fixtureId = saida?.fixture_id ?? fixtureIdDeReserva;
  if (fixtureId == null) throw new Error('hrefDaSaida precisa de um fixture_id');
  if (!saida?.market || !saida?.outcome) return hrefDoJogo(fixtureId);

  const q = new URLSearchParams({ mercado: saida.market, saida: saida.outcome });
  // `!= null`, e não um teste de verdade: handicap 0 é uma linha de verdade, e
  // um `if (line_value)` a apagaria. Mercado sem linha (1x2, ambos marcam) manda
  // o parâmetro ausente, porque `linha=null` faria a tela procurar uma saída com
  // linha nula literal e não achar nenhuma.
  if (saida.line_value != null) q.set('linha', String(saida.line_value));
  return `${hrefDoJogo(fixtureId)}?${q}`;
}
