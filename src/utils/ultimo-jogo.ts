import type { TFunction } from 'i18next';

/**
 * A frase do último jogo do jogador, no idioma da tela.
 *
 * ⚠️ É CONTORNO DE UM CONTRATO DO BANCO, E NÃO O CONSERTO. O campo
 * `last_game_text` chega PRONTO, em português, de um pipeline que mora fora
 * deste repositório: "Ultimo Jogo: 14 dias atras". Não vem a data nem o número
 * de dias separados, então a tela não tem como montar a frase em outro idioma.
 * O conserto de verdade é o pipeline mandar o número de dias.
 *
 * Enquanto isso, este reconhece a forma que a medição mostrou e monta a frase
 * traduzida. Qualquer coisa fora dessa forma volta como veio: nunca fica pior
 * do que estava.
 *
 * Em português devolve o texto do banco intocado — a regra da migração é que
 * em português nada muda, e reescrever aqui trocaria a frase que a base de hoje
 * já lê.
 */
const FORMA_MEDIDA = /^\s*[uú]ltimo jogo:\s*(\d+)\s*dias?\s*atr[aá]s\s*$/i;
const HOJE = /^\s*[uú]ltimo jogo:\s*hoje\s*$/i;
const ONTEM = /^\s*[uú]ltimo jogo:\s*ontem\s*$/i;

export function ultimoJogoNoIdioma(
  texto: string | null | undefined,
  idioma: string,
  t: TFunction<'nba'>,
): string | null {
  if (!texto) return null;
  if (idioma.startsWith('pt')) return texto;

  const dias = FORMA_MEDIDA.exec(texto);
  if (dias) return t('jogador.ultimoJogoHaDias', { count: Number(dias[1]) });
  if (HOJE.test(texto)) return t('jogador.ultimoJogoHoje');
  if (ONTEM.test(texto)) return t('jogador.ultimoJogoOntem');
  return texto;
}
