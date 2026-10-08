import i18next from 'i18next';
import { AREA_DA_COPY, resolverCopy, type CopyComParametros } from '@/utils/futebol-copy';

/**
 * Um pedido de copy do futebol, montado em PORTUGUÊS a partir do catálogo real.
 *
 * ⚠️ Esta é a peça que mantém honestas as asserções sobre frase depois do #544.
 * Antes, um teste de evidência comparava a string que a função devolvia; com a
 * frase vindo do catálogo, comparar a chave provaria pouco — ela pode estar
 * certa e o molde errado — e remontar a frase no teste criaria uma segunda
 * implementação da montagem, livre para divergir da que a tela usa.
 *
 * Então o teste monta pela MESMA `resolverCopy` do hook, contra o MESMO catálogo
 * que o navegador baixa (`src/test/setup.ts` carrega os de português pelo glob).
 * A frase que o teste afirma é a frase que a tela mostra.
 */
export function fraseEmPortugues(pedido: CopyComParametros): string {
  return resolverCopy(
    (chave, params) => i18next.t(`${AREA_DA_COPY}:${chave}`, params ?? {}),
    pedido,
  );
}

/**
 * O mesmo, para o que vem no dado como CHAVE SOLTA — o "como ler" de um gráfico,
 * a unidade de um critério. Sem molde, sem valores.
 */
export function textoEmPortugues(chave: string): string {
  return i18next.t(`${AREA_DA_COPY}:${chave}`);
}
