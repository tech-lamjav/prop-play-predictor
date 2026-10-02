import { es, ptBR, type Locale } from 'date-fns/locale';
import { localeAtivo } from '@/utils/idioma-ativo';

/**
 * O idioma ativo, na forma que o date-fns entende.
 *
 * ⚠️ EXISTE PORQUE O DATE-FNS NÃO FALA BCP-47. O resto do produto usa `Intl`,
 * que recebe `"pt-BR"` ou `"es-419"` como string; o date-fns recebe um OBJETO
 * importado. São dois vocabulários para a mesma pergunta, e esta função é a
 * ponte entre eles.
 *
 * A varredura da #530 trocou 63 chamadas de `Intl` e não tocou nestas, porque
 * elas não se parecem com as outras: o calendário da agenda continuou
 * escrevendo "Outubro 2026" e "DOM SEG TER" numa tela em espanhol, com a
 * régua de dias logo acima já dizendo "Mié 30".
 *
 * Os dois idiomas entram ESTÁTICOS de propósito. Carregar sob demanda pouparia
 * uns poucos kB e traria um estado assíncrono no meio do desenho de um
 * calendário — o pacote de um idioma do date-fns é pequeno, e a complexidade
 * não é.
 */
const POR_IDIOMA: Record<string, Locale> = {
  pt: ptBR,
  es,
};

export function localeDoDateFns(): Locale {
  // A chave do `Intl` vem com região (`pt-BR`, `es-419`); a do date-fns não.
  return POR_IDIOMA[localeAtivo().split('-')[0]] ?? ptBR;
}
