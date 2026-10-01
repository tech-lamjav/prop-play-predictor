/**
 * O idioma em que o produto está falando AGORA.
 *
 * Mora aqui, e não dentro do módulo de número, porque não é dele: número e
 * DATA seguem o mesmo idioma, e deixar o estado em `formato.ts` obrigava o
 * módulo de data a importar o de número para saber em que língua escrever
 * "quinta-feira" — uma dependência que não diz nada sobre o problema.
 *
 * ⚠️ A SETA APONTA PARA CÁ. Quem conhece a camada de tradução é o i18n, que
 * empurra o valor quando a pessoa troca (`src/i18n/init.ts`). Estes módulos
 * continuam puros: testáveis sem navegador e sem biblioteca de tradução
 * carregada, que é o que permite a tabela de casos dos testes de formatação.
 *
 * É estado de módulo, e não parâmetro em cada chamada, porque a régua é do
 * PRODUTO e não de cada tela — são mais de cem chamadas entre número e data.
 *
 * ⚠️ ISTO É INVISÍVEL AO REACT. Trocar o idioma não invalida `useMemo`: um
 * valor já formatado guardado em memo mantém a língua antiga. Guarde o NÚMERO
 * ou a DATA no memo, e formate na pintura. Já aconteceu uma vez, na bancada de
 * mercados.
 */

/** O padrão da casa: de onde vem a base de hoje. */
export const LOCALE_PADRAO = 'pt-BR';

let atual: string = LOCALE_PADRAO;

/** Chamada pela camada de tradução. Ninguém mais precisa chamar. */
export function definirLocaleAtivo(locale: string): void {
  atual = locale;
}

/** O idioma que as réguas de número e de data seguem agora. */
export function localeAtivo(): string {
  return atual;
}
