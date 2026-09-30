/**
 * A política do porteiro, inteira, numa função pura.
 *
 * Spec em #548, ticket #550.
 *
 * Mora separada do handler porque é a única parte que decide alguma coisa. O
 * resto da função é encanamento: ler cabeçalho, consultar tabela, gravar linha.
 * Se um dia a regra mudar — e ela vai, porque a data de 5 de outubro é de
 * negócio e não de engenharia — é este arquivo que muda, e são estes testes que
 * cobram.
 */
import type { RespostaDeOrigem } from '../shared/faixas-do-brasil.ts';

/** O que o endereço disse. É observação, e é o que vira prova. */
export type OrigemObservada = 'brasil' | 'fora' | 'nao_sei';

/** O que aconteceu com a pessoa. Não existe meio acesso. */
export type Veredito = 'entrou' | 'barrado';

export interface EstadoDoPorteiro {
  /** A resposta da lista de faixas para o endereço que chegou. */
  readonly origem: RespostaDeOrigem;
  /** A chave em ops_config. Desligada, ninguém é barrado. */
  readonly bloqueioLigado: boolean;
  /** Sócio atravessa. O passe é da PESSOA, não do endereço. */
  readonly ehSocio: boolean;
}

export interface DecisaoDoPorteiro {
  readonly origem: OrigemObservada;
  readonly veredito: Veredito;
}

/**
 * Traduz a resposta da lista para a palavra que fica guardada.
 *
 * Os nomes mudam de propósito: a lista responde sobre o BRASIL (`sim`/`nao`),
 * o registro fala sobre a PESSOA (`brasil`/`fora`). Guardar 'sim' numa coluna
 * chamada origem obrigaria quem lê a lembrar qual era a pergunta.
 */
function observar(resposta: RespostaDeOrigem): OrigemObservada {
  if (resposta === 'sim') return 'brasil';
  if (resposta === 'nao') return 'fora';
  return 'nao_sei';
}

/**
 * Quem entra e quem não entra.
 *
 * ⚠️ Barrar exige TRÊS coisas ao mesmo tempo: a chave ligada, a pessoa não ser
 * sócia, e o endereço ser brasileiro com certeza. Qualquer dúvida em qualquer
 * uma delas deixa entrar.
 *
 * O fail-open é deliberado e tem um preço aceito: com a lista local não existe
 * serviço de terceiro para cair, então um `nao_sei` é defeito nosso — e trancar
 * todo mundo por causa de um defeito é pior do que deixar passar alguém que
 * será verificado na sessão seguinte. O que torna isso seguro é o alarme
 * (#554): fail-open contado é uma escolha, fail-open silencioso é um bloqueio
 * que morreu sem ninguém ver.
 */
export function decidir(estado: EstadoDoPorteiro): DecisaoDoPorteiro {
  const origem = observar(estado.origem);

  const barrado = estado.bloqueioLigado && !estado.ehSocio && origem === 'brasil';

  return { origem, veredito: barrado ? 'barrado' : 'entrou' };
}
