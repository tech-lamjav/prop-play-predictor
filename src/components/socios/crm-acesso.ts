import type { Pessoa } from './crm-ficha';
import { temAcessoAoFutebol } from '@/utils/futebol-acesso';
import { brtDayOf } from '@/utils/futebol-datas';

// ============================================================================
// Acesso dado na mão
// ============================================================================
// A primeira ESCRITA do CRM na tabela de usuários. Até aqui o sócio só lia.
//
// ⚠️ As colunas mexidas aqui são as mesmas que o webhook do Stripe escreve. Um
// acesso dado na mão sobrevive até o Stripe falar sobre aquela pessoa, e aí ele
// vence — é ele quem manda, e tem que continuar mandando, senão um erro do CRM
// viraria assinatura eterna de graça. A tela diz isso em voz alta, porque é o
// tipo de coisa que só aparece três semanas depois, quando alguém pergunta por
// que o acesso do fulano sumiu.
//
// O que este módulo faz é vocabulário e regra pura. Quem escreve é a migration
// 129, e ela não aceita nome de coluna vindo do cliente: recebe o id de um
// produto desta lista e decide sozinha o que mexer.
// ============================================================================

export type ProdutoEditavel = {
  /** O que a função do banco espera. Precisa existir como ramo lá dentro. */
  id: 'betinho' | 'futebol' | 'analises' | 'relatorios';
  nome: string;
  /**
   * Por que este produto não tem campo de data, quando não tem.
   *
   * A frase, e não um booleano. Com `temPrazo: false` os dois produtos sem
   * prazo dividiam a mesma explicação, e ela falava do futebol — a linha dos
   * relatórios dizia que o banco não guarda o prazo DO FUTEBOL, que é verdade
   * e não é sobre ela. Os motivos são diferentes e a tela precisa dizer o certo
   * onde o sócio escolhe, não depois.
   *
   * Ausente significa que o produto tem prazo e ganha o campo de data.
   */
  semPrazoPorque?: string;
};

/**
 * ⚠️ "Relatórios" não é assinatura: é a marca `has_report_access`, um sim ou
 * não escrito na mão que ABRE os relatórios sem passar pelo Stripe. Ele existia
 * no banco desde antes do CRM, `use-report-access` consulta ele antes de olhar
 * qualquer assinatura, e a ficha não mostrava. O resultado é que uma conta
 * liberada por ele aparecia aqui como "sem acesso" enquanto o produto deixava a
 * pessoa entrar — e foi assim que a ficha pareceu não bater com o banco.
 */
export const PRODUTOS_EDITAVEIS: readonly ProdutoEditavel[] = [
  { id: 'betinho', nome: 'Betinho' },
  {
    id: 'futebol',
    nome: 'Futebol',
    semPrazoPorque: 'O banco não guarda prazo do futebol. Liberado aqui vale até alguém tirar.',
  },
  { id: 'analises', nome: 'Análises' },
  {
    id: 'relatorios',
    nome: 'Relatórios',
    semPrazoPorque: 'É uma marca de sim ou não, sem prazo. Vale até alguém tirar.',
  },
];

/** Quantos dias dura o teste gratuito do futebol. O mesmo de `futebol-acesso`. */
export const DIAS_DE_TESTE = 7;

/**
 * O estado atual de um produto, do jeito que o formulário precisa.
 *
 * Nasce da mesma linha que a ficha desenha: o formulário abre mostrando o que
 * já vale, e não em branco. Um formulário em branco sobre um acesso que existe
 * é um convite a apagá-lo sem querer.
 */
export interface AcessoAtual {
  ativo: boolean;
  /** `YYYY-MM-DD`, ou vazio quando não há prazo guardado. */
  ate: string;
}

/**
 * `2026-10-12T03:00:00Z` vira `2026-10-12`. Vazio quando não há data.
 *
 * Pelo dia de BRASÍLIA, e não por `toISOString`. Uma renovação marcada para as
 * 23h do dia 30 aqui é o dia 1º em Greenwich, e o campo mostraria a data
 * errada por um dia — sempre para frente, e só em algumas contas.
 */
function comoDiaDoFormulario(bruto: string | null): string {
  return brtDayOf(bruto) ?? '';
}

export function acessoAtual(p: Pessoa, produto: ProdutoEditavel['id']): AcessoAtual {
  if (produto === 'betinho') {
    return {
      ativo: p.betinho_subscription_status === 'premium',
      ate: comoDiaDoFormulario(p.betinho_subscription_period_end),
    };
  }
  if (produto === 'analises') {
    return {
      ativo: p.analytics_subscription_status === 'premium',
      ate: comoDiaDoFormulario(p.analytics_subscription_period_end),
    };
  }
  if (produto === 'relatorios') {
    // Marca booleana, sem status nem prazo. `?? false` porque a coluna aceita
    // nulo, e nulo aqui é "não", não "não sei".
    return { ativo: p.has_report_access ?? false, ate: '' };
  }
  // Futebol: o status sozinho, sem o teste. O teste tem controle próprio, e
  // juntar os dois num interruptor só faria desligar o premium apagar o teste.
  return { ativo: p.futebol_subscription_status === 'premium', ate: '' };
}

/**
 * O teste gratuito de alguém, em palavras.
 *
 * Três estados, e não dois: nunca começou, está correndo, já venceu. Juntar os
 * dois últimos num "desligado" esconderia o caso em que o teste JÁ foi usado —
 * que é justamente o que o sócio precisa saber antes de dar outro.
 */
export type EstadoDoTeste =
  | { tipo: 'nunca' }
  | { tipo: 'correndo'; terminaEm: string; diasRestantes: number }
  | { tipo: 'vencido'; terminouEm: string };

const UM_DIA = 24 * 60 * 60 * 1000;

export function estadoDoTeste(p: Pessoa, agora = Date.now()): EstadoDoTeste {
  if (!p.futebol_trial_started_at) return { tipo: 'nunca' };

  const inicio = new Date(p.futebol_trial_started_at).getTime();
  if (Number.isNaN(inicio)) return { tipo: 'nunca' };

  const fim = inicio + DIAS_DE_TESTE * UM_DIA;
  // Dia de Brasília aqui também: um teste que vence às 22h do dia 17 daqui
  // cairia no dia 18 por `toISOString`, e a tela prometeria um dia a mais.
  const dia = brtDayOf(new Date(fim).toISOString()) ?? '';

  if (fim <= agora) return { tipo: 'vencido', terminouEm: dia };
  return { tipo: 'correndo', terminaEm: dia, diasRestantes: Math.ceil((fim - agora) / UM_DIA) };
}

/**
 * A pessoa entra no futebol agora?
 *
 * Reexportado daqui porque a tela de edição precisa responder isso DEPOIS de
 * mexer, e a regra é a mesma que a ficha já usa. Duas contas do mesmo acesso
 * divergiriam no dia em que o prazo mudasse.
 */
export function entraNoFutebol(p: Pessoa, agora = Date.now()): boolean {
  return temAcessoAoFutebol(p.futebol_subscription_status, p.futebol_trial_started_at, agora);
}
