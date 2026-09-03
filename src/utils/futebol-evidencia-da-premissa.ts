import type { FutebolFixtureHistorico, FutebolFixtureNumeros } from '@/services/futebol-data.service';
import { evidenciaDe, type Evidencia } from '@/utils/futebol-evidencias';
import { evidenciaDoHistorico } from '@/utils/futebol-historico';
import { fraseDaPrestacao, prestacaoDaPremissa } from '@/utils/futebol-criterio';

// O número que acompanha uma premissa, de UMA fonte só (spec #349, issue #358).
//
// Três fontes existem, em ordem de proximidade com o critério:
//
//   1. a PRESTAÇÃO DE CONTAS — o insumo que o modelo comparou, medido na janela
//      da premissa, contra o corte real. É a única que reproduz o veredito.
//   2. o PERFIL DE TEMPORADA (RPC 094) — número verdadeiro, de outro recorte.
//      Sobra para as premissas cujo critério ainda não foi transcrito.
//   3. o HISTÓRICO jogo a jogo (RPC 095) — idem, para o que a 094 não cobre.
//
// Elas viviam encadeadas em cada tela, e cada tela encadeava de um jeito: a aba
// de motivos passava a linha, o resumo não, e o mapa nem chamava a primeira. O
// mesmo card mostrava 2,4 e o subtítulo 2,3 — dois números para a mesma
// afirmação. Aqui a ordem é uma, e quem muda de tela vê o mesmo número.
//
// ⚠️ A 094 e a 095 medem OUTRA COISA que não o insumo, e ficam só onde não há
// prestação. Quando a #352 render conserto para os outros mercados, cada critério
// transcrito remove um consumidor delas — e o objetivo é que a lista acabe.

export function evidenciaDaPremissa({
  mercado,
  slug,
  numeros,
  historico,
  lado,
  linha,
  acesa = true,
}: {
  mercado: string;
  slug: string;
  numeros: FutebolFixtureNumeros[] | undefined;
  historico: FutebolFixtureHistorico[] | undefined;
  lado: 'home' | 'away' | null;
  linha: number | null;
  /**
   * A premissa acendeu?
   *
   * Só a 094 usa: ela tem frases diferentes para o mesmo número conforme a
   * premissa tenha batido ou não. A prestação não precisa — o veredito dela sai
   * do próprio critério, e não de quem pergunta.
   */
  acesa?: boolean;
}): Evidencia | null {
  const p = prestacaoDaPremissa(mercado, slug, historico, lado, linha);
  if (p) return { texto: fraseDaPrestacao(p) };
  return (
    evidenciaDe(slug, numeros, lado, acesa, linha) ??
    evidenciaDoHistorico(slug, historico, lado, linha)
  );
}
