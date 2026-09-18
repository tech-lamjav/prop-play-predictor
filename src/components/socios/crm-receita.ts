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

/** A origem que o gateway grava. Quem paga por lá não é cobrado por ninguém. */
export const ORIGEM_DO_GATEWAY = 'stripe';

function soma(pagamentos: Pagamento[]): number {
  return pagamentos.filter((p) => !p.estornado).reduce((total, p) => total + p.valor, 0);
}

/**
 * O que entrou FORA do gateway.
 *
 * ⚠️ Filtra a origem, e o filtro é o que impede este número de virar mentira.
 * Até a #457 a ficha carregava só pagamento de assinatura manual, então somar
 * tudo dava o mesmo resultado. Agora o dinheiro do Stripe chega na mesma lista,
 * e sem o filtro o rótulo "recebido na mão" passaria a incluir o que ninguém
 * recebeu na mão.
 *
 * É este o número que importa para a cobrança: é o dinheiro que depende de
 * alguém ir atrás.
 *
 * Estornado não conta, e é o ponto de existir estorno: um lançamento errado
 * sai da soma sem sair da tabela.
 */
export function recebidoNaMao(pagamentos: Pagamento[]): number {
  return soma(pagamentos.filter((p) => p.origem !== ORIGEM_DO_GATEWAY));
}

/**
 * Tudo que a pessoa já pagou, das duas origens.
 *
 * Responde outra pergunta que a de cima: quanto esta pessoa vale. Os dois ficam
 * na tela porque o sócio usa um para decidir de quem cobrar e o outro para
 * saber com quem está falando — e trocar um pelo outro tiraria dele um número
 * que já usa.
 */
export function recebidoTotal(pagamentos: Pagamento[]): number {
  return soma(pagamentos);
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
 * ⚠️ Devolve TODOS os meses, nunca um recorte. Já cortou nos doze mais
 * recentes, e o corte vazava para o dinheiro: quem chama multiplica pelo
 * TAMANHO desta lista, então quem devia dezoito meses aparecia devendo doze, e
 * a fila de inadimplentes — que ordena pelo total — mentia sobre a própria
 * ordem, que é a única coisa que ela promete. Resumir a lista continua
 * valendo, mas é decisão de tela e mora em `resumirMeses`.
 */
export function mesesEmAberto(
  comecouEm: string,
  valorMensal: number | null,
  pagamentos: Pagamento[],
  hoje: string,
): string[] {
  if (!valorMensal) return [];

  /*
   * ⚠️ Só o dinheiro da MÃO quita mês de assinatura manual.
   *
   * Desde que a ficha passou a carregar pagamento por pessoa, a lista que chega
   * aqui tem as duas origens. Sem este filtro, uma fatura do cartão fechava um
   * mês do acordo feito na mão: a pessoa aparecia "em dia" na ficha e "devendo"
   * na fila de inadimplentes, que descarta as linhas sem assinatura de
   * propósito. Duas telas, a mesma pessoa, respostas opostas.
   *
   * São dinheiros de acordos diferentes. Quem paga no cartão não está pagando a
   * mensalidade que o sócio combinou por fora.
   */
  const pagos = new Set(
    pagamentos
      .filter((p) => !p.estornado && p.origem !== ORIGEM_DO_GATEWAY)
      .map((p) => p.mes),
  );
  const ate = hoje.slice(0, 7);

  const abertos: string[] = [];
  let mes = comecouEm.slice(0, 7);
  // O laço tem teto duro para não girar para sempre se `comecouEm` vier de um
  // dado estranho — uma data futura, por exemplo.
  for (let i = 0; i < 600 && mes <= ate; i += 1) {
    if (!pagos.has(mes)) abertos.push(mes);
    mes = proximoMes(mes);
  }

  return abertos;
}

/**
 * Quanto a pessoa deve: cada mês em aberto vale uma mensalidade.
 *
 * ⚠️ Mora num lugar só porque esta multiplicação em DOIS donos foi exatamente
 * por onde o defeito vazou. A ficha e a fila calculavam o mesmo total cada uma
 * por si; quando a lista de meses passou a vir cortada em doze, as duas
 * erraram junto e em silêncio. Com um dono, consertar a conta conserta os dois
 * lugares — e quebrar a conta quebra os dois testes.
 */
export function totalEmAberto(meses: string[], valorMensal: number): number {
  return meses.length * valorMensal;
}

/**
 * Quantos meses em aberto a tela escreve por extenso antes de resumir.
 *
 * É teto de ESPAÇO, e não de dívida. O nome antigo dizia "teto de meses em
 * aberto", e um nome assim convida de volta exatamente o bug que existia: o
 * número que a pessoa deve não passa por aqui.
 */
export const MESES_MOSTRADOS_NA_TELA = 12;

/**
 * A lista de meses como a tela escreve: os mais recentes por extenso, e quantos
 * ficaram de fora.
 *
 * ⚠️ `ocultos` existe para a tela DIZER que resumiu. Resumir em silêncio é
 * metade do defeito que separou esta função de `mesesEmAberto`: quem lê "Em
 * aberto:" e conta doze meses precisa saber que há mais, senão a linha
 * desmente o selo de "devendo 18 meses" que está logo acima dela.
 *
 * ⚠️ Mantém os mais ANTIGOS. A primeira versão mantinha os recentes, só porque
 * era o que o código antigo fazia, e a revisão mostrou que isso quebrava duas
 * coisas: o "e mais N" no fim da frase prometia meses posteriores ao último
 * listado, quando os escondidos eram os anteriores; e a ficha sugeria lançar um
 * mês que a própria linha não mostrava.
 */
export function resumirMeses(meses: string[]): { mostrados: string[]; ocultos: number } {
  if (meses.length <= MESES_MOSTRADOS_NA_TELA) return { mostrados: meses, ocultos: 0 };
  return {
    mostrados: meses.slice(0, MESES_MOSTRADOS_NA_TELA),
    ocultos: meses.length - MESES_MOSTRADOS_NA_TELA,
  };
}

/**
 * A linha "Em aberto:" como as duas telas escrevem — a da ficha e a da fila de
 * inadimplentes.
 *
 * Mora aqui, e não em cada tela, porque a frase precisa ser a MESMA nas duas: o
 * sócio compara os dois lugares, e duas redações do mesmo resumo fariam ele
 * achar que são contas diferentes.
 */
export function textoDosMesesEmAberto(meses: string[]): string {
  const { mostrados, ocultos } = resumirMeses(meses);
  const lista = mostrados.map(formatarMes).join(', ');
  return ocultos > 0 ? `${lista}, e mais ${ocultos}` : lista;
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

  return { tipo: 'devendo', meses: abertos.length, total: totalEmAberto(abertos, valorMensal) };
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
