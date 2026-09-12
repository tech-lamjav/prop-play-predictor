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
export const ROTULO_DA_ORIGEM: Record<string, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  stripe: 'Stripe',
  outro: 'Outro',
};

/** As origens que o sócio pode escolher ao lançar. `stripe` fica fora: ninguém lança à mão. */
export const ORIGENS_PARA_LANCAR = ['pix', 'dinheiro', 'transferencia', 'outro'] as const;

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
