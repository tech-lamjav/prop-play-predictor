// ============================================================================
// A receita de uma pessoa, e o que ela deve
// ============================================================================
// O Stripe não vende por Pix, e boa parte dos clientes paga por Pix. Essa
// receita acontece fora do gateway, e o que este módulo faz é ler os pagamentos
// recebidos NA MÃO e responder três coisas: quanto essa pessoa já gerou, quais
// meses estão em aberto, e se ela está inadimplente.
//
// ⚠️ Só o dinheiro de fora do Stripe. Quem paga por lá já tem registro lá, e
// duas fontes para o mesmo dinheiro discordam. A tela diz isso com essas
// palavras: "recebido na mão".
//
// Os meses em aberto são DERIVADOS — todo mês desde o começo da assinatura até
// o atual, menos os que têm pagamento. A alternativa era gerar uma linha de
// cobrança por mês, e ela exige um cron que roda todo dia 1º: cron que falha em
// silêncio deixa de gerar a cobrança, o mês não aparece como devido, e o
// sistema esquece de cobrar sem ninguém descobrir. Derivar não tem como
// esquecer.
// ============================================================================

/** Uma linha de `crm_pagamento`, como o banco devolve. */
export interface PagamentoDoBanco {
  id: string;
  competencia: string;
  valor: number | string;
  origem: string;
  pago_em: string;
  estornado_em: string | null;
  motivo_do_estorno: string | null;
}

export interface Pagamento {
  id: string;
  /** `YYYY-MM`, o mês a que o dinheiro se refere. */
  mes: string;
  valor: number;
  origem: string;
  /** `YYYY-MM-DD`, o dia em que o dinheiro caiu. Pode ser depois do mês. */
  pagoEm: string;
  estornado: boolean;
  motivoDoEstorno: string | null;
}

/**
 * Como cada origem se chama na tela.
 *
 * `stripe` está aqui mesmo sem ninguém lançar ainda: quando o webhook entrar,
 * os pagamentos dele já têm nome.
 */
export const ORIGENS = ['pix', 'dinheiro', 'transferencia', 'stripe', 'outro'] as const;

/** Como o dinheiro chegou. É a mesma lista da restrição da tabela no banco. */
export type OrigemDoPagamento = (typeof ORIGENS)[number];

export const ROTULO_DA_ORIGEM: Record<OrigemDoPagamento, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  stripe: 'Stripe',
  outro: 'Outro',
};

/** As origens que o sócio pode escolher ao lançar. `stripe` fica fora: ninguém lança à mão. */
export const ORIGENS_PARA_LANCAR = [
  'pix',
  'dinheiro',
  'transferencia',
  'outro',
] as const satisfies readonly OrigemDoPagamento[];

export type OrigemParaLancar = (typeof ORIGENS_PARA_LANCAR)[number];

/**
 * O rótulo de uma origem que veio do banco.
 *
 * Recebe texto, e não o tipo fechado, porque a linha do banco pode trazer uma
 * origem que esta versão da tela ainda não conhece. Nesse caso mostra o valor
 * cru, que é o que ajuda a investigar, em vez de uma célula vazia.
 */
export function rotuloDaOrigem(origem: string): string {
  return (ROTULO_DA_ORIGEM as Record<string, string>)[origem] ?? origem;
}

/** `2026-09-01` → `2026-09`. O dia não importa: competência é mês. */
function mesDe(competencia: string): string {
  return competencia.slice(0, 7);
}

export function montarPagamentos(linhas: PagamentoDoBanco[]): Pagamento[] {
  return linhas
    .map((l) => ({
      id: l.id,
      mes: mesDe(l.competencia),
      valor: Number(l.valor),
      origem: l.origem,
      pagoEm: l.pago_em,
      estornado: l.estornado_em !== null,
      motivoDoEstorno: l.motivo_do_estorno,
    }))
    .sort((a, b) => (a.mes === b.mes ? a.id.localeCompare(b.id) : b.mes.localeCompare(a.mes)));
}

/**
 * Quanto essa pessoa já gerou, na mão.
 *
 * Estornado não conta, e é o ponto de existir estorno: um lançamento errado
 * sai da soma sem sair da tabela.
 */
export function receitaRecebida(pagamentos: Pagamento[]): number {
  return pagamentos.filter((p) => !p.estornado).reduce((soma, p) => soma + p.valor, 0);
}

/** Soma um mês a `YYYY-MM`. */
function proximoMes(mes: string): string {
  const [ano, m] = mes.split('-').map(Number);
  return m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * Os meses que já venceram e ninguém pagou, do mais antigo para o mais novo.
 *
 * Conta do mês em que a assinatura começou até o mês de HOJE, inclusive: o mês
 * corrente é devido porque a cobrança é no começo dele. Quem paga no dia 20
 * aparece devendo do dia 1º ao 20, e é isso que faz a cobrança acontecer.
 *
 * Assinatura sem valor mensal não tem mês em aberto: não há o que
 * cobrar de quem não combinou pagar nada.
 *
 * Um teto de doze meses existe para o caso de uma assinatura antiga sem nenhum
 * pagamento registrado: sem ele, a tela listaria dois anos de meses devidos, e
 * uma lista assim não é cobrança, é ruído. O primeiro mês da lista continua
 * sendo o mais antigo em aberto dentro da janela.
 */
export const TETO_DE_MESES_EM_ABERTO = 12;

export function mesesEmAberto(
  comecouEm: string,
  valorMensal: number | null,
  pagamentos: Pagamento[],
  hoje: string,
): string[] {
  if (!valorMensal) return [];

  const pagos = new Set(pagamentos.filter((p) => !p.estornado).map((p) => p.mes));
  const ate = hoje.slice(0, 7);

  const abertos: string[] = [];
  let mes = comecouEm.slice(0, 7);
  // O laço tem teto duro para não girar para sempre se `comecouEm` vier de um
  // dado estranho — uma data futura, por exemplo.
  for (let i = 0; i < 600 && mes <= ate; i += 1) {
    if (!pagos.has(mes)) abertos.push(mes);
    mes = proximoMes(mes);
  }

  return abertos.slice(-TETO_DE_MESES_EM_ABERTO);
}

/**
 * A situação financeira de uma assinatura, em uma palavra.
 *
 * `sem_cobranca` vem primeiro: não é inadimplência: quem não combinou pagar
 * não deve nada, e chamar isso de devedor faria a fila de cobrança encher de
 * gente que não tem o que pagar.
 */
export type SituacaoDaReceita =
  { tipo: 'sem_cobranca' } | { tipo: 'em_dia' } | { tipo: 'devendo'; meses: number; total: number };

export function situacaoDaReceita(
  comecouEm: string,
  valorMensal: number | null,
  pagamentos: Pagamento[],
  hoje: string,
): SituacaoDaReceita {
  if (!valorMensal) return { tipo: 'sem_cobranca' };

  const abertos = mesesEmAberto(comecouEm, valorMensal, pagamentos, hoje);
  if (abertos.length === 0) return { tipo: 'em_dia' };

  return { tipo: 'devendo', meses: abertos.length, total: abertos.length * valorMensal };
}

/**
 * O que o sócio digitou no campo de valor, virando número.
 *
 * Três respostas, e não um número com zero para o resto: em branco quer dizer
 * SEM COBRANÇA, que é uma escolha válida, e um texto que não é número quer
 * dizer que a tela tem que reclamar em vez de gravar. Devolver zero para os dois
 * casos gravaria "sem cobrança" para quem digitou "trinta e nove" errado.
 *
 * Aceita vírgula e ponto porque as duas são digitadas. Com vírgula presente, ela
 * é o decimal e o ponto é separador de milhar: é como `1.500,00` é escrito aqui.
 * Sem vírgula, o ponto é o decimal, porque é o que sai de teclado numérico.
 */
export function lerValorDigitado(texto: string): number | null | 'invalido' {
  const limpo = texto.trim();
  if (limpo === '') return null;

  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo;

  const numero = Number(normalizado.replace(/\s|R\$/g, ''));
  if (!Number.isFinite(numero) || numero <= 0) return 'invalido';

  // Duas casas, pela mesma razão do `numeric(10, 2)` do banco: um valor com
  // três casas viraria outro número na gravação, e a tela mostraria um e o
  // banco guardaria outro.
  return Math.round(numero * 100) / 100;
}

/**
 * O valor combinado como texto de campo: `39.9` vira `39,9`, e nulo vira vazio.
 *
 * O avesso de `lerValorDigitado`, e mora do lado dela por isso. Os formulários
 * de assinatura e de receita abrem com o valor que já existe, e cada um tinha a
 * sua cópia.
 */
export function valorComoTexto(valor: number | null): string {
  return valor === null ? '' : String(valor).replace('.', ',');
}

/** `2026-09` → `09/2026`. O mês como quem lê escreve. */
export function formatarMes(mes: string): string {
  const [ano, m] = mes.split('-');
  return `${m}/${ano}`;
}

/** `39.9` → `R$ 39,90`. */
export function emReais(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}
