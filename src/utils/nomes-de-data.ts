import { localeAtivo } from '@/utils/idioma-ativo';

/**
 * Nome do dia da semana e do mês no idioma ativo.
 *
 * ⚠️ VEM DO `Intl`, E NÃO DE TABELA ESCRITA À MÃO. Dia e mês são dado do CLDR,
 * não texto de produto. Este módulo existe porque as tabelas à mão voltaram a
 * aparecer em lugares diferentes — o painel do Betinho tinha duas, a home da
 * NBA tinha três, a tela do jogo tinha uma — e toda vez a tela em espanhol
 * escrevia "Terça, 6 de outubro". A guarda de texto cru não as pega porque são
 * palavras soltas e não frases.
 *
 * Mora em `utils`, e não em nenhum produto, porque é de todos: o painel de
 * apostas e a home da NBA usam a mesma função.
 */

/**
 * Formatadores reaproveitados.
 *
 * Mesmo motivo do cache de `futebol-datas.ts`: construir um
 * `Intl.DateTimeFormat` custa 66 vezes mais que reusá-lo, e isto é chamado
 * dentro de agregação.
 */
const formatadores = new Map<string, Intl.DateTimeFormat>();
function formatador(locale: string, opcoes: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const chave = `${locale}|${JSON.stringify(opcoes)}`;
  const guardado = formatadores.get(chave);
  if (guardado) return guardado;
  const novo = new Intl.DateTimeFormat(locale, { ...opcoes, timeZone: 'UTC' });
  formatadores.set(chave, novo);
  return novo;
}

/**
 * O nome do dia da semana (0 = domingo), com a primeira letra maiúscula.
 *
 * O corte no hífen é o que mantém o PORTUGUÊS como estava: o `pt-BR` escreve
 * "sexta-feira", e as telas sempre disseram "Sexta". Em espanhol não existe
 * hífen nessa posição, então o corte não faz nada: "viernes" sai "Viernes".
 */
export function nomeDoDiaDaSemana(
  diaDaSemana: number,
  largura: 'long' | 'short' = 'long',
  locale = localeAtivo(),
): string {
  // 01/02/2026 é um domingo: somar o índice dá o dia pedido, em UTC para o
  // fuso de quem lê não escorregar o rótulo para o dia vizinho.
  const d = new Date(Date.UTC(2026, 1, 1 + diaDaSemana));
  const bruto = formatador(locale, { weekday: largura }).format(d).replace('.', '').split('-')[0];
  return bruto.charAt(0).toUpperCase() + bruto.slice(1);
}

/**
 * O nome do mês (0 = janeiro), em minúscula, como o CLDR escreve no meio de
 * frase: "6 de outubro", "6 de octubre".
 *
 * A forma curta sai sem o ponto ("out", "oct"), como as tabelas à mão
 * escreviam.
 */
export function nomeDoMes(mes: number, largura: 'long' | 'short' = 'long', locale = localeAtivo()): string {
  const d = new Date(Date.UTC(2026, mes, 15));
  return formatador(locale, { month: largura }).format(d).replace('.', '').toLowerCase();
}
