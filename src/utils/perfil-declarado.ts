/**
 * O perfil que a pessoa declara sobre si na chegada, e a regra de quando
 * perguntar.
 *
 * Spec na issue #522, ticket #523.
 *
 * ⚠️ **"Perfil" aqui não é a tela `/perfil`.** Aquela é a conta — nome, e-mail,
 * assinatura. Esta é a resposta de duas perguntas que a pessoa dá uma vez na
 * vida: o que veio buscar e quanto aposta. Por isso o termo é sempre **perfil
 * declarado**, com sobrenome, e nunca "perfil" sozinho.
 *
 * Este módulo é puro de propósito: sem React, sem Supabase, sem DOM e sem
 * relógio próprio. Ele decide, e quem tem o mundo entrega o estado. É o que
 * torna a regra inteira testável por arquivo, e é onde quase todo o teste desta
 * feature mora.
 */

// ============================================================================
// Os códigos
// ============================================================================
// Estes oito valores são os mesmos que o `check` da tabela `perfil_declarado`
// aceita e os mesmos que viajam para o PostHog como propriedade de pessoa.
//
// ⚠️ NUNCA se renomeiam. Renomear parte a série em duas e ninguém percebe: o
// que existia antes vira uma opção órfã, e o que passa a existir nasce sem
// história. O texto que aparece na tela é outra coisa — mora no catálogo logo
// abaixo e pode ser reescrito à vontade.

export const OBJETIVOS = [
  'oportunidades_prontas',
  'entender_o_porque',
  'economizar_tempo',
  'aprender_a_analisar',
] as const;
export type Objetivo = (typeof OBJETIVOS)[number];

export const FREQUENCIAS = [
  'comecando',
  'de_vez_em_quando',
  'toda_semana',
  'quase_todo_dia',
] as const;
export type Frequencia = (typeof FREQUENCIAS)[number];

/** A resposta completa. Meia resposta não existe — nem aqui nem no banco. */
export interface RespostaDoPerfil {
  objetivo: Objetivo;
  frequencia: Frequencia;
}

// ============================================================================
// O catálogo
// ============================================================================

export interface OpcaoDaPergunta {
  /** O que fica gravado. Fixo para sempre. */
  readonly codigo: string;
  /** O que a pessoa lê. Livre para reescrever. */
  readonly texto: string;
}

export interface PerguntaDaPesquisa {
  readonly campo: 'objetivo' | 'frequencia';
  readonly enunciado: string;
  readonly opcoes: readonly OpcaoDaPergunta[];
}

/**
 * As duas perguntas, na ordem em que aparecem.
 *
 * A segunda é frequência PURA, e isso é decisão registrada: o rascunho original
 * terminava em "Já faço minhas próprias análises", que é método e não
 * frequência, no meio de uma escala de frequência. Quem faz as próprias
 * análises já se declara na primeira pergunta; misturar os dois eixos custaria
 * o corte de volume, que é justamente o que conversa com ativação e retenção.
 */
export const PERGUNTAS: readonly PerguntaDaPesquisa[] = [
  {
    campo: 'objetivo',
    enunciado: 'O que você mais quer conseguir com a Smart Betting?',
    opcoes: [
      { codigo: 'oportunidades_prontas', texto: 'Receber oportunidades prontas' },
      { codigo: 'entender_o_porque', texto: 'Entender o porquê de cada aposta que eu faço' },
      { codigo: 'economizar_tempo', texto: 'Economizar tempo na análise' },
      { codigo: 'aprender_a_analisar', texto: 'Aprender a analisar melhor por conta própria' },
    ],
  },
  {
    campo: 'frequencia',
    enunciado: 'Com que frequência você aposta hoje?',
    opcoes: [
      { codigo: 'comecando', texto: 'Ainda estou começando' },
      { codigo: 'de_vez_em_quando', texto: 'De vez em quando' },
      { codigo: 'toda_semana', texto: 'Toda semana' },
      { codigo: 'quase_todo_dia', texto: 'Quase todo dia' },
    ],
  },
];

// ============================================================================
// A abertura
// ============================================================================

export type AberturaDaPesquisa = 'chegada' | 'base';

/**
 * Até quando alguém ainda é "quem acabou de chegar".
 *
 * Um dia, e não uma data fixa de lançamento: data fixa envelhece e exige que
 * alguém lembre de trocá-la, e quem esquecer deixa todo mundo com o texto
 * errado. Assim a régua se mantém sozinha para sempre.
 */
export const JANELA_DE_CHEGADA_MS = 24 * 60 * 60 * 1000;

export const ABERTURAS: Record<AberturaDaPesquisa, string> = {
  chegada: 'Pra começar, duas perguntas rápidas',
  base: 'Duas perguntas rápidas pra ajustar o que a gente te mostra',
};

/**
 * Qual das duas aberturas usar, pela data de cadastro.
 *
 * Sem data — ou com data que não dá para ler — cai em `base`, que é a mais
 * branda e serve para os dois: "pra ajustar o que a gente te mostra" faz sentido
 * para quem chegou agora, enquanto "pra começar" soa errado para quem usa o
 * produto há meses.
 */
export function aberturaPara(
  cadastradoEm: string | null | undefined,
  agora: number = Date.now(),
): AberturaDaPesquisa {
  if (typeof cadastradoEm !== 'string') return 'base';
  const nascimento = Date.parse(cadastradoEm);
  if (Number.isNaN(nascimento)) return 'base';
  return agora - nascimento <= JANELA_DE_CHEGADA_MS ? 'chegada' : 'base';
}

// ============================================================================
// Onde a pesquisa não aparece
// ============================================================================

/**
 * As rotas em que o pop-up nunca abre.
 *
 * Três famílias, e cada uma por um motivo diferente: onde ainda não se entrou
 * (landings, login), onde já está acontecendo outra coisa (o onboarding do
 * Telegram), e onde interromper custa dinheiro (preço, assinatura) ou quebra a
 * promessa da página (compartilhamento público, documentos legais).
 */
export const ROTAS_SEM_PESQUISA: readonly string[] = [
  '/', // a landing do ecossistema
  '/nba',
  '/betinho',
  '/auth',
  '/onboarding',
  '/futebol/comecar',
  '/bolao/comecar',
  '/lp',
  '/planos',
  '/paywall',
  '/paywall-dashboard',
  '/paywall-platform',
  '/futebol/assinar',
  '/waitlist',
  '/share',
  '/privacidade',
  '/termos',
];

/**
 * Se a pesquisa pode abrir nesta rota.
 *
 * A regra é **igual ao prefixo, ou filho dele**, e os dois pedaços são
 * necessários. Só "começa com" barraria o site inteiro pela raiz, já que toda
 * rota começa com barra — e confundiria irmão com filho: `/nba` é landing,
 * `/nba-dashboard` é produto, e um começa com o outro.
 */
export function rotaPermitePesquisa(pathname: string): boolean {
  return !ROTAS_SEM_PESQUISA.some(
    (prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`),
  );
}

/**
 * A volta de um pagamento do Stripe.
 *
 * Ela cai numa rota de produto comum — `/bolao/<id>` ou a tela de paywall —
 * carregando `success=true`. Barrar essas rotas inteiras tiraria a pesquisa de
 * telas legítimas; o que não pode ser interrompido é o pagamento, e é ele que
 * aparece na query.
 */
function voltandoDeUmPagamento(search: string | undefined): boolean {
  if (!search) return false;
  try {
    return new URLSearchParams(search).get('success') === 'true';
  } catch {
    return false;
  }
}

// ============================================================================
// A decisão
// ============================================================================

export interface EstadoDaPesquisa {
  /** Tem alguém logado. */
  logada: boolean;
  /** Já respondeu alguma vez — vem do banco, vale para a pessoa e não para o aparelho. */
  respondeu: boolean;
  /** Já apertou Pular nesta sessão — vem da sessão, e é esquecido quando a aba fecha. */
  adiouNestaSessao: boolean;
  pathname: string;
  search?: string;
}

/**
 * Se o pop-up deve abrir agora.
 *
 * As quatro recusas em ordem de custo: sem pessoa não há a quem perguntar; quem
 * respondeu nunca mais é perguntada; quem adiou agora só volta a ser perguntada
 * na próxima sessão; e o resto é onde a tela não permite.
 */
export function deveAbrirAPesquisa(estado: EstadoDaPesquisa): boolean {
  if (!estado.logada) return false;
  if (estado.respondeu) return false;
  if (estado.adiouNestaSessao) return false;
  if (!rotaPermitePesquisa(estado.pathname)) return false;
  if (voltandoDeUmPagamento(estado.search)) return false;
  return true;
}
