import { ehIdioma, IDIOMA_PADRAO, type Idioma } from './idiomas';

/**
 * Com que idioma o site abre.
 *
 * PURA de propósito: não lê armazenamento, não lê `navigator`, não toca no
 * i18next. Quem tem esses efeitos passa os valores para cá. É o que permite
 * testar a regra sem navegador — e é onde a detecção por país vai entrar
 * quando existir, como mais um parâmetro, sem mexer em tela nenhuma.
 *
 * A ordem é: o que a pessoa escolheu ganha do que o navegador dela diz, que
 * ganha do padrão da casa.
 *
 * ⚠️ O que esta função decide é só a PRIMEIRA PINTURA. Ela não redireciona, e
 * isso é deliberado: o Google desaconselha mandar a pessoa para outro endereço
 * por idioma presumido, e além disso não há para onde — o produto não tem
 * prefixo de caminho por idioma.
 *
 * @param guardado  O que a pessoa escolheu da última vez, se escolheu.
 * @param doNavegador  A lista ORDENADA de preferência do navegador
 *   (`navigator.languages`), com região: `['es-PE', 'es', 'en-US']`.
 */
export function idiomaInicial(
  guardado: string | null | undefined,
  doNavegador: readonly string[] | undefined,
): Idioma {
  // Valor que não reconhecemos é AUSÊNCIA, e não escolha. Uma versão antiga
  // que gravou `en` não pode fazer um peruano com navegador em espanhol abrir
  // em português por causa de um resto de outra época.
  const escolhido = guardado?.toLowerCase();
  if (ehIdioma(escolhido)) return escolhido;

  for (const marca of doNavegador ?? []) {
    // `es-PE` vira `es`: o navegador fala com região, a matriz fala sem.
    const base = marca.toLowerCase().split('-')[0];
    // Pular em vez de desistir: um navegador em inglês com espanhol em segundo
    // lugar deve abrir em espanhol, e não cair no padrão pelo primeiro item.
    if (ehIdioma(base)) return base;
  }

  return IDIOMA_PADRAO;
}
