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

/**
 * Os nomes dos parâmetros, compartilhados entre quem escreve (aqui) e quem lê
 * (a tela do jogo).
 *
 * Existem como constante, e não como literais dos dois lados, porque renomear
 * um deles numa ponta só deixa o link **válido** e o filtro **morto**, sem erro
 * nenhum: a tela procura um parâmetro que ninguém manda, não acha, e cai no
 * desempate padrão. É o defeito que esta issue conserta, e ele voltaria pela
 * porta dos fundos. Mesmo espírito da guarda de paridade da copy das premissas.
 */
export const PARAMS_DA_SAIDA = {
  mercado: 'mercado',
  saida: 'saida',
  linha: 'linha',
} as const;

/** O mínimo para identificar uma saída num jogo. */
export type SaidaClicavel = {
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
 * O id do jogo vem primeiro e é obrigatório: ele é o que sempre existe, e a
 * saída é o que pode faltar. Na ordem inversa a função precisava de um segundo
 * parâmetro de reserva e de um `throw` quando nenhum dos dois vinha — derrubar
 * a árvore de render dentro de uma lista por falta de dado é desproporcional,
 * ainda mais numa função que já degrada com elegância quando falta a saída.
 *
 * Sem mercado ou sem saída, devolve a tela sem filtro em vez de um filtro pela
 * metade: o trilho da agenda mostra jogo, não oportunidade, e nem todo jogo tem
 * leitura com preço.
 *
 * ⚠️ `market` e `outcome` aceitam nulo apesar de `FutebolValueBoardRow` declarar
 * os dois como `string`. Não é frouxidão: `oppFromAlerted` monta `OppLike` com
 * `market: a.market!`, e o `!` mente — `FutebolAlertedPick.market` é
 * `string | null` ("null nas linhas antigas sem pick estruturado"). Um registro
 * antigo chega aqui com nulo e o tipo declarado não avisa. A versão anterior
 * desta montagem, dentro de Oportunidades, produzia `mercado=null` na URL
 * nesses casos.
 *
 * Filtro que não casa também não quebra do outro lado: `saidaComPreco` cai no
 * desempate normal quando não encontra a saída pedida.
 */
export function hrefDaSaida(fixtureId: number, saida?: SaidaClicavel | null): string {
  if (!saida?.market || !saida?.outcome) return hrefDoJogo(fixtureId);

  const q = new URLSearchParams({
    [PARAMS_DA_SAIDA.mercado]: saida.market,
    [PARAMS_DA_SAIDA.saida]: saida.outcome,
  });
  // `!= null`, e não um teste de verdade: handicap 0 é uma linha de verdade, e
  // um `if (line_value)` a apagaria. Mercado sem linha (1x2, ambos marcam) manda
  // o parâmetro ausente, porque `linha=null` faria a tela procurar uma saída com
  // linha nula literal e não achar nenhuma.
  if (saida.line_value != null) q.set(PARAMS_DA_SAIDA.linha, String(saida.line_value));
  return `${hrefDoJogo(fixtureId)}?${q}`;
}
