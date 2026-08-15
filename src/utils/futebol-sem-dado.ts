// ============================================================
// futebol-sem-dado.ts — "não deu para checar tudo"
// ============================================================
// O Motor conta quantas checagens do jogo ficaram sem resposta por FALTA DE
// DADO: a lista de desfalques que ainda não saiu, o histórico que o time não
// tem, o xG que a liga não publica.
//
// A regra de domínio está na ADR 0003 e é curta: **dado faltante diagnostica,
// não penaliza**. A nota NÃO muda por causa disso. O que muda é o leitor passar
// a saber que uma nota baixa pode ser POUCA INFORMAÇÃO em vez de INFORMAÇÃO
// CONTRÁRIA — que são coisas opostas e a tela mostrava as duas igual.
//
// Por isso o aviso é de RESSALVA, não de defeito:
//   · não leva desconto de pontos do lado, como os outros avisos levam
//   · não usa cor de erro
//   · fala de quantas, nunca de quais (a lista de quais não existe no Postgres,
//     é array e o sync não copia array)
//
// Se ele aparecer ao lado de um número negativo, comunica o oposto do que
// existe para dizer: o assinante lê "esta aposta é pior" onde a frase quer
// dizer "sabemos menos sobre esta aposta". Há teste guardando isso.
// ============================================================

export interface AvisoSemDado {
  /** Uma linha, para a lista do board. */
  curto: string;
  /** Frase inteira, para o detalhe. */
  longo: string;
}

/**
 * O aviso, ou null quando não há o que avisar.
 *
 * Devolver null em vez de string vazia é de propósito: quem chama decide se
 * renderiza, e um aviso que aparece sempre não é aviso.
 */
export function avisoSemDado(contador: number | null | undefined): AvisoSemDado | null {
  if (typeof contador !== 'number' || !isFinite(contador) || contador < 1) return null;

  const n = Math.floor(contador);
  const coisas = n === 1 ? '1 coisa' : `${n} coisas`;

  return {
    curto: `Não deu para checar ${coisas}`,
    longo: `Não deu para checar ${coisas} deste jogo: faltou informação. A leitura saiu com menos informação do que o normal, e não com informação contra.`,
  };
}
