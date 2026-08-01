// ============================================================
// Provas da LP, todas com dado real do mart de futebol (schema `futebol` no
// Postgres de produção, espelho do BigQuery). Nada estimado, nada inventado.
//
// Consultado em 28/07/2026:
//   select count(*) from futebol.fact_fixtures                  -> 5949
//   select count(*) from futebol.dim_leagues                    -> 22
//   select count(*) from futebol.dim_teams                      -> 388
//   select count(*) from futebol.fact_value_opportunities_hist  -> 1347
//   select min(date_utc) from futebol.fact_fixtures             -> 2024-02-07
//
// Ao atualizar, mexa aqui e no rótulo de data. Número velho em página de venda
// é passivo, não é detalhe.
// ============================================================

export const PROVA_ATUALIZADA_EM = "julho de 2026";

// Tirado da página a pedido: a faixa de tração ("605 contas criadas",
// "1.978 apostas registradas") ficava embaixo dos depoimentos. Os números são
// reais e estão no banco de produção, se um dia voltarem:
//   select count(*) from public.users        -> 605 (o primeiro é de 2025-10-10)
//   select count(*) from public.bets         -> 1978

export const NUMEROS_PRODUTO = [
  { valor: "5.949", rotulo: "jogos analisados", nota: "desde fevereiro de 2024" },
  { valor: "22", rotulo: "campeonatos cobertos", nota: "Brasileirão, Série B, Copa e mais" },
  { valor: "1.347", rotulo: "oportunidades publicadas", nota: "com Score e o porquê" },
];

/**
 * Oportunidade real que a plataforma publicou e que já foi liquidada. Os campos
 * são exatamente os que estavam no mart no dia, incluindo o Score que o sistema
 * deu na época. Fonte: futebol.fact_value_opportunities_hist + fact_fixtures.
 *
 * Um exemplo não é média, e a gente não publica taxa de acerto. O rodapé do
 * bloco diz isso na cara, porque no mesmo recorte existem oportunidades de
 * Score alto que não bateram.
 */
export const BILHETE_REAL = {
  data: "10 de julho de 2026",
  competicao: "Copa do Mundo",
  casa: "Espanha",
  fora: "Bélgica",
  mercado: "Resultado do jogo",
  pick: "Espanha",
  score: 80,
  faixa: "Alta",
  chance: "60,1%",
  odd: "1.75",
  casaDeAposta: "Betano",
  nCasas: 14,
  placar: "2 x 1",
  resultado: "bateu" as const,
};
