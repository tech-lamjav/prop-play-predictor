/**
 * As funções de captura — uma por evento, tipadas.
 *
 * Fala com o singleton do `posthog-js` diretamente, e não com o `usePostHog()`
 * do React, por dois motivos. O primeiro é alcance: impressão e clique nascem
 * em handler e em observador, e alguns pontos (o registro de aposta, a chegada
 * do Telegram) não são componentes. O segundo é a guarda: `usePostHog()` devolve
 * o client MESMO quando `posthog.init` nunca rodou — o `main.tsx` só inicializa
 * se `VITE_PUBLIC_POSTHOG_KEY` existir, e sem ela o objeto continua truthy. Ou
 * seja, `if (posthog)` não protege nada. Quem protege é `analyticsLigado()`.
 */

import posthog from 'posthog-js';
import { config } from '@/config/environment';
import {
  EVENTOS,
  chavesPessoaisEm,
  type AcaoDaOportunidade,
  type FrequenciaDeclarada,
  type ModoDeAbertura,
  type NomeDeEvento,
  type ObjetivoDeclarado,
  type OrigemDoJogo,
  type PropsComunsDaOportunidade,
  type PublicoDaPesquisa,
  type SituacaoDeAssinatura,
  type TipoDeCampanha,
} from './eventos';

type Props = Record<string, unknown>;

/**
 * O PostHog está de fato de pé?
 *
 * A MESMA condição do `main.tsx`. Duplicá-la é de propósito: perguntar ao SDK
 * (`posthog.__loaded`) amarraria esta camada a um campo interno que o
 * posthog-js pode renomear numa minor, e o sintoma seria telemetria sumindo em
 * silêncio — o pior tipo de falha para uma camada de telemetria.
 */
export function analyticsLigado(): boolean {
  return !!config.posthog.key;
}

/** Tira `undefined` do payload. Nulo FICA: "medi e não havia" não é "não medi". */
function semIndefinidos(props: Props): Props {
  const saida: Props = {};
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined) saida[k] = v;
  }
  return saida;
}

/**
 * O único ponto que chama `posthog.capture` para os eventos desta camada.
 *
 * Nunca lança. Telemetria que derruba a tela é pior que telemetria ausente: a
 * pessoa perde o que veio fazer por causa de um número que ninguém ia olhar
 * naquele segundo.
 */
export function capturar(evento: NomeDeEvento, props: Props = {}): void {
  if (!analyticsLigado()) return;
  try {
    const limpo = semIndefinidos(props);
    if (import.meta.env.DEV) {
      const pessoais = chavesPessoaisEm(limpo);
      if (pessoais.length > 0) {
        console.warn(
          `[analytics] ${evento} carrega dado pessoal (${pessoais.join(', ')}). ` +
            'O distinct_id já identifica a pessoa; tire a chave do payload.',
        );
      }
    }
    posthog.capture(evento, limpo);
  } catch (e) {
    // `console.debug` e não `warn`: falha de telemetria não é problema do
    // usuário nem do time de plantão, e um warn no console de produção ensina
    // a ignorar o console.
    console.debug('[analytics] captura falhou:', (e as Error)?.message);
  }
}

// ============================================================================
// Identidade
// ============================================================================

/**
 * Liga a atividade deste navegador ao usuário da aplicação.
 *
 * O id é o `auth.users.id` do Supabase, que é o MESMO `public.users.id` que o
 * backend usa como `distinct_id` (a RLS da tabela é `auth.uid() = id`). É o que
 * faz o evento do site, o do bot e o do redirecionador caírem na mesma pessoa.
 *
 * O PostHog liga sozinho o que veio antes: os eventos anônimos deste navegador
 * passam a pertencer a quem acabou de se identificar. Por isso a chegada do
 * Telegram pode disparar antes do login sem se perder.
 */
export function identificar(
  userId: string,
  propriedadesDaPessoa: Props = {},
): void {
  if (!analyticsLigado()) return;
  try {
    posthog.identify(userId, semIndefinidos(propriedadesDaPessoa));
  } catch (e) {
    console.debug('[analytics] identify falhou:', (e as Error)?.message);
  }
}

/**
 * Guarda um atributo na PESSOA, sem reidentificar ninguém.
 *
 * Diferente de `identificar`: aquele amarra o navegador a um id e só é chamado
 * no login. Este acrescenta um traço a quem já está identificado, e o traço
 * passa a valer para todo evento futuro dela — inclusive para segmentar funis
 * que já existiam antes da resposta.
 *
 * É o que torna possível cruzar o perfil declarado com campanha: no banco não
 * existe nenhum campo de origem (decisão registrada em `docs/crm-socios.md` e
 * trancada por teste do CRM), então o encontro das duas coisas só acontece aqui
 * dentro, onde o `distinct_id` é o mesmo dos dois lados.
 */
export function guardarNaPessoa(propriedades: Props): void {
  if (!analyticsLigado()) return;
  try {
    posthog.setPersonProperties(semIndefinidos(propriedades));
  } catch (e) {
    console.debug('[analytics] setPersonProperties falhou:', (e as Error)?.message);
  }
}

/**
 * Desliga o navegador da pessoa que saiu.
 *
 * Sem isto, quem desloga continua com o `distinct_id` do anterior — e num
 * dispositivo compartilhado a sessão seguinte, ainda anônima, entra na conta de
 * quem saiu. Não existia nenhum `reset` no frontend antes deste trabalho.
 */
export function esquecerPessoa(): void {
  if (!analyticsLigado()) return;
  try {
    posthog.reset();
  } catch (e) {
    console.debug('[analytics] reset falhou:', (e as Error)?.message);
  }
}

// ============================================================================
// Jogos
// ============================================================================

/**
 * Clique que inicia a navegação para o detalhe de um jogo.
 *
 * Dispara ANTES da navegação, uma vez por clique. Quem confirma que a navegação
 * terminou é o `$pageview` da tela de destino — são dois eventos de propósito,
 * porque a diferença entre eles é exatamente o abandono no meio do caminho.
 */
export function jogoClicado(props: {
  game_id: number;
  source: OrigemDoJogo;
  position?: number;
  is_featured: boolean;
  destination_path: string;
  competition?: string | null;
  opportunity_id?: string | null;
}): void {
  capturar(EVENTOS.jogoClicado, props);
}

// ============================================================================
// Oportunidades
// ============================================================================

/**
 * Uma oportunidade de fato exibida.
 *
 * Não é "o componente renderizou": a lista monta linha que nunca chega à
 * dobra. Quem decide é o observador de visibilidade
 * (`useImpressaoDeOportunidade`), com a régua de metade do cartão — ou metade
 * da tela, para o cartão alto — por cerca de um segundo.
 */
export function oportunidadeExibida(props: PropsComunsDaOportunidade): void {
  capturar(EVENTOS.oportunidadeExibida, props);
}

export function oportunidadeAberta(
  props: PropsComunsDaOportunidade & {
    open_mode: ModoDeAbertura;
    destination_path?: string;
  },
): void {
  capturar(EVENTOS.oportunidadeAberta, props);
}

export function motivosExpandidos(
  props: PropsComunsDaOportunidade & {
    reason_type?: string | null;
    reason_count?: number | null;
    /** O slug da premissa aberta — qual motivo a pessoa quis conferir. */
    premissa?: string | null;
  },
): void {
  capturar(EVENTOS.motivosExpandidos, props);
}

export function analiseAberta(
  props: PropsComunsDaOportunidade & {
    analysis_type: string;
    destination_path?: string;
  },
): void {
  capturar(EVENTOS.analiseAberta, props);
}

export function ctaClicado(
  props: PropsComunsDaOportunidade & {
    action: AcaoDaOportunidade;
    destination_path?: string;
    bookmaker?: string | null;
  },
): void {
  capturar(EVENTOS.ctaClicado, props);
}

/**
 * Aposta registrada.
 *
 * ⚠️ Nome PRÉ-EXISTENTE e emitido hoje só pelo bot, com `bet_id`, `pick_id`,
 * `stake`, `via`, `channel` e `source`. A web passa a emitir o mesmo nome com
 * `channel: 'web'` e `via: 'web_modal'`, acrescentando `opportunity_id` e
 * `game_id`, que faltavam nos dois lados. Quem consome filtrando por `channel`
 * não sente; quem consome sem filtrar passa a contar também a web — que é o
 * conserto, porque o registro pela web não aparecia em lugar nenhum.
 */
export function apostaRegistrada(
  props: PropsComunsDaOportunidade & {
    via: string;
    channel: 'web';
    stake?: number | null;
    odds?: number | null;
  },
): void {
  capturar(EVENTOS.apostaRegistrada, props);
}

// ============================================================================
// A pesquisa de perfil (#524)
// ============================================================================

/**
 * O pop-up apareceu de verdade — não é "o sentinela decidiu abrir".
 *
 * Dispara no momento em que a caixa entra na tela, depois do atraso. É o
 * denominador da taxa de resposta: sem ele não dá para saber se a distribuição
 * das escolhas descreve a base ou só quem teve paciência.
 *
 * Nenhuma propriedade de produto aqui, de propósito: a pesquisa é da conta, e
 * anotar em qual tela ela calhou de abrir convidaria a ler "perfil de quem usa
 * o futebol" num dado que não diz isso.
 */
export function pesquisaDePerfilExibida(props: { audience: PublicoDaPesquisa }): void {
  capturar(EVENTOS.pesquisaDePerfilExibida, props);
}

/** As duas escolhas foram enviadas. Os valores são os códigos, nunca o texto da tela. */
export function pesquisaDePerfilRespondida(props: {
  goal: ObjetivoDeclarado;
  betting_frequency: FrequenciaDeclarada;
  audience: PublicoDaPesquisa;
  /** Quantas vezes essa pessoa tinha adiado antes de responder. */
  deferrals: number;
}): void {
  capturar(EVENTOS.pesquisaDePerfilRespondida, props);
}

/**
 * A pessoa apertou Pular.
 *
 * `deferrals` é a contagem DEPOIS deste adiamento. É o número que diz se
 * insistir está funcionando ou só incomodando — mediana de um é o desenho
 * certo; gente com trinta é sinal de parar antes que vire cancelamento.
 */
export function pesquisaDePerfilAdiada(props: {
  audience: PublicoDaPesquisa;
  deferrals: number;
}): void {
  capturar(EVENTOS.pesquisaDePerfilAdiada, props);
}

/**
 * O perfil declarado vira traço da pessoa.
 *
 * Sem isto a resposta ficaria só no banco, e o banco não sabe de campanha
 * nenhuma — é aqui que perfil e origem se encontram.
 */
export function perfilDeclaradoDaPessoa(props: {
  goal: ObjetivoDeclarado;
  betting_frequency: FrequenciaDeclarada;
}): void {
  guardarNaPessoa({
    profile_goal: props.goal,
    profile_betting_frequency: props.betting_frequency,
  });
}

// ============================================================================
// Chegada pelo Telegram
// ============================================================================

export function chegadaDoTelegram(props: {
  delivery_id: string;
  batch_id: string | null;
  link_id: string | null;
  campaign_id: string | null;
  campaign_type: TipoDeCampanha;
  opportunity_id: string | null;
  landing_path: string;
  segment: string | null;
  time_since_sent_ms?: number | null;
  is_authenticated: boolean;
}): void {
  capturar(EVENTOS.chegadaDoTelegram, props);
}
