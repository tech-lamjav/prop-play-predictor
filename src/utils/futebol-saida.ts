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
