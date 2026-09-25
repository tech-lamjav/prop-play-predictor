/**
 * O contrato dos eventos — nomes, valores permitidos e forma das propriedades.
 *
 * Existe para que o nome de um evento apareça UMA vez no código. Antes desta
 * camada cada tela chamava `posthog?.capture('...')` com a string literal e um
 * objeto montado à mão, e o resultado está no inventário: `bolao_ranking_viewed`
 * é emitido em dois pontos do mesmo arquivo com propriedades diferentes, e o
 * painel que consome não tem como saber qual dos dois chegou. Um nome digitado
 * errado não quebra nada — só cria um evento novo, vazio, que ninguém procura.
 *
 * ⚠️ Nome de evento com histórico NUNCA se renomeia (convenção da §7 do
 * docs/plano-metricas-retencao.md). `opportunity_*` não segue o prefixo por
 * produto que aquele documento pede, e isso é deliberado: `opportunity_bet_registered`
 * já nasceu assim no bot, e alinhar os novos ao que existe vale mais do que
 * alinhar à convenção e deixar a família partida em duas.
 */

import { opportunityKey } from '@/utils/futebol-history';
import { FREQUENCIAS, OBJETIVOS } from '@/utils/perfil-declarado';

// ============================================================================
// Nomes
// ============================================================================

export const EVENTOS = {
  /** Clique que inicia a navegação para o detalhe de um jogo. */
  jogoClicado: 'futebol_game_clicked',
  /** Oportunidade de fato exibida — não é o mesmo que renderizada. */
  oportunidadeExibida: 'opportunity_impression',
  /** A pessoa abriu/selecionou a oportunidade. */
  oportunidadeAberta: 'opportunity_opened',
  /** A pessoa expandiu os motivos / "por que apostar". */
  motivosExpandidos: 'opportunity_reason_expanded',
  /** A pessoa abriu a análise completa. */
  analiseAberta: 'opportunity_analysis_opened',
  /** A pessoa executou a ação principal da oportunidade. */
  ctaClicado: 'opportunity_cta_clicked',
  /**
   * Registro de aposta. Nome PRÉ-EXISTENTE, emitido hoje só pelo bot
   * (telegram-webhook/callbacks.ts e index.ts). A web passa a emitir o mesmo
   * nome com `channel: 'web'`, como `bet_created` já faz nos dois canais.
   */
  apostaRegistrada: 'opportunity_bet_registered',
  /** O site foi aberto por um link de oportunidade do Telegram. */
  chegadaDoTelegram: 'telegram_opportunity_landing_opened',
  /**
   * A pesquisa de perfil apareceu para a pessoa (#524).
   *
   * ⚠️ O prefixo `profile` não é de produto, e isso é deliberado. A convenção
   * pede `futebol`/`nba`/`betinho`/`bolao`, mas esta pesquisa não pertence a
   * produto nenhum — é da conta, e a resposta segue a pessoa por todos eles.
   * Forçá-la para dentro de um produto faria o funil dizer que quem respondeu é
   * do futebol, que é justamente a confusão que a pesquisa existe para desfazer.
   */
  pesquisaDePerfilExibida: 'profile_survey_shown',
  /** As duas escolhas foram enviadas. */
  pesquisaDePerfilRespondida: 'profile_survey_answered',
  /** A pessoa apertou Pular. Volta na próxima sessão. */
  pesquisaDePerfilAdiada: 'profile_survey_deferred',
} as const;

export type NomeDeEvento = (typeof EVENTOS)[keyof typeof EVENTOS];

// ============================================================================
// Valores controlados
// ============================================================================

/**
 * De onde partiu o clique que abriu um jogo.
 *
 * `home_featured` é o destaque de `/futebol` (o `TopValueHero`); `home_games` é
 * o trilho de jogos da mesma tela; `games_list` é a agenda `/futebol/jogos`;
 * `opportunities` é a lista de `/futebol/oportunidades`. `telegram` e `direct`
 * não são cliques da tela — existem para o caso de a origem vir da atribuição
 * guardada, e não de um elemento.
 */
export const ORIGENS_DO_JOGO = [
  'home_featured',
  'home_games',
  'games_list',
  'opportunities',
  'telegram',
  'direct',
  'other',
] as const;
export type OrigemDoJogo = (typeof ORIGENS_DO_JOGO)[number];

export const MODOS_DE_ABERTURA = ['card', 'modal', 'game_detail', 'other'] as const;
export type ModoDeAbertura = (typeof MODOS_DE_ABERTURA)[number];

export const ACOES_DA_OPORTUNIDADE = [
  'register_bet',
  'open_bookmaker',
  'open_game',
  'subscribe',
  'other',
] as const;
export type AcaoDaOportunidade = (typeof ACOES_DA_OPORTUNIDADE)[number];

/**
 * As campanhas do bot. Os três primeiros são os `c=` que o redirecionador `go`
 * já reconhece hoje (supabase/functions/go/index.ts) — não invente um quarto
 * sem mexer lá, senão o clique cai no fallback e a campanha some do funil.
 */
export const TIPOS_DE_CAMPANHA = [
  'daily_opportunities',
  'published_opportunities',
  'weekly_summary',
  'other',
] as const;
export type TipoDeCampanha = (typeof TIPOS_DE_CAMPANHA)[number];

// ── A pesquisa de perfil (#524) ─────────────────────────────────────────────
//
// ⚠️ Os primeiros valores em PORTUGUÊS deste arquivo, e é decisão, não descuido.
// Todos os outros são em inglês porque nasceram descrevendo superfície de tela
// (`home_featured`, `register_bet`). Estes oito são outra coisa: são o valor do
// `check` da tabela `perfil_declarado` ao mesmo tempo que são o valor que chega
// ao PostHog. Traduzi-los no meio do caminho criaria duas grafias para a mesma
// opção e oito chances de elas divergirem em silêncio.
//
// Vêm importados do catálogo em vez de copiados pelo mesmo motivo: uma terceira
// cópia dos códigos seria uma terceira chance de divergir.

export const OBJETIVOS_DECLARADOS = [...OBJETIVOS, 'other'] as const;
export type ObjetivoDeclarado = (typeof OBJETIVOS_DECLARADOS)[number];

export const FREQUENCIAS_DECLARADAS = [...FREQUENCIAS, 'other'] as const;
export type FrequenciaDeclarada = (typeof FREQUENCIAS_DECLARADAS)[number];

/**
 * Qual das duas aberturas a pessoa viu — quem chegou agora, ou quem já usava.
 *
 * Também em português, e aqui a justificativa é OUTRA: estes dois não vêm do
 * banco, são inventados na borda. Ficam em português porque `chegada` e `base`
 * já são as palavras do domínio, usadas no ADR 0005 e no código que decide a
 * abertura — inventar um par em inglês só para este arquivo criaria uma
 * terceira grafia para um conceito que já tem nome, e ninguém lembraria qual
 * das três está numa consulta velha do painel.
 */
export const PUBLICOS_DA_PESQUISA = ['chegada', 'base', 'other'] as const;
export type PublicoDaPesquisa = (typeof PUBLICOS_DA_PESQUISA)[number];

/** Os quatro estados de `FutebolAccessState`, mais o desconhecido. */
export const SITUACOES_DE_ASSINATURA = [
  'anon',
  'trial',
  'expired',
  'subscribed',
  'unknown',
] as const;
export type SituacaoDeAssinatura = (typeof SITUACOES_DE_ASSINATURA)[number];

/**
 * Devolve o valor quando ele é da lista, e `'other'` quando não é.
 *
 * Silencioso de propósito: um valor fora da lista é problema de quem instrumenta,
 * não do usuário, e derrubar a tela por causa de telemetria seria trocar um dado
 * torto por uma sessão perdida. O teste é que precisa pegar isto — por isso a
 * lista é exportada.
 */
export function valorControlado<T extends string>(
  valor: string | null | undefined,
  permitidos: readonly T[],
  padrao: T,
): T {
  if (valor == null) return padrao;
  return (permitidos as readonly string[]).includes(valor) ? (valor as T) : padrao;
}

// ============================================================================
// Identidade de uma oportunidade
// ============================================================================

/**
 * O mínimo para identificar uma oportunidade.
 *
 * Reflete o domínio, e não o desejo: NÃO existe um `opportunity_id` de coluna
 * única. A identidade é composta — `fixture_id|market|outcome|line_value` — e
 * quem a define é `opportunityKey` (src/utils/futebol-history.ts), a mesma
 * função que casa board e histórico. O `dest` que o bot manda no link tem
 * exatamente essa composição (`jogo-<id>|<mercado>|<saída>|<linha>`), então as
 * duas pontas já concordam sem tradutor no meio.
 */
export type OportunidadeIdentificavel = {
  fixture_id: number;
  market: string | null | undefined;
  outcome: string | null | undefined;
  line_value: number | null | undefined;
};

/** Campos que descrevem a oportunidade além da identidade. */
export type DescricaoDaOportunidade = OportunidadeIdentificavel & {
  competition?: string | null;
  faixa?: string | null;
  score?: number | null;
};

/**
 * O `opportunity_id` sozinho.
 *
 * Existe porque o clique num JOGO não carrega o pacote inteiro da oportunidade
 * — ele fala de partida, e a oportunidade entra só como origem, quando havia
 * uma. Sem este atalho, cada página importaria `opportunityKey` por conta
 * própria e a chave voltaria a ser montada em cinco lugares.
 */
export function idDaOportunidade(o: OportunidadeIdentificavel): string {
  return opportunityKey({
    fixture_id: o.fixture_id,
    market: o.market ?? null,
    outcome: o.outcome ?? null,
    line_value: o.line_value ?? null,
  });
}

export type PropsComunsDaOportunidade = {
  opportunity_id: string;
  game_id: number;
  market: string | null;
  selection: string | null;
  confidence_band: string | null;
  score: number | null;
  competition: string | null;
  source: OrigemDoJogo;
  subscription_status: SituacaoDeAssinatura;
  position?: number;
};

/**
 * As propriedades comuns de uma oportunidade, montadas num lugar só.
 *
 * Três traduções de nome acontecem aqui, e todas são deliberadas:
 *   - `game_id` recebe o `fixture_id`. NÃO existem dois identificadores de jogo
 *     no domínio: `fixture_id` é o único, e mandar os dois criaria a ilusão de
 *     que existe um par para conferir.
 *   - `selection` recebe `outcome`, que é como o domínio chama o lado da saída.
 *   - `confidence_band` recebe `faixa` (Alta/Média/Baixa).
 *
 * E uma ausência: não há `league_id`. Liga no domínio é `competition`, uma
 * string (o tipo é literalmente `type Competition = string`), então é
 * `competition` que viaja. Inventar um `league_id` numérico aqui seria criar um
 * campo que nenhuma consulta do banco sabe responder.
 */
export function propsDaOportunidade(
  o: DescricaoDaOportunidade,
  extras: {
    source: OrigemDoJogo;
    subscription_status: SituacaoDeAssinatura;
    position?: number;
  },
): PropsComunsDaOportunidade {
  return {
    opportunity_id: opportunityKey({
      fixture_id: o.fixture_id,
      market: o.market ?? null,
      outcome: o.outcome ?? null,
      line_value: o.line_value ?? null,
    }),
    game_id: o.fixture_id,
    market: o.market ?? null,
    selection: o.outcome ?? null,
    confidence_band: o.faixa ?? null,
    score: o.score ?? null,
    competition: o.competition ?? null,
    source: extras.source,
    subscription_status: extras.subscription_status,
    ...(extras.position != null ? { position: extras.position } : {}),
  };
}

// ============================================================================
// A guarda de dado pessoal
// ============================================================================

/**
 * Chaves que não podem viajar em propriedade de evento.
 *
 * O `distinct_id` já identifica a pessoa, e ele é o `auth.users.id` — um UUID
 * que não diz nada sobre quem é. Mandar e-mail ou telefone junto do evento
 * duplica o identificador em forma legível, e é justamente o que torna um
 * vazamento de exportação caro.
 *
 * ⚠️ Isto vale para os eventos NOVOS. Os antigos `signed_in`/`signed_up` mandam
 * `email` na propriedade desde sempre (Auth.tsx, AuthCallback.tsx) — mexer neles
 * quebraria painel existente, então ficam como estão e a decisão é de produto,
 * não desta camada.
 */
export const CHAVES_PESSOAIS = [
  'email',
  'phone',
  'telefone',
  'name',
  'nome',
  'full_name',
  'whatsapp_number',
  'chat_id',
  'telegram_chat_id',
  'telegram_user_id',
  'telegram_username',
  'cpf',
] as const;

/** As chaves pessoais encontradas no objeto. Vazio é o esperado. */
export function chavesPessoaisEm(props: Record<string, unknown>): string[] {
  return Object.keys(props).filter((k) =>
    (CHAVES_PESSOAIS as readonly string[]).includes(k.toLowerCase()),
  );
}
