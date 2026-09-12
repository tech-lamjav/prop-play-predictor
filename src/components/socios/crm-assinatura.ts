import type { Cadastro } from './crm-lista';
import { PLANOS_A_VENDER, type PlanoAVender } from './crm-vocabulario';

// ============================================================================
// A fila de cobrança
// ============================================================================
// Uma assinatura dada na mão não renova sozinha: ela vence. Se ninguém falar
// com a pessoa antes, o acesso some um dia e a conversa acontece tarde, quando
// ela já está sem o produto e sem motivo nenhum para voltar.
//
// Este módulo transforma as linhas de `crm_assinatura_manual` na fila de quem
// precisa ser cobrado, na ordem em que vence. Tudo puro; quem desenha não faz
// conta nenhuma.
// ============================================================================

/** Uma linha de `crm_assinatura_manual`, como o banco devolve. */
export interface AssinaturaDoBanco {
  id: string;
  user_id: string;
  plano: string;
  vence_em: string | null;
  /** `numeric` chega como texto no PostgREST. */
  valor_mensal: string | number | null;
  criada_em: string;
  criada_por: string | null;
}

export interface Assinatura {
  id: string;
  userId: string;
  /** O nome, ou o e-mail quando não há nome. A linha precisa de alguém nela. */
  pessoa: string;
  whatsapp: string | null;
  plano: PlanoAVender;
  /**
   * `YYYY-MM-DD`, ou nulo quando é VITALÍCIA.
   *
   * Nulo é a resposta certa, e não uma data de 2099: uma data inventada o resto
   * do sistema trataria como verdade, ordenando a fila por ela e um dia
   * chegando nela.
   */
  venceEm: string | null;
  /**
   * Quanto a pessoa paga por mês, ou nulo quando NÃO HÁ COBRANÇA.
   *
   * ⚠️ Outra pergunta, e não a mesma de `venceEm`. Vitalícia com valor é quem
   * paga todo mês e nunca perde o acesso por atraso; com data e sem valor é
   * acesso dado na mão por um tempo. As quatro combinações existem.
   */
  valorMensal: number | null;
  criadaEm: string;
  criadaPor: string | null;
}

/** Nunca vence. O nome existe para a condição não aparecer solta na tela. */
export function ehVitalicia(a: Pick<Assinatura, 'venceEm'>): boolean {
  return a.venceEm === null;
}

const CONHECIDOS = new Set<string>(PLANOS_A_VENDER);

/**
 * O plano gravado, ou nulo.
 *
 * Nulo, e não um padrão. A restrição da tabela já recusa outra coisa, mas se um
 * dia ela for afrouxada, chutar "entrada" faria a tela cobrar a pessoa pelo
 * plano errado — e a mensagem pronta sairia com o nome errado dentro.
 */
function planoConhecido(bruto: string): PlanoAVender | null {
  return CONHECIDOS.has(bruto) ? (bruto as PlanoAVender) : null;
}

/**
 * Junta as concessões com quem são as pessoas.
 *
 * Quem não estiver na base some da lista de propósito, pela mesma razão dos
 * feedbacks: uma cobrança sem dono é uma cobrança que ninguém consegue mandar,
 * e mostrá-la com um identificador cru só ocuparia espaço.
 *
 * Ordena por quem vence primeiro. Essa ordem É o produto desta tela: a fila de
 * cobrança lida de cima para baixo tem que começar por quem está mais perto de
 * perder o acesso.
 *
 * As vitalícias vão para o fim. Elas não vencem, então não competem por
 * urgência com ninguém, e ordenar nulo junto com datas colocaria quem nunca
 * perde o acesso na frente de quem perde amanhã.
 */
export function montarAssinaturas(
  linhas: AssinaturaDoBanco[],
  cadastros: Cadastro[],
): Assinatura[] {
  const porId = new Map(cadastros.map((c) => [c.id, c]));

  return linhas
    .flatMap((linha) => {
      const pessoa = porId.get(linha.user_id);
      const plano = planoConhecido(linha.plano);
      if (!pessoa || !plano) return [];
      return [
        {
          id: linha.id,
          userId: linha.user_id,
          pessoa: pessoa.name?.trim() || pessoa.email,
          whatsapp: pessoa.whatsapp_number,
          plano,
          venceEm: linha.vence_em,
          valorMensal: linha.valor_mensal === null ? null : Number(linha.valor_mensal),
          criadaEm: linha.criada_em,
          criadaPor: linha.criada_por,
        },
      ];
    })
    .sort((a, b) => {
      /*
       * A vitalícia vai para o fim.
       *
       * Ela não vence, então não disputa urgência com ninguém: ordenar nulo
       * junto com as datas colocaria quem nunca perde o acesso na frente de
       * quem perde amanhã. Entre duas vitalícias o desempate continua sendo o
       * identificador, como entre duas datas iguais.
       */
      if (a.venceEm === null || b.venceEm === null) {
        if (a.venceEm === b.venceEm) return a.id.localeCompare(b.id);
        return a.venceEm === null ? 1 : -1;
      }
      return a.venceEm === b.venceEm
        ? a.id.localeCompare(b.id)
        : a.venceEm.localeCompare(b.venceEm);
    });
}

/**
 * Quantos dias antes do vencimento alguém entra na fila.
 *
 * Sete, o mesmo número de "está parado" no painel. Não é coincidência
 * procurada: é a semana, que é o ritmo em que o sócio olha esta tela.
 */
export const DIAS_PARA_COBRAR = 7;

/**
 * Uma assinatura que tem data de fim.
 *
 * O tipo existe para a tela de cobrança não ter que checar de novo se a data
 * está lá: quem sai de `aCobrar` sempre tem, porque quem não tem não é cobrado
 * por vencimento.
 */
export type AssinaturaQueVence = Assinatura & { venceEm: string };

/**
 * Quem precisa ser cobrado agora.
 *
 * Inclui as que JÁ venceram, e é o ponto principal: quem perdeu o acesso ontem
 * é mais urgente que quem perde daqui a seis dias, e uma fila que só mostra o
 * futuro deixa essa pessoa invisível justamente no dia em que ela some.
 *
 * ⚠️ Vitalícia nunca entra. Não é esquecimento: esta fila é a de VENCIMENTO, e
 * quem não vence não tem o que vencer. Quem é vitalício e paga por mês pode
 * ficar devendo, e essa é a fila de INADIMPLÊNCIA, que sai dos meses em aberto
 * e não de uma data.
 */
export function aCobrar(
  assinaturas: Assinatura[],
  hoje: string,
  dias = DIAS_PARA_COBRAR,
): AssinaturaQueVence[] {
  const limite = new Date(Date.parse(`${hoje}T12:00:00Z`) + dias * 86_400_000)
    .toISOString()
    .slice(0, 10);
  /*
   * O `!== null` é escrito, e não deixado por conta da comparação.
   *
   * `null <= '2026-09-19'` já dá falso em JavaScript, porque os dois viram
   * número e a data vira `NaN` — então a vitalícia ficaria de fora de qualquer
   * jeito. Mas ficaria de fora por acidente de conversão, e não por uma regra:
   * quem trocasse a comparação por uma de datas de verdade veria a vitalícia
   * aparecer na fila sem nenhum aviso. Escrito, ele também é o que estreita o
   * tipo para `AssinaturaQueVence`.
   */
  return assinaturas.filter(
    (a): a is AssinaturaQueVence => a.venceEm !== null && a.venceEm <= limite,
  );
}
