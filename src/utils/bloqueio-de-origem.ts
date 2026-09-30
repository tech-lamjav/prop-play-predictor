/**
 * O que a tela mostra, dado o que o porteiro respondeu.
 *
 * Spec na issue #548, ticket #551.
 *
 * Módulo PURO: não chama nada, não lê nada, não sabe que horas são. Recebe o
 * estado e devolve uma palavra. É aqui que quase todo o teste desta fatia mora,
 * sem navegador e sem rede — o mesmo formato de `perfil-declarado.ts`.
 *
 * ⚠️ Esta regra NÃO decide de onde a pessoa é. Quem decide é o servidor, e esta
 * função só obedece. Se algum dia alguém for tentado a olhar o fuso horário do
 * navegador, ou o idioma, ou qualquer outra pista de país aqui dentro: esse é o
 * segundo juiz que a spec existe para não ter.
 */

/** As três coisas que podem estar na tela. */
export type QueMostrar = 'produto' | 'bloqueio' | 'espera';

/** O que o porteiro devolveu. Espelha o tipo do hook, de propósito. */
export type Veredito = 'entrou' | 'barrado';

export interface EstadoDaPorta {
  /** Verdadeiro enquanto a resposta do porteiro não chegou. */
  readonly carregando: boolean;
  /** O veredito devolvido, ou null se ainda não há resposta. */
  readonly veredito: Veredito | null;
  /** A rota atual, para as exceções abaixo. */
  readonly pathname: string;
}

/**
 * As rotas que continuam abertas mesmo para quem foi barrado.
 *
 * São os documentos que descrevem a relação da pessoa com a empresa. Fechá-los
 * junto com o produto deixaria alguém barrado sem conseguir nem ler o que
 * mudou — e é justamente nesse momento que ela mais precisa ler.
 *
 * A lista é curta de propósito. Não entra a tela de entrar: para quem foi
 * barrado, conseguir digitar a senha só adia a mesma resposta.
 */
export const ROTAS_SEMPRE_ABERTAS: readonly string[] = ['/termos', '/privacidade'];

/**
 * A rota sobrevive ao bloqueio?
 *
 * Compara por prefixo de segmento, e não por "começa com": sem isso,
 * `/termos-de-parceria` passaria por ser filha de `/termos`, que ela não é.
 */
export function rotaSempreAberta(pathname: string): boolean {
  return ROTAS_SEMPRE_ABERTAS.some(
    (aberta) => pathname === aberta || pathname.startsWith(`${aberta}/`),
  );
}

/**
 * O que colocar na tela.
 *
 * ⚠️ A ordem das três perguntas é a regra, não uma otimização.
 *
 * 1. Rota sempre aberta vence tudo — inclusive a espera. Fazer Termos esperar
 *    pelo porteiro poria um carregando na frente de um documento estático.
 * 2. Sem resposta é ESPERA, e nunca bloqueio. "Ainda não sei" não é "não": a
 *    tela de bloqueio piscando em cima de todo mundo a cada carregamento seria
 *    pior que não ter bloqueio nenhum.
 * 3. Só então o veredito manda.
 */
export function queMostrar(estado: EstadoDaPorta): QueMostrar {
  if (rotaSempreAberta(estado.pathname)) return 'produto';
  if (estado.carregando || estado.veredito === null) return 'espera';
  return estado.veredito === 'barrado' ? 'bloqueio' : 'produto';
}
