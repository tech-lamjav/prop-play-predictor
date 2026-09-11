import { temAcessoAoFutebol } from '@/utils/futebol-acesso';
import type { Cadastro } from './crm-lista';

// ============================================================================
// A ficha de uma pessoa
// ============================================================================
// Funções puras sobre a linha do banco. A tela desenha o que sai daqui.
//
// O que mora aqui é o que o banco CONSEGUE dizer sobre alguém. O que ele não
// consegue — de onde a pessoa veio, quantas vezes entrou, quanto tempo ficou —
// não tem função nenhuma aqui de propósito: isso só existe no PostHog, e a
// entrada dele está na issue #397.
// ============================================================================

/**
 * A linha do banco pela ótica da ficha.
 *
 * Estende o `Cadastro` da lista em vez de repetir os oito campos dele: a ficha
 * mostra tudo que a lista mostra, e mais. Duas listas separadas divergiriam no
 * dia em que uma coluna mudasse de nome.
 */
export interface Pessoa extends Cadastro {
  telegram_username: string | null;
  betinho_subscription_period_end: string | null;
  analytics_subscription_period_end: string | null;
  /** Marca escrita na mão que abre os relatórios sem passar pelo Stripe. */
  has_report_access: boolean | null;
}

/** O que o banco sabe sobre as apostas de alguém, e nada além disso. */
export interface ResumoDeApostas {
  total: number;
  ultima: string | null;
}

export type TipoDeGancho = 'betinho' | 'futebol' | 'nba' | 'indefinido';

/**
 * Um degrau da escada de planos: como se chama, e para onde ele aponta.
 *
 * Nome e gancho na MESMA entrada de propósito. Antes eram duas tabelas com as
 * mesmas chaves — o mapa de nomes e a cascata do gancho —, e um plano novo
 * obrigava a lembrar dos dois. Esquecer o segundo não quebrava nada: o gancho
 * simplesmente caía no galho seguinte, calado.
 */
interface Plano {
  nome: string;
  gancho: TipoDeGancho;
  porque: string;
}

const ENTRADA: Plano = {
  nome: 'Entrada',
  gancho: 'betinho',
  porque: 'assinou o Entrada, que é só o Betinho',
};
const ESSENCIAL: Plano = {
  nome: 'Essencial',
  gancho: 'futebol',
  porque: 'assinou o Essencial, que é o plano do futebol',
};
const COMPLETO: Plano = {
  nome: 'Completo',
  gancho: 'nba',
  porque: 'assinou o Completo, que é o plano da NBA',
};
const ANALISES: Plano = {
  nome: 'Análises (plano antigo)',
  gancho: 'nba',
  porque: 'assinou o plano antigo de análises',
};

/**
 * Os apelidos legados — `betinho`, `futebol`, `analytics`, `platform` — vivem no
 * metadata das assinaturas ativas no Stripe e não podem ser removidos sem
 * quebrar a renovação de quem já paga. Está explicado em `shared/concessoes.ts`.
 */
const PLANOS: Record<string, Plano> = {
  entrada: ENTRADA,
  betinho: ENTRADA,
  essencial: ESSENCIAL,
  futebol: ESSENCIAL,
  completo: COMPLETO,
  analytics: ANALISES,
  platform: ANALISES,
};

function planoDe(bruto: string | null | undefined): Plano | null {
  return PLANOS[(bruto ?? '').trim().toLowerCase()] ?? null;
}

/**
 * O nome do plano, traduzido.
 *
 * Valor desconhecido devolve nulo em vez de um chute: só capitalizar o valor
 * cru mostraria "Platform" na tela do sócio. A ficha diz que não identificou e
 * mostra o valor bruto, que é o que ajuda a investigar.
 */
export function nomeDoPlano(bruto: string | null | undefined): string | null {
  return planoDe(bruto)?.nome ?? null;
}

/**
 * O que o gancho precisa saber, e nada além.
 *
 * Assim a LISTA calcula o gancho com o que já trouxe do banco, sem precisar do
 * resto da ficha de cada pessoa.
 */
export type SinaisDoGancho = Pick<
  Cadastro,
  | 'telegram_synced'
  | 'subscription_product_type'
  | 'futebol_trial_started_at'
  | 'futebol_publication_alerts_ack_at'
>;

/**
 * O nome curto de cada gancho, para caber numa célula de tabela.
 *
 * `Record<TipoDeGancho, …>` e não `Record<string, …>`: com string solta, um
 * gancho novo cai calado num traço, e ninguém descobre até alguém reparar que
 * a coluna nunca mostra o valor novo.
 */
export const NOME_DO_GANCHO: Record<TipoDeGancho, string> = {
  betinho: 'Betinho',
  futebol: 'Futebol',
  nba: 'NBA',
  indefinido: '—',
};

export interface Gancho {
  tipo: TipoDeGancho;
  /** Em que sinal o palpite se apoiou. A tela mostra, para o sócio poder discordar. */
  porque: string;
  /**
   * A consulta de apostas não respondeu.
   *
   * Importa porque a aposta é o sinal MAIS FORTE e o primeiro da fila: sem ela,
   * qualquer palpite abaixo pode estar apontando para o lado errado. A tela
   * avisa em vez de deixar o sócio confiar num palpite manco.
   */
  apostasDesconhecidas: boolean;
}

/**
 * O palpite sobre o que atraiu a pessoa.
 *
 * As regras são ordenadas, e a ordem é a tese: **uso de verdade vence o plano**.
 * Foi o caso que originou o CRM — um assinante do Essencial cujo olho brilhou no
 * Betinho. Pelo plano, a abordagem falaria de futebol e erraria o alvo.
 *
 * ⚠️ `futebol_publication_alerts_enabled` NÃO entra aqui, e é a armadilha mais
 * fácil desta função: a coluna nasce com `default true`, então toda a base tem.
 * Usá-la como sinal marcaria todo mundo como futebol.
 *
 * `apostas` nulo significa que a consulta falhou, e NÃO que a pessoa não
 * apostou. Os dois casos caíam no mesmo lugar antes, e o palpite dizia "não deu
 * sinal nenhum" com a cara de quem tinha conferido.
 */
export function ganchoDe(p: SinaisDoGancho, apostas: ResumoDeApostas | null): Gancho {
  const apostasDesconhecidas = apostas === null;
  const gancho = (tipo: TipoDeGancho, porque: string): Gancho => ({
    tipo,
    porque,
    apostasDesconhecidas,
  });

  if (apostas && apostas.total > 0) {
    return gancho('betinho', `registrou ${apostas.total} apostas no Betinho`);
  }
  if (p.futebol_trial_started_at) {
    return gancho('futebol', 'começou o teste gratuito do futebol');
  }
  if (p.futebol_publication_alerts_ack_at) {
    return gancho('futebol', 'leu a explicação dos alertas de futebol');
  }

  const plano = planoDe(p.subscription_product_type);
  if (plano) return gancho(plano.gancho, plano.porque);

  if (p.telegram_synced) return gancho('betinho', 'vinculou o Telegram');

  return gancho('indefinido', 'ainda não deu sinal nenhum no produto');
}

/**
 * O primeiro nome, ou nulo.
 *
 * Nulo e não string vazia: a mensagem pronta preenche a saudação com isto, e
 * string vazia vira "Oi, !".
 */
export function primeiroNome(nome: string | null): string | null {
  const inteiro = (nome ?? '').trim();
  if (!inteiro) return null;
  return inteiro.split(/\s+/)[0];
}
