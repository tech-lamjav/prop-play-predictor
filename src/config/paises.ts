/**
 * Os países que o cadastro oferece, com código de discagem.
 *
 * Existe porque o seletor de telefone tinha OITO países escritos à mão no JSX
 * da tela de entrar — e Peru e México, dois dos quatro do lançamento, não
 * estavam entre eles. Quem mora lá não conseguia cadastrar o telefone.
 *
 * ⚠️ A ORDEM É DELIBERADA, e não alfabética. Os cinco primeiros são a operação:
 * Brasil, de onde vem a base de hoje, e os quatro do lançamento. Lista
 * alfabética faria o peruano rolar até o P para achar o país dele num produto
 * que está indo atrás dele.
 *
 * Depois deles vem o resto da América Latina, e então os países de fora com
 * presença real na base — Portugal e Espanha pela língua, Estados Unidos e
 * Itália porque já estavam no seletor antigo e alguém os escolheu um dia.
 *
 * O `codigo` é ISO 3166-1 alfa-2, que é o mesmo vocabulário que a resolução de
 * país por IP usa no backend. É o que permite um dia pré-selecionar daqui sem
 * tradutor no meio — e é também por ele que a bandeira busca a imagem.
 *
 * ⚠️ NÃO EXISTE CAMPO DE EMOJI AQUI, E JÁ EXISTIU. A primeira versão guardava
 * a bandeira como emoji, e no Windows ela aparecia como "BR", "PE", "AR": o
 * sistema não tem fonte de bandeira e desenha as duas letras do indicador
 * regional. Funcionava na máquina de quem escreveu e não na de quem ia usar.
 * Quem desenha bandeira é `BandeiraDoPais`, por imagem.
 */
export interface Pais {
  /** ISO 3166-1 alfa-2, o mesmo código que o backend usa. */
  codigo: string;
  /**
   * O nome em português, usado APENAS como recuo.
   *
   * ⚠️ Não é isto que a tela mostra: quem mostra é `nomeDoPais`, que pergunta
   * ao navegador o nome no idioma ativo. Este campo só entra se a API não
   * existir ou não conhecer o código.
   */
  nome: string;
  /** Código de discagem internacional, com o sinal. */
  ddi: string;
}

/** A operação: o país de origem e os quatro do lançamento. */
export const PAISES_DA_OPERACAO: Pais[] = [
  { codigo: 'BR', nome: 'Brasil', ddi: '+55' },
  { codigo: 'PE', nome: 'Peru', ddi: '+51' },
  { codigo: 'AR', nome: 'Argentina', ddi: '+54' },
  { codigo: 'MX', nome: 'México', ddi: '+52' },
  { codigo: 'CL', nome: 'Chile', ddi: '+56' },
];

/** O resto da América Latina, onde a expansão seguinte é plausível. */
const RESTO_DA_AMERICA_LATINA: Pais[] = [
  { codigo: 'CO', nome: 'Colômbia', ddi: '+57' },
  { codigo: 'UY', nome: 'Uruguai', ddi: '+598' },
  { codigo: 'PY', nome: 'Paraguai', ddi: '+595' },
  { codigo: 'BO', nome: 'Bolívia', ddi: '+591' },
  { codigo: 'EC', nome: 'Equador', ddi: '+593' },
  { codigo: 'VE', nome: 'Venezuela', ddi: '+58' },
  { codigo: 'CR', nome: 'Costa Rica', ddi: '+506' },
  { codigo: 'PA', nome: 'Panamá', ddi: '+507' },
  { codigo: 'GT', nome: 'Guatemala', ddi: '+502' },
  { codigo: 'DO', nome: 'República Dominicana', ddi: '+1' },
];

/** Fora da América Latina: língua, ou presença que já existia no seletor. */
const FORA_DA_AMERICA_LATINA: Pais[] = [
  { codigo: 'PT', nome: 'Portugal', ddi: '+351' },
  { codigo: 'ES', nome: 'Espanha', ddi: '+34' },
  { codigo: 'US', nome: 'Estados Unidos', ddi: '+1' },
  { codigo: 'IT', nome: 'Itália', ddi: '+39' },
  { codigo: 'GB', nome: 'Reino Unido', ddi: '+44' },
  { codigo: 'FR', nome: 'França', ddi: '+33' },
  { codigo: 'DE', nome: 'Alemanha', ddi: '+49' },
  { codigo: 'CA', nome: 'Canadá', ddi: '+1' },
  { codigo: 'AO', nome: 'Angola', ddi: '+244' },
  { codigo: 'MZ', nome: 'Moçambique', ddi: '+258' },
  { codigo: 'JP', nome: 'Japão', ddi: '+81' },
  { codigo: 'AU', nome: 'Austrália', ddi: '+61' },
];

export const PAISES: Pais[] = [
  ...PAISES_DA_OPERACAO,
  ...RESTO_DA_AMERICA_LATINA,
  ...FORA_DA_AMERICA_LATINA,
];

/** O país que o cadastro assume sem nenhum sinal: de onde vem a base de hoje. */
export const PAIS_PADRAO = 'BR';

export function paisPorCodigo(codigo: string): Pais | undefined {
  return PAISES.find((p) => p.codigo === codigo);
}

/**
 * Construir um `Intl.DisplayNames` custa; reusá-lo não.
 *
 * Mesma régua do cache de formatadores em `formato.ts`, e pelo mesmo motivo:
 * isto é chamado uma vez por país a cada repintura da lista — 27 construções
 * por quadro, se não guardasse.
 */
const nomeadores = new Map<string, Intl.DisplayNames>();

/**
 * O nome de um país NO IDIOMA DA TELA.
 *
 * ⚠️ Vem do navegador, e não de uma lista escrita à mão. A primeira versão
 * tinha os nomes em português cravados, e numa tela em espanhol aparecia
 * "Colômbia", "Espanha", "Alemanha". O `Intl` resolve de graça e acerta coisas
 * que a lista errava: em espanhol o Peru é "Perú", com acento.
 *
 * Nome de PAÍS segue o idioma da tela. Quem segue o endônimo — o jeito que o
 * próprio povo escreve — é o seletor de IDIOMA, e por isso lá está "Português"
 * e "Español" sempre, em qualquer tela. São convenções diferentes de propósito.
 *
 * O `nome` do catálogo fica como recuo, para o caso de o ambiente não ter a
 * API ou não conhecer o código.
 */
export function nomeDoPais(codigo: string, locale: string): string {
  const recuo = paisPorCodigo(codigo)?.nome ?? codigo;
  try {
    let nomeador = nomeadores.get(locale);
    if (!nomeador) {
      nomeador = new Intl.DisplayNames([locale], { type: 'region' });
      nomeadores.set(locale, nomeador);
    }
    return nomeador.of(codigo) ?? recuo;
  } catch {
    return recuo;
  }
}

/**
 * Os códigos de discagem, SEM repetição.
 *
 * ⚠️ Existe separado da lista de países porque código de discagem não é
 * país: Estados Unidos, Canadá e República Dominicana compartilham o `+1`.
 * Montar o seletor direto de `PAISES` punha três opções com o mesmo valor, e
 * um seletor com valor repetido não sabe qual foi escolhida — o React acusou
 * na primeira abertura da tela.
 *
 * Fica o primeiro de cada código, e a ordem de `PAISES` resolve qual: os
 * países da operação vêm antes, então o `+1` aparece como Estados Unidos e
 * não como República Dominicana.
 */
export const DDIS: Pais[] = PAISES.filter(
  (p, i) => PAISES.findIndex((o) => o.ddi === p.ddi) === i,
);

/**
 * O código de discagem de um país.
 *
 * ⚠️ Separado do país de propósito: gente mora num país e tem telefone de
 * outro — brasileiro em Lima costuma manter o número do Brasil. O país escolhido
 * SUGERE o código, e a pessoa pode trocar.
 */
export function ddiDoPais(codigo: string): string {
  return paisPorCodigo(codigo)?.ddi ?? '+55';
}
