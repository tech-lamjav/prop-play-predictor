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

/** As duas coisas que podem estar na tela. */
export type QueMostrar = 'produto' | 'bloqueio';

/** O que aconteceu com a pessoa. Não existe meio acesso. */
export type Veredito = 'entrou' | 'barrado';

/** O que o endereço disse. É observação, e é o que vira prova. */
export type OrigemDoRegistro = 'brasil' | 'fora' | 'nao_sei';

export interface EstadoDaPorta {
  /**
   * O veredito devolvido, ou null enquanto não há resposta.
   *
   * Não existe campo de "carregando" aqui de propósito: sem resposta e com
   * resposta de que entrou levam ao MESMO lugar, então distingui-los seria
   * convidar alguém a tratá-los diferente.
   */
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
 * ⚠️ **Só o veredito `barrado` tira alguém do produto.** Enquanto a resposta
 * não chegou, a tela mostra o produto — e não uma espera.
 *
 * A primeira versão disto punha um carregando na frente de todo mundo até o
 * porteiro responder, e estava errada por dois motivos que só apareceram na
 * revisão. Com a chave do bloqueio DESLIGADA ninguém nunca é barrado, então
 * aquela espera não comprava nada e mesmo assim cobrava uma ida à rede de cada
 * pessoa do mundo, inclusive na página pública. E ela contradizia o resto do
 * desenho: em todo outro lugar deste sistema, não saber deixa entrar.
 *
 * O que a espera existia para evitar continua evitado: a tela de bloqueio nunca
 * aparece antes de haver resposta. Quem for barrado vê o produto por um
 * instante e então a explicação — e a sessão dessa pessoa já está sendo
 * derrubada do outro lado.
 */
export function queMostrar(estado: EstadoDaPorta): QueMostrar {
  if (rotaSempreAberta(estado.pathname)) return 'produto';
  return estado.veredito === 'barrado' ? 'bloqueio' : 'produto';
}
