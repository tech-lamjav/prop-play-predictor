import { PAISES } from '@/config/paises';

/**
 * A moeda em que a pessoa quer LER o próprio dinheiro.
 *
 * ⚠️ ISTO É PREFERÊNCIA DE EXIBIÇÃO, E NÃO CONVERSÃO. O número não muda: 1.500
 * continua 1.500, só troca o símbolo na frente. A decisão de produto é que o
 * valor é do jeito que a pessoa quer ver — "são tudo dinheiros" — e que o
 * registro de apostas não precisa afirmar em que moeda cada aposta foi feita.
 *
 * Por isso NÃO existe coluna de moeda no banco e NÃO há migration: a escolha
 * mora no navegador de quem escolheu, e o padrão é deduzido do país. Se um dia
 * o produto precisar somar dinheiro de moedas diferentes, aí sim a moeda passa
 * a ser propriedade de cada valor guardado — e aí é outro trabalho.
 */

/** A moeda de cada país que o cadastro oferece. */
const MOEDA_DO_PAIS: Record<string, string> = {
  BR: 'BRL',
  PE: 'PEN',
  AR: 'ARS',
  MX: 'MXN',
  CL: 'CLP',
  CO: 'COP',
  UY: 'UYU',
  PY: 'PYG',
  BO: 'BOB',
  EC: 'USD',
  VE: 'VES',
  CR: 'CRC',
  PA: 'PAB',
  GT: 'GTQ',
  DO: 'DOP',
  PT: 'EUR',
  ES: 'EUR',
  US: 'USD',
  IT: 'EUR',
  GB: 'GBP',
  FR: 'EUR',
  DE: 'EUR',
  CA: 'CAD',
  AO: 'AOA',
  MZ: 'MZN',
  JP: 'JPY',
  AU: 'AUD',
};

/**
 * O idioma com que cada moeda é ESCRITA.
 *
 * Dinheiro segue a moeda, e não o idioma da interface — é a regra que já valia
 * quando a moeda era fixa, e continua valendo agora que ela varia. Sem isto,
 * escolher sol peruano numa tela em português escreveria "PEN 1.500,00" em vez
 * de "S/ 1,500.00": o símbolo sai certo, mas o separador fica do país errado.
 */
const LOCALE_DA_MOEDA: Record<string, string> = {
  BRL: 'pt-BR',
  PEN: 'es-PE',
  ARS: 'es-AR',
  MXN: 'es-MX',
  CLP: 'es-CL',
  COP: 'es-CO',
  UYU: 'es-UY',
  PYG: 'es-PY',
  BOB: 'es-BO',
  VES: 'es-VE',
  CRC: 'es-CR',
  PAB: 'es-PA',
  GTQ: 'es-GT',
  DOP: 'es-DO',
  USD: 'en-US',
  EUR: 'es-ES',
  GBP: 'en-GB',
  CAD: 'en-CA',
  AOA: 'pt-AO',
  MZN: 'pt-MZ',
  JPY: 'ja-JP',
  AUD: 'en-AU',
};

export const MOEDA_PADRAO = 'BRL';

/** A moeda do país, ou o padrão da casa quando o país não estiver na lista. */
export function moedaDoPais(pais: string | null | undefined): string {
  return (pais && MOEDA_DO_PAIS[pais.toUpperCase()]) || MOEDA_PADRAO;
}

/** O idioma em que a moeda se escreve. */
export function localeDaMoeda(moeda: string): string {
  return LOCALE_DA_MOEDA[moeda] ?? 'pt-BR';
}

export function ehMoedaConhecida(valor: unknown): valor is string {
  return typeof valor === 'string' && valor in LOCALE_DA_MOEDA;
}

/**
 * As moedas do seletor, na ordem da operação e sem repetir.
 *
 * Deriva da lista de países para as duas não divergirem: país que entrar no
 * cadastro aparece aqui no mesmo commit. O euro aparece em cinco países e o
 * dólar em dois — a lista é de MOEDAS, então cada uma entra uma vez.
 */
export interface Moeda {
  /** ISO 4217. */
  codigo: string;
  /** Como ela se escreve, para a pessoa reconhecer na lista: "R$", "S/". */
  simbolo: string;
}

function simboloDe(moeda: string): string {
  try {
    // `narrowSymbol` dá "S/" em vez de "PEN"; nem todo ambiente o suporta.
    const partes = new Intl.NumberFormat(localeDaMoeda(moeda), {
      style: 'currency',
      currency: moeda,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    return partes.find((p) => p.type === 'currency')?.value ?? moeda;
  } catch {
    return moeda;
  }
}

export const MOEDAS: Moeda[] = (() => {
  const vistas = new Set<string>();
  const lista: Moeda[] = [];
  for (const pais of PAISES) {
    const codigo = moedaDoPais(pais.codigo);
    if (vistas.has(codigo)) continue;
    vistas.add(codigo);
    lista.push({ codigo, simbolo: simboloDe(codigo) });
  }
  return lista;
})();
