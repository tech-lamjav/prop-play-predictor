import { temAcessoAoFutebolPeloFim } from '@/utils/futebol-acesso';
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
 *
 * Com o teste de 48 horas, a véspera é quase o teste inteiro: quem começa hoje
 * termina depois de amanhã e já entra em "vencendo" amanhã. É o que se quer,
 * porque a janela para converter encolheu junto.
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
  if (ehAssinanteDeQualquerCoisa(c)) return null;

  const fim = ultimoDiaDoTeste(c);
  if (!fim) return null;

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
  const fim = ultimoDiaDoTeste(c);
  return fim ? diasEntre(hoje, fim) : null;
}

/**
 * A pessoa entra no futebol agora, por teste ou por assinatura?
 *
 * Reexportado para a ficha não precisar conhecer a regra do teste. Ela mora em
 * `utils/futebol-acesso`, e as edge functions do Telegram têm a própria cópia
 * em Deno — está avisado lá.
 */
export function entraNoFutebol(c: Cadastro, agora = Date.now()): boolean {
  return temAcessoAoFutebolPeloFim(c.futebol_subscription_status, c.futebol_trial_ends_at, agora);
}

function ehAssinanteDeQualquerCoisa(c: Cadastro): boolean {
  return (
    c.betinho_subscription_status === 'premium' ||
    c.futebol_subscription_status === 'premium' ||
    c.analytics_subscription_status === 'premium'
  );
}

/**
 * O último dia, em Brasília, em que a pessoa ainda entra no futebol pelo teste.
 *
 * Pelo FIM gravado, e não pelo início mais uma duração: o teste passou de 7
 * dias para 48 horas, e quem começou antes da troca continua com os 7 dias que
 * a página prometeu. O fim é gravado junto com o início, então cada coorte já
 * traz a sua duração, e esta função nunca precisa saber qual é.
 *
 * O último instante com acesso é o anterior ao fim. Um teste que termina à
 * meia-noite daqui não dá aquele dia a ninguém, e sem o milissegundo a etiqueta
 * diria que dá.
 */
function ultimoDiaDoTeste(c: Cadastro): string | null {
  if (!c.futebol_trial_ends_at) return null;
  const ms = Date.parse(c.futebol_trial_ends_at);
  if (Number.isNaN(ms)) return null;
  return new Date(ms - 1 - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
