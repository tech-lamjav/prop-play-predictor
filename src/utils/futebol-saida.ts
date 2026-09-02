/**
 * A SAÍDA de uma aposta: qual mercado, qual lado, e em que linha.
 *
 * Existe porque esses três andavam sempre juntos e sempre soltos, de função em
 * função (`outcomeLabel`, `pickLabel`, `settleFutebol`, `premissasDaSaida`,
 * `valueDoCandidato`). Nada impedia passar o mercado de uma aposta com a linha de
 * outra, e foi exatamente esse o bug do #264: o rótulo saía de uma saída e a
 * chance, a odd e o Score saíam de outra, dentro do mesmo card. Para o compilador
 * eram só duas strings e um número, então ele não tinha como reclamar.
 *
 * O campo se chama `line_value`, e não `line`, de propósito: é o nome que as duas
 * RPCs usam, então `FutebolFixturePremissas` e `FutebolFixtureValueRow` casam com
 * este tipo por estrutura. Na prática dá para passar A LINHA INTEIRA que veio do
 * banco, em vez de desmontá-la em três argumentos e arriscar remontar errado.
 */
export interface Saida {
  market: string;
  outcome: string;
  line_value: number | null;
}

/**
 * Linha na ótica do time escolhido. O banco normaliza o handicap pela ótica do
 * mandante; quem escolhe o visitante recebe o sinal oposto na tela.
 */
export function linhaDaSaida({ market, outcome, line_value }: Saida): number | null {
  if (market === 'asian_handicap' && outcome === 'Away' && line_value != null) return -line_value;
  return line_value;
}

/**
 * Mesma parada da régua?
 *
 * Compara com folga porque a linha vem em float e 3.25 do banco não é
 * necessariamente 3.25 do JavaScript.
 *
 * Mora aqui, no módulo da saída, e não em `futebol-leitura.ts`, porque
 * `futebol-premissas.ts` precisa dela e a leitura já importa das premissas —
 * importar de volta fecharia um ciclo.
 *
 * ⚠️ Existe uma segunda cópia privada em `futebol-cotacao.ts`, com tolerância
 * DIFERENTE (0.001 contra 0.011 daqui). Não foi unificada aqui de propósito:
 * mudar a tolerância de lá é mudança de comportamento num módulo que não é o
 * desta issue. Fica como dívida conhecida — duas comparações de float com
 * réguas diferentes é como se erra comparação de float.
 */
export function mesmaLinha(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.011;
}
