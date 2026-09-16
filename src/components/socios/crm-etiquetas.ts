import { brtDayOf, diasEntre } from '@/utils/futebol-datas';
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

  const fim = ultimoDiaDoTeste(c.futebol_trial_ends_at);
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
  const fim = ultimoDiaDoTeste(c.futebol_trial_ends_at);
  return fim ? diasEntre(hoje, fim) : null;
}

/** `2026-09-21` vira `21/09`. O ano fica de fora: a etiqueta é sobre esta semana. */
function diaCurto(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

/**
 * A etiqueta com o PRAZO dentro, do jeito que ela aparece na linha do lead.
 *
 * O rótulo sozinho respondia metade da pergunta. "Teste vencendo" não dizia se
 * vence hoje ou amanhã, e "teste vencido" não dizia se foi ontem ou em maio —
 * e é isso que separa uma conversa de retomada de uma de recomeço. Com o dia na
 * etiqueta, o sócio decide a ordem das ligações sem abrir ficha nenhuma.
 *
 * Sem o dia gravado, cai no rótulo: a etiqueta continua dizendo a situação, que
 * é o que ela sempre disse.
 */
export function textoDaEtiqueta(
  etiqueta: Etiqueta,
  fimDoTeste: string | null,
  diasDeTeste: number | null,
): string {
  if (!fimDoTeste || diasDeTeste === null) return ROTULO_DA_ETIQUETA[etiqueta];

  const dia = diaCurto(fimDoTeste);

  if (etiqueta === 'trial_vencido') {
    const faz = Math.abs(diasDeTeste);
    return `Venceu ${dia}, faz ${faz} ${faz === 1 ? 'dia' : 'dias'}`;
  }

  // "Quantos dias" foi pedido para as TRÊS situações, e o vencido já dizia. Sem
  // isto, justamente o lead mais quente — o que ainda está testando — era o
  // único sem a conta, e o sócio tinha de fazer de cabeça para saber se dava
  // tempo de ligar amanhã.
  if (etiqueta === 'trial_ativo') {
    return `Em teste até ${dia}, faltam ${diasDeTeste} dias`;
  }

  // Vencendo é hoje ou amanhã, e é assim que a pessoa pensa no próprio prazo.
  // O dia vai junto porque é ele que entra na mensagem e na conversa.
  return diasDeTeste <= 0 ? `Vence hoje, ${dia}` : `Vence amanhã, ${dia}`;
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
 *
 * Exportada porque a ficha mostra o mesmo dia no "termina em", e as duas telas
 * precisam concordar sobre qual é o último dia de acesso.
 */
export function ultimoDiaDoTeste(fimDoTeste: string | null): string | null {
  if (!fimDoTeste) return null;
  const ms = Date.parse(fimDoTeste);
  if (Number.isNaN(ms)) return null;
  return brtDayOf(new Date(ms - 1).toISOString());
}

function ehAssinanteDeQualquerCoisa(c: Cadastro): boolean {
  return (
    c.betinho_subscription_status === 'premium' ||
    c.futebol_subscription_status === 'premium' ||
    c.analytics_subscription_status === 'premium'
  );
}
