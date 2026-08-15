// ============================================================
// futebol-sem-dado.ts — "não deu para conferir tudo"
// ============================================================
// O Motor conta quantas premissas do jogo ficaram sem resposta por FALTA DE
// DADO: a lista de desfalques que ainda não saiu, o histórico que o time não
// tem, o xG que a liga não publica.
//
// O leitor passa a saber que uma nota baixa pode ser POUCA INFORMAÇÃO em vez de
// INFORMAÇÃO CONTRÁRIA — que são coisas opostas e a tela mostrava as duas igual.
//
// Por isso o aviso é de RESSALVA, não de defeito:
//   · não leva desconto de pontos do lado, como os outros avisos levam
//   · não usa cor de erro
//   · fala de quantas, nunca de quais (os nomes não chegam no Postgres; ver
//     "Por que só o número" abaixo)
//
// Se ele aparecer ao lado de um número negativo, comunica o oposto do que
// existe para dizer: o assinante lê "esta aposta é pior" onde a frase quer
// dizer "sabemos menos sobre esta aposta". Há teste guardando isso.
//
// ------------------------------------------------------------
// POR QUE SÓ NA FOLHA DE MERCADO (decisão do Victor, 15/08/2026)
// ------------------------------------------------------------
// O aviso já esteve na lista do board, no destaque do dia e na DM do Betinho.
// Saiu dos três, medido: aparecia em 1 de cada 3 linhas do board, e a distância
// de Score entre "tudo conferido" e "6+ sem dado" é de 4 pontos. Aviso em um
// terço da tela sobre algo que move 4 pontos é ruído, e "3 premissas" sem os
// nomes não é acionável.
//
// Fica na folha de mercado porque ali o leitor já está lendo premissa por
// premissa e vê a lista curta. A linha não é aviso, é o rodapé fechando uma
// conta que ele está fazendo na frente dele.
//
// ------------------------------------------------------------
// POR QUE SÓ O NÚMERO, E O QUE DESTRAVARIA OS NOMES
// ------------------------------------------------------------
// Não é limitação da nossa camada, e não adianta procurar aqui. Cada premissa é
// uma coluna booleana em `futebol.int_futebol_premissas_*`, e quando o insumo
// não existe ela chega como `false`, não como `null`. Conferido:
//
//   select forca_mismatch, superioridade_xg, mando, desfalque_adversario
//   from futebol.int_futebol_premissas_1x2 where premissas_sem_dado = 7;
//   -- as sete voltam false, nenhuma null
//
// Ou seja, o achatamento acontece no dbt e os nomes já chegam apagados. Só o
// contador atravessa. Pedido aberto com o Matheus na task [C] do ClickUp; se os
// nomes vierem, este arquivo passa a dizer "faltou a escalação" e aí volta a
// discussão de mostrar na vitrine.
// ============================================================

/**
 * O aviso, ou null quando não há o que avisar.
 *
 * Devolver null em vez de string vazia é de propósito: quem chama decide se
 * renderiza, e um aviso que aparece sempre não é aviso.
 */
export function avisoSemDado(contador: number | null | undefined): string | null {
  if (typeof contador !== 'number' || !isFinite(contador) || contador < 1) return null;

  const n = Math.floor(contador);
  const premissas = n === 1 ? '1 premissa' : `${n} premissas`;

  return `Faltou informação para conferir ${premissas} deste jogo. A leitura saiu com menos informação do que o normal, e não com informação contra.`;
}
