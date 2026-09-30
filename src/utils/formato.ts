// ============================================================================
// formato.ts — como todo número do produto vira texto
// ============================================================================
// Existe porque a formatação estava escrita à mão e espalhada, e já se
// contradizia em português, antes de qualquer espanhol: a odd era desenhada
// por `toFixed(2)` em 43 lugares, 41 com ponto e 2 com vírgula, e o dinheiro
// tinha definições independentes espalhadas — três delas com o "R$" digitado
// no JSX ao lado do número, que é o que não vira "S/" nem "$" num segundo país.
//
// REGRA: não existe uma régua, existem QUATRO, e elas discordam de propósito.
//
//   1. A ODD SEGUE O SETOR. Ponto, sempre, em qualquer país. Confirmado em
//      fonte de operador: a central de ajuda da Betano ARGENTINA publica
//      "Más 2.5 goles" com ponto, num país que escreve dinheiro com vírgula.
//      Por isso `fmtOdd` não aceita idioma: a regra é a AUSÊNCIA da escolha.
//   2. O DINHEIRO SEGUE A MOEDA, e não o idioma da tela. O preço é cobrado em
//      real; trocar o separador porque a tela está em espanhol daria
//      "R$ 1,234.50", que não existe em lugar nenhum. Ver `fmtDinheiro`.
//   3. PORCENTAGEM, DECIMAL e NÚMERO SEGUEM O IDIOMA ATIVO, que a camada de
//      tradução empurra para cá. Ver `definirLocaleAtivo`.
//   4. A LINHA ANALISADA ainda não tem régua decidida. Hoje segue o idioma,
//      como já seguia o país. Ver `fmtLinhaAnalisada`.
//
// ⚠️ NUNCA escreva `toFixed(...).replace('.', ',')` de novo, nem construa um
// `Intl.NumberFormat` dentro de função chamada em laço. O motivo do cache está
// documentado em `futebol-datas.ts`: construir um formatador custa 66 vezes
// mais que reusá-lo, e isso já travou a home por 1,4 segundo num sábado cheio.
//
// ⚠️ O vocabulário é o do CONTEXT.md, e ali "linha da aposta" é termo PROIBIDO
// (verbete "Linha de referência"). Os termos sancionados são linha analisada,
// cotada, de referência e bloqueada. O 2,5 de "Mais de 2,5 gols" é a linha
// ANALISADA — o modelo calcula premissas para ela tendo ou não cotação.
// ============================================================================

/** O padrão da casa, e o ponto de partida de tudo aqui. */
export const LOCALE_PADRAO = 'pt-BR';
export const MOEDA_PADRAO = 'BRL';

/**
 * O idioma ativo, que a camada de tradução empurra para cá quando a pessoa
 * troca (`src/i18n/init.ts`).
 *
 * Fica como estado de módulo, e não como parâmetro nas 86 chamadas que o
 * seguem, porque a régua é do PRODUTO e não de cada tela. E a seta aponta para
 * cá: é o i18n que conhece a formatação, não o contrário, e assim este arquivo
 * continua puro, testável sem navegador e sem tradução carregada.
 */
let localeAtivoAgora: string = LOCALE_PADRAO;

/** Chamada pela camada de tradução. Ninguém mais precisa chamar. */
export function definirLocaleAtivo(locale: string): void {
  localeAtivoAgora = locale;
}

/** O idioma que as réguas de número seguem agora. */
export function localeAtivo(): string {
  return localeAtivoAgora;
}

/** Ausência. Nunca "0", que afirmaria um valor, nem "NaN", que vaza defeito. */
const TRACO = '—';

const formatadores = new Map<string, Intl.NumberFormat>();
function formatador(locale: string, opcoes: Intl.NumberFormatOptions): Intl.NumberFormat {
  const chave = `${locale}|${JSON.stringify(opcoes)}`;
  const guardado = formatadores.get(chave);
  if (guardado) return guardado;
  const novo = new Intl.NumberFormat(locale, opcoes);
  formatadores.set(chave, novo);
  return novo;
}

function vazio(v: number | null | undefined): v is null | undefined {
  return v == null || !Number.isFinite(v);
}

/**
 * A odd, como a casa de aposta escreve: ponto e duas casas, em qualquer país.
 *
 * Um argumento só, e é isso que garante a regra — não há idioma para passar.
 */
export function fmtOdd(odd: number | null | undefined): string {
  if (vazio(odd)) return TRACO;
  // O único `toFixed` legítimo do produto: é aqui que a régua da odd mora.
  return odd.toFixed(2);
}

/**
 * Dinheiro com o símbolo da moeda, na formatação da MOEDA.
 *
 * ⚠️ O dinheiro é a única régua que NÃO segue o idioma ativo, e isso é
 * decisão, não esquecimento. O preço do produto é cobrado em real. Trocar só o
 * separador porque a tela está em espanhol produziria "R$ 1,234.50" — símbolo
 * brasileiro com separador estrangeiro, coisa que não existe em lugar nenhum.
 * Dinheiro segue o país da MOEDA, e a moeda só muda quando houver decisão de
 * preço por país, que está fora do escopo do #532.
 *
 * `casas` existe por dois motivos reais, e não por generalidade: eixo de
 * gráfico pede valor sem centavo, e o peso chileno NÃO TEM centavo. Deixar em
 * branco usa o que a moeda manda, que é o certo na esmagadora maioria.
 */
export function fmtDinheiro(
  valor: number | null | undefined,
  {
    locale = LOCALE_PADRAO,
    moeda = MOEDA_PADRAO,
    casas,
  }: { locale?: string; moeda?: string; casas?: number } = {},
): string {
  if (vazio(valor)) return TRACO;
  return formatador(locale, {
    style: 'currency',
    currency: moeda,
    ...(casas == null ? {} : { minimumFractionDigits: casas, maximumFractionDigits: casas }),
  }).format(valor);
}

/** Uma taxa de 0 a 1 em porcentagem, na formatação do país. */
export function fmtPct(
  taxa: number | null | undefined,
  casas = 0,
  locale = localeAtivo(),
): string {
  if (vazio(taxa)) return TRACO;
  const n = formatador(locale, {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(taxa * 100);
  return `${n}%`;
}

/**
 * Um decimal com casas fixas, na formatação do país.
 *
 * Sem agrupamento de milhar, e isso é deliberado: substitui
 * `toFixed(n).replace('.', ',')`, que nunca agrupou. Ligar o agrupamento aqui
 * mudaria silenciosamente dezenas de telas que ninguém pediu para mudar.
 * Quem quiser "1.234,6" pede o agrupamento por fora, ciente da escolha.
 */
export function fmtDecimal(
  valor: number | null | undefined,
  casas = 1,
  locale = localeAtivo(),
): string {
  if (vazio(valor)) return TRACO;
  return formatador(locale, {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
    useGrouping: false,
  }).format(valor);
}

/**
 * O número como ele é: 2,95 é 2,95 e 0,05 é 0,05, sem arredondar nem completar.
 *
 * Substitui `String(v).replace('.', ',')`. Existe separado de `fmtDecimal`
 * porque a diferença entre os dois é o que decide se a tela mostra "faltou
 * 0,05" ou "faltou 0,1" — o dobro. O motivo está documentado há mais tempo em
 * `exato`, no futebol-criterio.
 *
 * As 20 casas e a ausência de agrupamento existem para igualar o `String`: o
 * `Intl` padrão corta em 3 casas e agrupa milhar, e as duas coisas mudariam a
 * saída de hoje.
 */
export function fmtExato(valor: number | null | undefined, locale = localeAtivo()): string {
  if (vazio(valor)) return TRACO;
  return formatador(locale, { maximumFractionDigits: 20, useGrouping: false }).format(valor);
}

/**
 * Um número qualquer, COM agrupamento de milhar: 1.234,5.
 *
 * É a régua para quantidade grande — quilômetro rodado, contagem num gráfico —
 * onde o milhar sem ponto vira parede de dígito. As outras desligam o
 * agrupamento para igualar o `toFixed` que substituíram; esta não substitui
 * nada, ela troca o `toLocaleString('pt-BR')` solto, que já agrupava.
 */
export function fmtNumero(
  valor: number | null | undefined,
  { casas, locale = localeAtivo() }: { casas?: number; locale?: string } = {},
): string {
  if (vazio(valor)) return TRACO;
  return formatador(locale, {
    ...(casas == null ? {} : { minimumFractionDigits: casas, maximumFractionDigits: casas }),
  }).format(valor);
}

/** Até N casas, sem completar com zero: 0,05 fica 0,05 e 0,50 fica 0,5. */
export function fmtDecimalAte(
  valor: number | null | undefined,
  maxCasas = 2,
  locale = localeAtivo(),
): string {
  if (vazio(valor)) return TRACO;
  return formatador(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxCasas,
    useGrouping: false,
  }).format(valor);
}

/**
 * A linha analisada: o 2,5 de "Mais de 2,5 gols", o +1,5 do handicap.
 *
 * ⚠️ DECISÃO EM ABERTO, e é por isso que ela tem função própria em vez de
 * chamar `fmtExato` direto.
 *
 * A odd provou seguir o SETOR e não o país: casa de aposta escreve "cuota de
 * 2.10" e "10.000 CLP" na mesma página para o mesmo chileno. A linha é um
 * número do mesmo balcão, e pode muito bem seguir a mesma convenção — o
 * mercado internacional escreve "Over 2.5", com ponto.
 *
 * Hoje ela segue o PAÍS, que é o que o produto já fazia em português. Se a
 * decisão for que ela segue o setor, muda aqui, uma vez, e os 11 lugares que
 * a desenham acompanham. Era exatamente essa caçada que o #529 existe para
 * evitar.
 */
export function fmtLinhaAnalisada(
  linha: number | null | undefined,
  locale = localeAtivo(),
): string {
  if (vazio(linha)) return TRACO;
  return fmtExato(linha, locale);
}
