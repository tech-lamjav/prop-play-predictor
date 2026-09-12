import { temAcessoAoFutebol } from '@/utils/futebol-acesso';
import { diasEntre } from '@/utils/futebol-datas';
import type { Cadastro } from './crm-lista';

// ============================================================================
// Etiquetas: o que o produto diz sobre a pessoa
// ============================================================================
// Eixo SEPARADO da etapa, e é essa separação que faz este arquivo existir.
//
// A etapa responde "até onde a conversa chegou", e quem move é o sócio. A
// etiqueta responde "o que a conta dessa pessoa é agora", e quem responde é o
// banco. As duas valem ao mesmo tempo: alguém pode estar em teste E em
// nutrição, e essas são duas informações diferentes sobre a mesma pessoa.
//
// ⚠️ "Em teste" já foi POSIÇÃO do funil, e era errado. Como posição calculada
// ela vencia a etapa manual na tela: quem estava em teste aparecia como "Em
// teste" e a etapa ficava invisível. Em produção isso escondia a conversa de 59
// pessoas de uma vez — justamente as mais quentes, que estão usando o produto
// agora. O Victor apontou isso olhando a tela: "acho que estamos misturando
// duas coisas diferentes". Estava certo.
// ============================================================================

/**
 * Quantos dias antes do fim do teste a pessoa entra na fila de conversão.
 *
 * Um, a pedido: a conversa acontece na véspera, com o acesso ainda de pé. Dois
 * dias antes soa cedo e a pessoa esquece; no dia seguinte ela já perdeu o
 * acesso, e aí a conversa é outra, bem mais difícil.
 */
export const DIAS_PARA_VENCER = 1;

/**
 * As etiquetas de teste gratuito.
 *
 * Só o futebol tem teste, e por isso só ele tem etiqueta. Se um dia outro
 * produto ganhar teste, a etiqueta ganha produto no nome — e não antes:
 * `trial_ativo` para um produto só é o nome honesto de hoje.
 */
export const ETIQUETAS = ['trial_vencendo', 'trial_ativo', 'trial_vencido'] as const;

export type Etiqueta = (typeof ETIQUETAS)[number];

export const ROTULO_DA_ETIQUETA: Record<Etiqueta, string> = {
  trial_vencendo: 'Teste vencendo',
  trial_ativo: 'Em teste',
  trial_vencido: 'Teste vencido',
};

/**
 * Por que cada etiqueta importa, em uma frase.
 *
 * Mora aqui e não na tela porque a tela precisa mostrar isso em dois lugares —
 * a dica do filtro e o vazio da lista — e duas cópias divergiriam.
 */
export const EXPLICACAO_DA_ETIQUETA: Record<Etiqueta, string> = {
  trial_vencendo: 'o teste acaba amanhã ou hoje; é a última chance de converter com acesso de pé',
  trial_ativo: 'está usando o produto agora, e é o lead mais quente que existe',
  trial_vencido: 'testou e o acesso caiu; a conversa aqui é de retomada',
};

/** Quantos dias dura o teste gratuito. O mesmo de `utils/futebol-acesso`. */
const DIAS_DE_TESTE = 7;

/**
 * A etiqueta de teste de uma pessoa, se houver.
 *
 * Nula para quem nunca testou — e a ausência é informação: não existe etiqueta
 * "nunca testou", porque isso é o normal da base e uma etiqueta para o normal
 * não distingue nada.
 *
 * `trial_vencendo` ganha de `trial_ativo` quando as duas caberiam: quem vence
 * amanhã também está ativo, e mostrar a menos urgente das duas é perder o
 * motivo da etiqueta existir.
 *
 * ⚠️ Quem já assina não recebe etiqueta de teste, mesmo com o carimbo no banco.
 * A pessoa converteu; lembrar que ela um dia testou não muda conversa nenhuma,
 * e a etiqueta na tela pediria uma cobrança que não faz sentido.
 */
export function etiquetaDe(c: Cadastro, hoje: string): Etiqueta | null {
  if (!c.futebol_trial_started_at) return null;
  if (ehAssinanteDeQualquerCoisa(c)) return null;

  const inicio = brtDia(c.futebol_trial_started_at);
  if (!inicio) return null;

  // O fim é o último dia em que a pessoa ainda entra.
  const fim = somarDias(inicio, DIAS_DE_TESTE - 1);
  const faltam = diasEntre(hoje, fim);

  if (faltam < 0) return 'trial_vencido';
  if (faltam <= DIAS_PARA_VENCER) return 'trial_vencendo';
  return 'trial_ativo';
}

/**
 * Quantos dias de teste ainda restam, contando hoje.
 *
 * Para a mensagem pronta, que precisa dizer "acaba hoje" ou "acaba amanhã" em
 * vez de um número que quem lê tem de converter em dia da semana.
 */
export function diasDeTesteRestantes(c: Cadastro, hoje: string): number | null {
  const inicio = brtDia(c.futebol_trial_started_at);
  if (!inicio) return null;
  return diasEntre(hoje, somarDias(inicio, DIAS_DE_TESTE - 1));
}

/**
 * A pessoa entra no futebol agora, por teste ou por assinatura?
 *
 * Reexportado para a ficha não precisar conhecer a regra dos sete dias. Ela
 * mora em `utils/futebol-acesso`, e as edge functions do Telegram têm a própria
 * cópia em Deno — está avisado lá.
 */
export function entraNoFutebol(c: Cadastro, agora = Date.now()): boolean {
  return temAcessoAoFutebol(c.futebol_subscription_status, c.futebol_trial_started_at, agora);
}

function ehAssinanteDeQualquerCoisa(c: Cadastro): boolean {
  return (
    c.betinho_subscription_status === 'premium' ||
    c.futebol_subscription_status === 'premium' ||
    c.analytics_subscription_status === 'premium'
  );
}

/** `2026-09-13T02:00:00Z` → `2026-09-12`, que é o dia daqui. */
function brtDia(carimbo: string | null): string | null {
  if (!carimbo) return null;
  const ms = Date.parse(carimbo);
  if (Number.isNaN(ms)) return null;
  return new Date(ms - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function somarDias(dia: string, quantos: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + quantos);
  return d.toISOString().slice(0, 10);
}
