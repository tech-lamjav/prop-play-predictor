/**
 * De qual cabeçalho sai o endereço de quem fez a requisição.
 *
 * Spec em #548, ticket #550.
 *
 * Parece a parte boba do trabalho e é a mais perigosa: o erro aqui não aparece
 * na tela de ninguém. Ele enche a tabela de evidência com endereço errado, e o
 * sintoma só surge numa fiscalização, quando não tem mais conserto.
 *
 * ── O QUE FOI MEDIDO ────────────────────────────────────────────────────────
 * Uma sonda publicada em staging (#543) chamou a mesma função cinco vezes e
 * recebeu, nas cinco, exatamente isto:
 *
 *   cf-connecting-ip : 200.162.199.115
 *   x-forwarded-for  : 200.162.199.115,200.162.199.115, 13.248.114.171
 *
 * O `cf-connecting-ip` veio limpo e estável. O `x-forwarded-for` veio com o
 * endereço do cliente REPETIDO e um endereço da AWS no fim — quem pegar o
 * último item registra a Amazon como origem da pessoa.
 *
 * ── POR QUE O `x-forwarded-for` É RECUSADO, E NÃO SÓ DESPRIORIZADO ──────────
 * O primeiro item dele parece a escolha certa, e seria, se ninguém pudesse
 * escrevê-lo. Mas qualquer cliente pode mandar o próprio `x-forwarded-for`, e a
 * borda ACRESCENTA em vez de substituir: um brasileiro que enviasse o cabeçalho
 * com um endereço estrangeiro apareceria em primeiro lugar na lista.
 *
 * Usar esse cabeçalho como reserva abriria um buraco exatamente na coisa que
 * este código existe para provar — e um buraco silencioso, porque ninguém
 * reclama de conseguir entrar.
 *
 * O `cf-connecting-ip` é escrito pela borda e não pelo cliente. Ou ele está
 * presente, ou a resposta é "não sei" — que deixa entrar e ACENDE UM ALARME
 * (#554). Preferir um alarme barulhento a uma resposta que pode ser plantada é
 * a troca consciente aqui.
 */

/** O único cabeçalho em que a borda escreve e o cliente não. */
const CABECALHO_CONFIAVEL = 'cf-connecting-ip';

/**
 * O endereço de quem chamou, ou null se a borda não disse.
 *
 * Null não significa "veio de lugar nenhum" — significa que a infraestrutura
 * parou de contar, e é caso de arrumar, não de adivinhar.
 */
export function ipDaRequisicao(headers: Headers): string | null {
  const bruto = headers.get(CABECALHO_CONFIAVEL);
  if (typeof bruto !== 'string') return null;

  const limpo = bruto.trim();
  if (limpo === '') return null;

  // Se um dia a borda passar a mandar lista aqui também, o primeiro item é o
  // cliente — mas como quem escreve este cabeçalho é ela, e não o cliente, não
  // há endereço plantado para pular.
  const primeiro = limpo.split(',')[0].trim();
  return primeiro === '' ? null : primeiro;
}
