/**
 * A atribuição que atravessa o login.
 *
 * O link do bot chega em `/futebol/jogo/123?delivery_id=...&utm_source=telegram`.
 * Se a pessoa não estiver logada, a rota protegida a manda para `/auth`, o
 * Google a leva para fora do site e ela volta em `/auth/callback` — e a query
 * string original não sobrevive a essa viagem. Sem guardar, toda chegada pelo
 * Telegram de quem estava deslogado seria atribuída a "direto".
 *
 * Mesmo princípio do `lib/oauth-state.ts`, que já faz isso com o código de
 * indicação. A diferença é o prazo: atribuição vence. Um `delivery_id` de
 * ontem colado numa visita de hoje é pior que nenhuma atribuição, porque ele
 * credita ao Telegram uma visita que o Telegram não causou.
 */

/** Duas horas. Tempo de logar e voltar, longe de um dia seguinte. */
export const VALIDADE_MS = 2 * 60 * 60 * 1000;

const CHAVE = 'telegram_attribution';

/** Os parâmetros que o `go` põe no destino. */
export const PARAMS_DA_ATRIBUICAO = {
  deliveryId: 'delivery_id',
  batchId: 'batch_id',
  linkId: 'link_id',
  campaignId: 'campaign_id',
  campaignType: 'campaign_type',
  opportunityId: 'opportunity_id',
  segment: 'segment',
  sentAt: 'sent_at',
  utmSource: 'utm_source',
  utmMedium: 'utm_medium',
  utmCampaign: 'utm_campaign',
  utmContent: 'utm_content',
} as const;

export type AtribuicaoDoTelegram = {
  delivery_id: string;
  batch_id: string | null;
  link_id: string | null;
  campaign_id: string | null;
  campaign_type: string | null;
  opportunity_id: string | null;
  segment: string | null;
  /** ISO do envio, quando o link trouxe. Base do `time_since_sent_ms`. */
  sent_at: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
};

type AtribuicaoGuardada = AtribuicaoDoTelegram & {
  guardada_em: number;
  /** A chegada já virou evento? Evita o segundo disparo no redirect do login. */
  chegada_disparada: boolean;
};

/**
 * Lê a atribuição de uma query string. Função pura — é onde os testes moram.
 *
 * `delivery_id` é o que decide: ele é a chave canônica que liga envio, clique e
 * chegada. Sem ele não há atribuição, mesmo que venham utm_source e companhia —
 * um `utm_source=telegram` solto pode ter sido copiado e colado por qualquer um,
 * e creditar uma entrega específica a partir disso seria inventar.
 */
export function lerAtribuicaoDaUrl(
  search: string,
): AtribuicaoDoTelegram | null {
  const p = new URLSearchParams(search);
  const deliveryId = p.get(PARAMS_DA_ATRIBUICAO.deliveryId);
  if (!deliveryId) return null;
  return {
    delivery_id: deliveryId,
    batch_id: p.get(PARAMS_DA_ATRIBUICAO.batchId),
    link_id: p.get(PARAMS_DA_ATRIBUICAO.linkId),
    campaign_id: p.get(PARAMS_DA_ATRIBUICAO.campaignId),
    campaign_type: p.get(PARAMS_DA_ATRIBUICAO.campaignType),
    opportunity_id: p.get(PARAMS_DA_ATRIBUICAO.opportunityId),
    segment: p.get(PARAMS_DA_ATRIBUICAO.segment),
    sent_at: p.get(PARAMS_DA_ATRIBUICAO.sentAt),
    utm_source: p.get(PARAMS_DA_ATRIBUICAO.utmSource),
    utm_medium: p.get(PARAMS_DA_ATRIBUICAO.utmMedium),
    utm_campaign: p.get(PARAMS_DA_ATRIBUICAO.utmCampaign),
    utm_content: p.get(PARAMS_DA_ATRIBUICAO.utmContent),
  };
}

/**
 * Quanto tempo passou entre o envio e agora.
 *
 * Nulo quando o envio não veio ou não é data válida, e nulo também quando a
 * conta dá negativo — relógio de celular adiantado produz "chegou antes de ser
 * enviado", e um número impossível num painel custa mais caro que um campo
 * vazio.
 */
export function tempoDesdeOEnvioMs(
  sentAt: string | null,
  agora: number = Date.now(),
): number | null {
  if (!sentAt) return null;
  const t = Date.parse(sentAt);
  if (Number.isNaN(t)) return null;
  const delta = agora - t;
  return delta >= 0 ? delta : null;
}

// ============================================================================
// Guarda — sessionStorage, sempre embrulhado
// ============================================================================
// Aba anônima, cookies bloqueados e políticas de empresa fazem o acesso LANÇAR,
// não devolver vazio. Sem o try/catch, a tela toda cai por causa da telemetria.

function ler(): AtribuicaoGuardada | null {
  try {
    const cru = sessionStorage.getItem(CHAVE);
    if (!cru) return null;
    const g = JSON.parse(cru) as AtribuicaoGuardada;
    if (!g?.delivery_id || typeof g.guardada_em !== 'number') return null;
    return g;
  } catch {
    return null;
  }
}

function gravar(g: AtribuicaoGuardada): void {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(g));
  } catch {
    /* sem storage, a atribuição vale só para esta tela — e tudo bem */
  }
}

export function limparAtribuicao(): void {
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    /* idem */
  }
}

/** Guarda a atribuição recém-lida da URL, ainda não disparada. */
export function guardarAtribuicao(
  a: AtribuicaoDoTelegram,
  agora: number = Date.now(),
): void {
  gravar({ ...a, guardada_em: agora, chegada_disparada: false });
}

/**
 * A atribuição guardada, se ainda estiver dentro da validade.
 *
 * Vencida é apagada na hora: deixá-la ali só adiaria o engano para a próxima
 * leitura.
 */
export function atribuicaoGuardada(
  agora: number = Date.now(),
): AtribuicaoGuardada | null {
  const g = ler();
  if (!g) return null;
  if (agora - g.guardada_em > VALIDADE_MS) {
    limparAtribuicao();
    return null;
  }
  return g;
}

/**
 * Marca que a chegada já virou evento.
 *
 * A atribuição CONTINUA guardada depois disso, de propósito: ela ainda precisa
 * etiquetar a oportunidade que a pessoa abrir em seguida. O que esta marca
 * impede é o segundo `telegram_opportunity_landing_opened` — que aconteceria no
 * retorno do `/auth/callback`, quando a mesma atribuição é reencontrada.
 */
export function marcarChegadaDisparada(): void {
  const g = ler();
  if (!g) return;
  gravar({ ...g, chegada_disparada: true });
}

/**
 * Decide o que fazer com a URL atual, em uma passada.
 *
 * Devolve a atribuição a ser reportada APENAS quando ela ainda não foi
 * reportada. Nos demais casos devolve nulo, e quem chama não dispara nada.
 */
export function chegadaAReportar(
  search: string,
  agora: number = Date.now(),
): AtribuicaoGuardada | null {
  const daUrl = lerAtribuicaoDaUrl(search);
  if (daUrl) {
    const jaGuardada = atribuicaoGuardada(agora);
    // Mesma entrega já vista nesta sessão: não é uma chegada nova, é a mesma
    // URL remontando (voltar do histórico, StrictMode, troca de aba).
    if (jaGuardada?.delivery_id === daUrl.delivery_id) {
      return jaGuardada.chegada_disparada ? null : jaGuardada;
    }
    guardarAtribuicao(daUrl, agora);
    return { ...daUrl, guardada_em: agora, chegada_disparada: false };
  }
  // Sem parâmetro na URL: pode ser a volta do login, com a atribuição guardada
  // antes de sair para o provedor.
  const g = atribuicaoGuardada(agora);
  if (g && !g.chegada_disparada) return g;
  return null;
}
