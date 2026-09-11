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
  vence_em: string;
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
  /** `YYYY-MM-DD`. */
  venceEm: string;
  criadaEm: string;
  criadaPor: string | null;
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
          criadaEm: linha.criada_em,
          criadaPor: linha.criada_por,
        },
      ];
    })
    .sort((a, b) =>
      a.venceEm === b.venceEm ? a.id.localeCompare(b.id) : a.venceEm.localeCompare(b.venceEm),
    );
}

/**
 * Quantos dias antes do vencimento alguém entra na fila.
 *
 * Sete, o mesmo número de "está parado" no painel. Não é coincidência
 * procurada: é a semana, que é o ritmo em que o sócio olha esta tela.
 */
export const DIAS_PARA_COBRAR = 7;

/**
 * Quem precisa ser cobrado agora.
 *
 * Inclui as que JÁ venceram, e é o ponto principal: quem perdeu o acesso ontem
 * é mais urgente que quem perde daqui a seis dias, e uma fila que só mostra o
 * futuro deixa essa pessoa invisível justamente no dia em que ela some.
 */
export function aCobrar(
  assinaturas: Assinatura[],
  hoje: string,
  dias = DIAS_PARA_COBRAR,
): Assinatura[] {
  const limite = new Date(Date.parse(`${hoje}T12:00:00Z`) + dias * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return assinaturas.filter((a) => a.venceEm <= limite);
}
