import { ladoDaSaidaNoMercado, type Premissa } from '@/utils/futebol-premissas';
import type { Saida } from '@/utils/futebol-saida';

// Os cinco estados de uma premissa (spec #349, issue #357).
//
// A tela tinha três rótulos e um contador para cinco coisas, e dois pares
// desses cinco apareciam como o mesmo silêncio.
//
// ── O par que mais custava ──────────────────────────────────────────────────
//
// **Sem dado** é o Motor que não soube: faltou o insumo, e a premissa não pôde
// ser avaliada. **Sem número para conferir** somos nós: o modelo avaliou, a
// premissa até acendeu, e o front não tem como mostrar o número. São opostos —
// um é ignorância do modelo, o outro é ignorância da tela — e a tela os
// mostrava igual.
//
// ── O rótulo que mentia ─────────────────────────────────────────────────────
//
// "Não aconteceu neste jogo" vira **não atingiu o corte**. No clean sheets com
// 38%, os jogos sem sofrer gol ACONTECERAM — só ficaram abaixo do corte de 40%.
// Chamar isso de ausência é falso, e é a mesma família de erro do rótulo
// "Contra" (#351).
//
// ── O que este módulo NÃO resolve ───────────────────────────────────────────
//
// `sem_dado` existe no tipo e nunca é devolvido por `estadoDaPremissa`. Não é
// esquecimento: os NOMES das premissas cegas não chegam ao Postgres. Cada
// premissa é uma coluna booleana no mart e, sem insumo, ela chega `false` e não
// `null` — o achatamento acontece no dbt. Só o contador atravessa
// (`premissas_sem_dado`), e é ele que o rodapé da folha publica; ver
// futebol-sem-dado.ts. O estado existe aqui para o vocabulário ficar completo e
// para ninguém confundi-lo com `sem_numero_para_conferir` ao ler o código.

export type EstadoDaPremissa =
  /** O insumo cruzou o corte. */
  | 'acesa'
  /** Tem insumo, foi avaliada, ficou aquém do corte. */
  | 'nao_atingiu_o_corte'
  /** É do outro lado da saída, ou de outro mercado. */
  | 'nao_se_aplica'
  /** Faltou insumo e o Motor não conseguiu avaliar. Vem do contador, nunca daqui. */
  | 'sem_dado'
  /** Acendeu, e o front não tem o insumo para mostrar. */
  | 'sem_numero_para_conferir';

/**
 * O rótulo de cada estado, na tela.
 *
 * Em minúsculas porque o uso mais comum é no meio de uma frase. Quem precisa dele
 * como título usa `ROTULO_EM_TITULO`, e assim os dois não divergem.
 */
export const ROTULO_DO_ESTADO: Record<EstadoDaPremissa, string> = {
  acesa: 'acendeu',
  nao_atingiu_o_corte: 'não atingiu o corte',
  nao_se_aplica: 'não se aplica a esta saída',
  sem_dado: 'o Motor não teve dado para avaliar',
  sem_numero_para_conferir: 'sem número para conferir',
};

/** O mesmo rótulo com a inicial maiúscula, para título e aba. */
export function rotuloEmTitulo(estado: EstadoDaPremissa): string {
  const r = ROTULO_DO_ESTADO[estado];
  return r.charAt(0).toUpperCase() + r.slice(1);
}

/**
 * A premissa se aplica a esta saída?
 *
 * Falsa para a premissa do outro lado. Ela não "deixou de acontecer": conta para
 * a aposta contrária, e listá-la como apagada é a tela se contradizendo (#351).
 */
export function seAplicaNaSaida(premissa: Premissa, saida: Saida): boolean {
  const lado = ladoDaSaidaNoMercado(saida);
  return lado == null || premissa.lado == null || premissa.lado === lado;
}

/**
 * A premissa ACENDEU para esta saída?
 *
 * Junta `acesa` e `sem_numero_para_conferir`, e é essa a pergunta que as telas
 * fazem para separar as duas listas: as duas acenderam, e o que difere entre elas
 * é a tela ter ou não o número — o que não muda de lista quem é.
 *
 * Existe separada de `estadoDaPremissa` porque quem só quer o agrupamento não tem
 * de responder se tem número, e responder "sim" por conveniência ali seria mentir
 * para uma função que existe justamente para separar os dois silêncios.
 */
export function acendeuNaSaida(
  premissa: Premissa,
  saida: Saida,
  acesas: readonly string[],
): boolean {
  return seAplicaNaSaida(premissa, saida) && acesas.includes(premissa.slug);
}

/**
 * Em que estado uma premissa está, para uma saída.
 *
 * `temNumero` é o que separa `acesa` de `sem_numero_para_conferir`, e quem
 * responde é o chamador: só ele sabe se a prestação de contas ou a evidência
 * produziram algo. Passá-lo de fora mantém este módulo puro e testável, e evita
 * que ele precise conhecer o histórico, a RPC de números e o mapa de critérios.
 */
export function estadoDaPremissa({
  premissa,
  saida,
  acesas,
  temNumero,
}: {
  premissa: Premissa;
  saida: Saida;
  /** Os slugs que o mart acendeu para esta saída. */
  acesas: readonly string[];
  /** O front tem número para mostrar embaixo desta premissa? */
  temNumero: boolean;
}): EstadoDaPremissa {
  if (!seAplicaNaSaida(premissa, saida)) return 'nao_se_aplica';
  if (!acesas.includes(premissa.slug)) return 'nao_atingiu_o_corte';
  return temNumero ? 'acesa' : 'sem_numero_para_conferir';
}
