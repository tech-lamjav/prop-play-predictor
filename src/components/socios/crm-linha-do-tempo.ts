import { TIPOS_NA_LINHA_DO_TEMPO, type TipoNaLinhaDoTempo } from './crm-vocabulario';

// ============================================================================
// A linha do tempo de uma pessoa
// ============================================================================
// Anotações e mudanças de etapa na MESMA lista, e isso é decisão de produto:
// a mudança de etapa quase sempre é consequência do que foi anotado logo antes,
// e separá-las obriga o sócio a remontar a conversa na cabeça.
//
// A junção acontece aqui, no navegador, e não numa consulta que una as duas
// tabelas. São duas listas curtas por pessoa, e uma união no banco custaria uma
// função nova para economizar uma consulta que ninguém sente.
// ============================================================================

/** Uma linha de `crm_anotacao`, como o banco devolve. */
export interface AnotacaoDoBanco {
  id: string;
  tipo: string;
  texto: string;
  criada_em: string;
  criada_por: string | null;
}

/** Uma linha de `crm_etapa_evento`, como o banco devolve. */
export interface EventoDeEtapa {
  id: string;
  de: string | null;
  para: string;
  em: string;
  por: string | null;
}

export type ItemDaLinhaDoTempo =
  | {
      natureza: 'anotacao';
      id: string;
      em: string;
      por: string | null;
      /** O mesmo `tipo` da coluna e do glossário, `acesso` incluído. */
      tipo: TipoNaLinhaDoTempo;
      texto: string;
    }
  | {
      natureza: 'etapa';
      id: string;
      em: string;
      por: string | null;
      de: string | null;
      para: string;
    };

const TIPOS_CONHECIDOS = new Set<string>(TIPOS_NA_LINHA_DO_TEMPO);

/**
 * O tipo gravado, ou o padrão.
 *
 * A coluna tem restrição no banco, mas ela pode ser afrouxada por migration
 * futura sem ninguém lembrar daqui — e um tipo desconhecido desenharia um
 * rótulo `undefined` ao lado do texto da pessoa. Foi exatamente o que a
 * migration 129 fez ao acrescentar `acesso`, e a rede aqui segurou.
 */
function tipoConhecido(bruto: string): TipoNaLinhaDoTempo {
  return TIPOS_CONHECIDOS.has(bruto) ? (bruto as TipoNaLinhaDoTempo) : 'anotacao';
}

/**
 * Junta os dois, do mais recente para o mais antigo.
 *
 * O desempate pelo identificador não é preciosismo: uma anotação escrita no
 * mesmo instante em que a etapa mudou — que é o caso comum, porque uma coisa
 * leva à outra — ficaria em ordem aleatória, e a lista se reordenaria sozinha
 * entre dois carregamentos.
 */
export function linhaDoTempo(
  anotacoes: AnotacaoDoBanco[],
  eventos: EventoDeEtapa[],
): ItemDaLinhaDoTempo[] {
  const itens: ItemDaLinhaDoTempo[] = [
    ...anotacoes.map((a): ItemDaLinhaDoTempo => ({
      natureza: 'anotacao',
      id: a.id,
      em: a.criada_em,
      por: a.criada_por,
      tipo: tipoConhecido(a.tipo),
      texto: a.texto,
    })),
    ...eventos.map((e): ItemDaLinhaDoTempo => ({
      natureza: 'etapa',
      id: e.id,
      em: e.em,
      por: e.por,
      de: e.de,
      para: e.para,
    })),
  ];

  return itens.sort((a, b) =>
    a.em === b.em ? a.id.localeCompare(b.id) : b.em.localeCompare(a.em),
  );
}

/**
 * Só os feedbacks.
 *
 * Existe porque o feedback nasce dentro de uma conversa e é ali que ele faz
 * sentido — mas quando alguém pergunta "o que estão achando do produto", ler a
 * conversa inteira de trinta leads não é resposta.
 */
export function soFeedbacks(itens: ItemDaLinhaDoTempo[]): ItemDaLinhaDoTempo[] {
  return itens.filter((i) => i.natureza === 'anotacao' && i.tipo === 'feedback');
}

/**
 * O que dizer ao sócio quando a escrita falha.
 *
 * A função do banco levanta duas exceções diferentes, e mandar "tente de novo"
 * para as duas é conselho errado numa delas: quem perdeu a marca de sócio pode
 * tentar a noite inteira que não vai gravar.
 */
export function mensagemDoErro(erro: unknown): string {
  const texto = String((erro as { message?: string } | null)?.message ?? '');
  if (texto.includes('apenas socios')) {
    return 'Sua conta não está mais marcada como sócio. Fale com o outro sócio.';
  }
  if (texto.includes('anotacao vazia')) return 'A anotação está vazia.';
  return 'Não deu para registrar. Tente de novo.';
}

/** Um feedback com o nome de quem falou, para a lista geral. */
export interface FeedbackNaLista {
  id: string;
  userId: string;
  /** O nome da pessoa, ou o e-mail quando não há nome. */
  pessoa: string;
  quando: string;
  autor: string | null;
  texto: string;
}

/**
 * Todos os feedbacks da base, do mais recente para o mais antigo.
 *
 * Feedback nasce dentro de uma conversa, e é lá que ele faz sentido para
 * trabalhar aquele lead. Mas quando a pergunta é "o que estão achando do
 * produto", ler a conversa inteira de trinta pessoas não é resposta — e é para
 * essa pergunta que esta lista existe.
 *
 * Quem não estiver no mapa de nomes some da lista de propósito: um feedback sem
 * dono é um feedback que ninguém consegue responder, e mostrá-lo com um
 * identificador cru só ocuparia espaço.
 */
export function montarFeedbacks(
  anotacoes: (AnotacaoDoBanco & { user_id: string })[],
  nomes: Record<string, string | undefined>,
): FeedbackNaLista[] {
  return anotacoes
    .filter((a) => a.tipo === 'feedback' && nomes[a.user_id])
    .map((a) => ({
      id: a.id,
      userId: a.user_id,
      pessoa: nomes[a.user_id]!,
      quando: a.criada_em,
      autor: a.criada_por,
      texto: a.texto,
    }))
    .sort((a, b) =>
      a.quando === b.quando ? a.id.localeCompare(b.id) : b.quando.localeCompare(a.quando),
    );
}
