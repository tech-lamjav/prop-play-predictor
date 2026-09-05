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
//   2. o HISTÓRICO jogo a jogo (RPC 095) — a mesma AMOSTRA do modelo (últimos
//      dez, qualquer competição), medida por nós. Não é o número dele, mas é do
//      mesmo conjunto de jogos que o gráfico logo abaixo desenha.
//   3. o PERFIL DE TEMPORADA (RPC 094) — número verdadeiro, de outro recorte.
//      Último recurso, para o que não tem gráfico.
//
// ⚠️ A ORDEM DAS DUAS ÚLTIMAS INVERTEU, e não foi arrumação. Até a
// analytics-engineering#91 (25/08/2026) o modelo media a TEMPORADA de uma
// competição, e o perfil era mesmo o mais próximo. Desde ela o default é
// "últimos 10, qualquer competição" — então quem ficou mais perto foi o
// histórico, e manter o perfil na frente passou a mostrar outro recorte.
//
// Medido em 05/09, no Goiás × Fortaleza, gols sofridos por jogo do Goiás:
//
//     perfil de temporada (25 jogos, foto de 31/08)   1,20
//     últimos 10, que é o que o modelo usa            0,90
//
// Trinta e três por cento de diferença — e a frase ficava LOGO ACIMA de um
// gráfico que desenhava os últimos dez. O card se contradizia sozinho.
//
// Elas viviam encadeadas em cada tela, e cada tela encadeava de um jeito: a aba
// de motivos passava a linha, o resumo não, e o mapa nem chamava a primeira. O
// mesmo card mostrava 2,4 e o subtítulo 2,3 — dois números para a mesma
// afirmação. Aqui a ordem é uma, e quem muda de tela vê o mesmo número.
//
// ⚠️ Nem a 095 nem a 094 são o insumo do modelo, e as duas ficam só onde não há
// prestação. Medido em 05/09: dos 49 pares mercado:slug, só 10 têm critério transcrito, e
// as dez são do mercado de Gols — nos outros quatro mercados NENHUMA mostra o
// número que decidiu. Cada critério transcrito remove um consumidor delas, e o
// objetivo é que a lista acabe.

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
    evidenciaDoHistorico(slug, historico, lado, linha) ??
    evidenciaDe(slug, numeros, lado, acesa, linha)
  );
}
