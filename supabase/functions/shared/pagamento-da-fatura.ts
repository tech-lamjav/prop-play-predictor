/**
 * Uma fatura paga do Stripe vira um pagamento no nosso registro.
 *
 * ============================================================================
 * Por que isto é um módulo puro, e não código dentro do handler
 * ============================================================================
 * Duas coisas precisam da MESMA regra: o webhook, que grava a fatura de amanhã,
 * e o script que importa o histórico que já aconteceu. Se cada um tiver a sua
 * implementação, elas divergem com o tempo — e o total de uma pessoa passa a
 * depender de por onde o dinheiro entrou, que é o pior tipo de discordância
 * num registro de dinheiro.
 *
 * Aqui não há rede, banco nem ambiente: entra a forma de uma fatura, sai o que
 * registrar, ou uma recusa com motivo. É o que permite testar a decisão sem
 * Stripe nenhum.
 *
 * ⚠️ NUNCA escreve no Stripe. O gateway é fonte, e não destino: este código
 * lê o que ele relata e guarda do nosso lado.
 */

/** O que gravar, já no formato das colunas de `crm_pagamento`. */
export interface PagamentoParaGravar {
  user_id: string;
  /** `YYYY-MM-01`. A restrição da tabela exige o dia 1º. */
  competencia: string;
  valor: number;
  origem: "stripe";
  /** `YYYY-MM-DD`, o dia em que o dinheiro caiu. */
  pago_em: string;
  /** O que garante que a mesma fatura entre UMA vez. */
  stripe_invoice_id: string;
}

export type LeituraDaFatura =
  | { tipo: "gravar"; pagamento: PagamentoParaGravar }
  | { tipo: "recusa"; motivo: string };

/**
 * Brasília é UTC−3 o ano inteiro desde 2019, quando o horário de verão acabou.
 *
 * Feito na mão, e não por `Intl`, porque o runtime das edge functions não
 * garante base de fusos completa — e uma conversão que falha em silêncio aqui
 * joga um pagamento para o mês errado, que é o número que decide se a pessoa
 * está devendo.
 */
const HORAS_ATRAS_DE_UTC = 3;

function diaEmBrasilia(segundos: number): string {
  return new Date((segundos - HORAS_ATRAS_DE_UTC * 3600) * 1000).toISOString().slice(0, 10);
}

function numeroFinito(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

/**
 * A fatura, na forma que a gente de fato lê.
 *
 * Declarada como forma solta de propósito: o handler já carrega quatro caminhos
 * alternativos para achar a assinatura dentro da fatura porque o formato mudou
 * entre versões do Stripe. Confiar no tipo declarado seria confiar numa forma
 * que a realidade já desmentiu.
 */
interface FaturaCrua {
  id?: unknown;
  amount_paid?: unknown;
  currency?: unknown;
  created?: unknown;
  status_transitions?: { paid_at?: unknown };
  period_start?: unknown;
  period_end?: unknown;
  lines?: { data?: { period?: { start?: unknown; end?: unknown } }[] };
}

/** Quantos meses de competência o período declarado atravessa. */
function mesesDoPeriodo(inicio: number, fim: number): number {
  const a = diaEmBrasilia(inicio);
  const b = diaEmBrasilia(fim);
  const [anoA, mesA] = a.split('-').map(Number);
  const [anoB, mesB] = b.split('-').map(Number);
  return (anoB - anoA) * 12 + (mesB - mesA) + 1;
}

/**
 * O que registrar de uma fatura paga, ou por que não registrar.
 *
 * Recusa em vez de adivinhar, sempre. Um pagamento inventado é pior que um
 * pagamento perdido: o perdido aparece como total baixo e alguém confere; o
 * inventado vira receita que nunca existiu e ninguém procura.
 */
export function pagamentoDaFatura(
  fatura: unknown,
  userId: string | null | undefined,
): LeituraDaFatura {
  const f = (fatura ?? {}) as FaturaCrua;

  if (!userId) return { tipo: "recusa", motivo: "sem pessoa resolvida" };

  const id = typeof f.id === "string" && f.id.trim() !== "" ? f.id : null;
  if (!id) return { tipo: "recusa", motivo: "fatura sem identificador" };

  const centavos = numeroFinito(f.amount_paid);
  if (centavos === null || centavos <= 0) {
    // Fatura de valor zero existe — cupom de cem por cento, ajuste — e não é
    // dinheiro que entrou. Gravar como pagamento inflaria o total com nada.
    return { tipo: "recusa", motivo: "fatura sem valor pago" };
  }

  const moeda = typeof f.currency === "string" ? f.currency.toLowerCase() : null;
  if (moeda !== null && moeda !== "brl") {
    // ⚠️ Recusa em vez de converter. Converter exigiria uma cotação, e uma
    // cotação errada num registro de dinheiro é um erro que ninguém percebe.
    return { tipo: "recusa", motivo: `moeda nao suportada: ${moeda}` };
  }

  const pagoEmSegundos = numeroFinito(f.status_transitions?.paid_at) ?? numeroFinito(f.created);
  if (pagoEmSegundos === null) return { tipo: "recusa", motivo: "fatura sem data" };

  /*
   * A competência sai do período que a fatura DECLARA, e nunca de assumir que
   * todo plano é mensal: o código nunca leu o intervalo do preço, e um preço
   * anual cadastrado passaria despercebido.
   *
   * Sem período declarado, cai para o mês em que o dinheiro caiu. É um palpite,
   * e é o único palpite aceitável aqui: recusar perderia dinheiro de verdade do
   * total, e o mês do pagamento acerta no caso comum.
   */
  const inicioDoPeriodo =
    numeroFinito(f.lines?.data?.[0]?.period?.start) ?? numeroFinito(f.period_start);
  const fimDoPeriodo = numeroFinito(f.lines?.data?.[0]?.period?.end) ?? numeroFinito(f.period_end);

  /*
   * ⚠️ Fatura que cobre MAIS DE UM MÊS é recusada, e não empilhada.
   *
   * Hoje todo preço cadastrado é mensal, mas o código nunca leu o intervalo do
   * preço: se alguém criar um preço anual e apontar uma variável para ele, uma
   * fatura passaria a cobrir doze meses. Gravar isso numa competência só
   * poria doze meses de dinheiro num mês, e os outros onze apareceriam em
   * aberto — a pessoa seria cobrada por um período que ela pagou.
   *
   * Dividir em doze pagamentos seria pior: cada um precisaria de identificador
   * próprio, e é o identificador da fatura que garante "uma fatura, uma vez".
   * Inventar identificadores derrubaria a única proteção contra o Stripe
   * reentregar o evento.
   *
   * Recusar faz o caso aparecer no log, alto, no dia em que ele existir.
   */
  if (inicioDoPeriodo !== null && fimDoPeriodo !== null) {
    const meses = mesesDoPeriodo(inicioDoPeriodo, fimDoPeriodo);
    if (meses > 1) {
      return { tipo: 'recusa', motivo: `periodo cobre ${meses} meses de competencia` };
    }
  }

  const diaDaCompetencia = diaEmBrasilia(inicioDoPeriodo ?? pagoEmSegundos);

  return {
    tipo: "gravar",
    pagamento: {
      user_id: userId,
      competencia: `${diaDaCompetencia.slice(0, 7)}-01`,
      // Centavos viram reais. `amount_paid` é o que de fato entrou, já com
      // desconto aplicado — e não o preço de tabela do plano.
      valor: centavos / 100,
      origem: "stripe",
      pago_em: diaEmBrasilia(pagoEmSegundos),
      stripe_invoice_id: id,
    },
  };
}
