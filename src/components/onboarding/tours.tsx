import type { Step } from 'react-joyride';

// Passos do onboarding guiado. Escopo Fase 1: o hub /inicio (boas-vindas + 1
// passo por destino). Os passos contextuais dentro de cada produto entram numa
// fase seguinte, ancorados por data-tour nas respectivas telas.
//
// Régua de copy: linguagem o mais simples possível (nosso público tem baixo
// letramento em média). Evitar palavra difícil e termo em inglês; jargão de
// apostador que ele já conhece (over, ambos marcam, handicap, odd, linha, ROI,
// prop, pick, desfalque, escalação, artilheiro, unidade, aporte) pode ficar.
//
// ============================================================================
// ⚠️ AQUI NÃO MORA FRASE NENHUMA — MORA CHAVE (#532)
// ============================================================================
// Este arquivo é um CATÁLOGO DE DADOS montado FORA de componente: os passos são
// objetos de módulo, avaliados na importação. Hook não vale aqui, então o texto
// não pode ser traduzido neste arquivo — nem com `t` importado, porque o idioma
// pode trocar sem recarregar a página e um texto resolvido na importação ficaria
// congelado no idioma da primeira visita.
//
// A saída é a mesma que o `futebol-rodadas.ts` e o `FutebolDayStepper` já usam,
// na variante que cabe em dado: o passo guarda a CHAVE (`tituloChave`,
// `conteudoChave`) e quem traduz é a PINTURA — o `OnboardingTourJoyride`, que é
// componente e tem o tradutor. Passar `t` por parâmetro em cada um destes
// dezoito construtores obrigaria a mexer nas dezoito telas que os chamam.
//
// O texto em si vive em `src/i18n/locales/<idioma>/tour.json`.
//
// ⚠️ E as variações de passo (copa x liga, celular x computador) escolhem a
// chave por IDENTIFICADOR — a bandeira booleana que a tela passou —, nunca
// comparando texto traduzido. Comparar frase aqui passaria no teste (em teste a
// interface está em português) e quebraria em espanhol, calado.
// ============================================================================

/**
 * Um passo do tour, com o texto por referência e não por valor.
 *
 * É o `Step` do react-joyride com `title`/`content` trocados pelas chaves do
 * catálogo. O tipo é deliberadamente incompatível com o `Step`: quem montar um
 * passo com frase escrita dentro não compila.
 */
export type PassoDoTour = Omit<Step, 'title' | 'content'> & {
  /** Chave do título no catálogo `tour`. Passo sem título não tem esta. */
  tituloChave?: string;
  /** Chave do corpo no catálogo `tour`. */
  conteudoChave: string;
};

export const HUB_TOUR_ID = 'hub';

export const hubSteps: PassoDoTour[] = [
  {
    id: 'welcome',
    target: 'body',
    placement: 'center',
    tituloChave: 'hub.boasVindas.titulo',
    conteudoChave: 'hub.boasVindas.texto',
  },
  {
    id: 'futebol',
    target: '[data-tour="hub-futebol"]',
    placement: 'bottom',
    tituloChave: 'hub.futebol.titulo',
    conteudoChave: 'hub.futebol.texto',
  },
  {
    id: 'betinho',
    target: '[data-tour="hub-betinho"]',
    placement: 'bottom',
    tituloChave: 'hub.betinho.titulo',
    conteudoChave: 'hub.betinho.texto',
  },
  {
    id: 'nba',
    target: '[data-tour="hub-nba"]',
    placement: 'bottom',
    tituloChave: 'hub.nba.titulo',
    conteudoChave: 'hub.nba.texto',
  },
  {
    id: 'bolao',
    target: '[data-tour="hub-bolao"]',
    placement: 'bottom',
    tituloChave: 'hub.bolao.titulo',
    conteudoChave: 'hub.bolao.texto',
  },
];

// ── Fase 2: passos contextuais (1 por produto, na 1a visita à tela) ──────────

export const FUTEBOL_TOUR_ID = 'futebol';
export const BETINHO_TOUR_ID = 'betinho';
export const NBA_TOUR_ID = 'nba';
export const BOLAO_TOUR_ID = 'bolao';

// Futebol é multi-passo: apresenta o produto de fato (método, datas,
// oportunidades, jogos). A barra de datas só existe quando há jogos no
// período, então o passo dela é condicional — por isso um builder.
export function makeFutebolSteps({ hasDayBar }: { hasDayBar: boolean }): PassoDoTour[] {
  const steps: PassoDoTour[] = [
    {
      id: 'futebol-intro',
      target: 'body',
      placement: 'center',
      tituloChave: 'futebol.intro.titulo',
      conteudoChave: 'futebol.intro.texto',
    },
  ];

  if (hasDayBar) {
    steps.push({
      id: 'futebol-datas',
      target: '[data-tour="futebol-datas"]',
      placement: 'bottom',
      tituloChave: 'futebol.datas.titulo',
      conteudoChave: 'futebol.datas.texto',
    });
  }

  steps.push(
    {
      id: 'futebol-resumo',
      target: '[data-tour="futebol-resumo"]',
      placement: 'bottom',
      tituloChave: 'futebol.resumo.titulo',
      conteudoChave: 'futebol.resumo.texto',
    },
    {
      id: 'futebol-oportunidades',
      target: '[data-tour="futebol-oportunidades"]',
      placement: 'top',
      // Bloco grande: mais respiro nas bordas do destaque que o padrão (6).
      spotlightPadding: 14,
      tituloChave: 'futebol.oportunidades.titulo',
      conteudoChave: 'futebol.oportunidades.texto',
    },
    {
      id: 'futebol-jogos',
      target: '[data-tour="futebol-jogos"]',
      placement: 'top',
      spotlightPadding: 14,
      tituloChave: 'futebol.jogos.titulo',
      conteudoChave: 'futebol.jogos.texto',
    },
    {
      id: 'futebol-metodologia',
      target: '[data-tour="futebol-metodologia"]',
      placement: 'top',
      tituloChave: 'futebol.metodologia.titulo',
      conteudoChave: 'futebol.metodologia.texto',
    },
  );

  return steps;
}

export const FUT_OPP_TOUR_ID = 'futebol-oportunidades';

// Tela /futebol/oportunidades — a régua completa. Multi-passo explicando
// filtros, leitura da lista e o Score. Barra de datas e a própria lista são
// condicionais (dependem de dados), daí o builder.
export function makeFutebolOportunidadesSteps({
  hasDayBar,
  hasBoard,
}: {
  hasDayBar: boolean;
  hasBoard: boolean;
}): PassoDoTour[] {
  const steps: PassoDoTour[] = [
    {
      id: 'fut-opp-intro',
      target: 'body',
      placement: 'center',
      tituloChave: 'futebolOportunidades.intro.titulo',
      conteudoChave: 'futebolOportunidades.intro.texto',
    },
  ];

  if (hasDayBar) {
    steps.push({
      id: 'fut-opp-datas',
      target: '[data-tour="fut-opp-datas"]',
      placement: 'bottom',
      tituloChave: 'futebolOportunidades.datas.titulo',
      conteudoChave: 'futebolOportunidades.datas.texto',
    });
  }

  steps.push({
    id: 'fut-opp-filtros',
    target: '[data-tour="fut-opp-filtros"]',
    placement: 'bottom',
    tituloChave: 'futebolOportunidades.filtros.titulo',
    conteudoChave: 'futebolOportunidades.filtros.texto',
  });

  if (hasBoard) {
    steps.push({
      id: 'fut-opp-lista',
      target: '[data-tour="fut-opp-lista"]',
      placement: 'top',
      tituloChave: 'futebolOportunidades.lista.titulo',
      conteudoChave: 'futebolOportunidades.lista.texto',
    });
  }

  steps.push({
    id: 'fut-opp-metodologia',
    target: '[data-tour="fut-opp-metodologia"]',
    placement: 'top',
    // Box com borda: folga o spotlight pra o texto não colar no contorno.
    spotlightPadding: 14,
    tituloChave: 'futebolOportunidades.metodologia.titulo',
    conteudoChave: 'futebolOportunidades.metodologia.texto',
  });

  return steps;
}

export const FUT_JOGO_TOUR_ID = 'futebol-jogo';

/**
 * Tela /futebol/jogo/:id — a leitura da partida.
 *
 * Refeito para a página em abas e para a bancada de mercados. O tour antigo
 * apontava para o card "o que olhar neste jogo", para o modelo de gols e para o
 * bloco de contexto, três alvos que deixaram de existir no redesenho, e por isso
 * estava desligado (as três flags iam `false` e sobrava só a introdução).
 *
 * Régua e premissas são condicionais porque dependem do mercado aberto: 1X2 e
 * ambos marcam não têm linha para arrastar, e jogo sem coleta não tem premissa
 * nenhuma para mostrar.
 */
export function makeFutebolJogoSteps({
  hasRegua,
  hasPremissas,
  ladoALado,
}: {
  hasRegua: boolean;
  hasPremissas: boolean;
  /** Bancada em duas colunas (a partir de 1280px). Empilhada, o balão ao lado
   *  não cabe: a folha do mercado é mais alta que a tela. */
  ladoALado: boolean;
}): PassoDoTour[] {
  const steps: PassoDoTour[] = [
    {
      id: 'fut-jogo-intro',
      target: 'body',
      placement: 'center',
      tituloChave: 'futebolJogo.intro.titulo',
      conteudoChave: 'futebolJogo.intro.texto',
    },
    {
      id: 'fut-jogo-header',
      target: '[data-tour="fut-jogo-header"]',
      placement: 'bottom',
      tituloChave: 'futebolJogo.cabecalho.titulo',
      conteudoChave: 'futebolJogo.cabecalho.texto',
    },
    {
      id: 'fut-jogo-abas',
      target: '[data-tour="fut-jogo-abas"]',
      placement: 'bottom',
      tituloChave: 'futebolJogo.abas.titulo',
      conteudoChave: 'futebolJogo.abas.texto',
    },
    {
      id: 'fut-jogo-mercados',
      target: '[data-tour="fut-jogo-mercados"]',
      placement: ladoALado ? 'right' : 'bottom',
      tituloChave: 'futebolJogo.mercados.titulo',
      conteudoChave: 'futebolJogo.mercados.texto',
    },
    {
      id: 'fut-jogo-folha',
      target: '[data-tour="fut-jogo-folha"]',
      placement: ladoALado ? 'left' : 'center',
      tituloChave: 'futebolJogo.folha.titulo',
      conteudoChave: 'futebolJogo.folha.texto',
    },
  ];

  if (hasRegua) {
    steps.push({
      id: 'fut-jogo-regua',
      target: '[data-tour="fut-jogo-regua"]',
      placement: 'bottom',
      tituloChave: 'futebolJogo.regua.titulo',
      conteudoChave: 'futebolJogo.regua.texto',
    });
  }

  if (hasPremissas) {
    steps.push({
      id: 'fut-jogo-premissas',
      target: '[data-tour="fut-jogo-premissas"]',
      placement: 'top',
      tituloChave: 'futebolJogo.premissas.titulo',
      conteudoChave: 'futebolJogo.premissas.texto',
    });
  }

  return steps;
}

export const FUT_JOGOS_TOUR_ID = 'futebol-jogos';

// Tela /futebol/jogos — agenda por dia, todas as ligas juntas. O passo do painel
// só existe no desktop, porque em telas menores o clique navega pra tela do jogo
// e o alvo não está montado.
export function makeFutebolJogosSteps({ hasPanel }: { hasPanel: boolean }): PassoDoTour[] {
  const steps: PassoDoTour[] = [
    {
      id: 'fut-jogos-intro',
      target: 'body',
      placement: 'center',
      tituloChave: 'futebolJogos.intro.titulo',
      conteudoChave: 'futebolJogos.intro.texto',
    },
    {
      id: 'fut-jogos-datas',
      target: '[data-tour="fut-jogos-datas"]',
      placement: 'bottom',
      tituloChave: 'futebolJogos.datas.titulo',
      conteudoChave: 'futebolJogos.datas.texto',
    },
    {
      id: 'fut-jogos-lista',
      target: '[data-tour="fut-jogos-lista"]',
      placement: 'top',
      tituloChave: 'futebolJogos.lista.titulo',
      conteudoChave: 'futebolJogos.lista.texto',
    },
  ];

  if (hasPanel) {
    steps.push({
      id: 'fut-jogos-painel',
      target: '[data-tour="fut-jogos-painel"]',
      placement: 'left',
      tituloChave: 'futebolJogos.painel.titulo',
      conteudoChave: 'futebolJogos.painel.texto',
    });
  }

  return steps;
}

export const FUT_CAMPEONATO_TOUR_ID = 'futebol-campeonato';

/**
 * Tela /futebol/campeonato/:slug — o campeonato inteiro.
 *
 * O último passo muda de assunto conforme a competição: liga tem tabela, copa
 * tem chaveamento. Falar em "classificação" numa copa seria descrever uma tela
 * que a pessoa não está vendo.
 *
 * As duas variações trocam a CHAVE, nunca a frase: `copa`/`liga` vem da bandeira
 * `ehCopa`, e `celular`/`computador` da `isMobile`.
 */
export function makeFutebolCampeonatoSteps({
  hasRounds,
  ehCopa,
  isMobile,
}: {
  hasRounds: boolean;
  ehCopa: boolean;
  /** No celular a tabela/chave vive dentro de abas, e o alvo do desktop não existe. */
  isMobile: boolean;
}): PassoDoTour[] {
  const fase = ehCopa ? 'copa' : 'liga';
  const onde = isMobile ? 'celular' : 'computador';

  const steps: PassoDoTour[] = [
    {
      id: 'fut-camp-intro',
      target: 'body',
      placement: 'center',
      tituloChave: 'futebolCampeonato.intro.titulo',
      conteudoChave: 'futebolCampeonato.intro.texto',
    },
    {
      id: 'fut-camp-header',
      target: '[data-tour="fut-camp-header"]',
      placement: 'bottom',
      tituloChave: 'futebolCampeonato.cabecalho.titulo',
      conteudoChave: 'futebolCampeonato.cabecalho.texto',
    },
  ];

  if (hasRounds) {
    steps.push({
      id: 'fut-camp-rodada',
      target: '[data-tour="fut-camp-rodada"]',
      placement: 'bottom',
      tituloChave: `futebolCampeonato.rodada.${fase}.titulo`,
      conteudoChave: `futebolCampeonato.rodada.${fase}.texto`,
    });
  }

  // O alvo muda por viewport: no desktop é a coluna da direita, no celular é a
  // barra de abas (a coluna existe no DOM mas fica escondida, e apontar pra ela
  // deixava o último passo no vazio).
  steps.push({
    id: 'fut-camp-tabela',
    target: isMobile ? '[data-tour="fut-camp-abas"]' : '[data-tour="fut-camp-tabela"]',
    placement: isMobile ? 'bottom' : 'top',
    tituloChave: `futebolCampeonato.tabela.${onde}.${fase}.titulo`,
    conteudoChave: `futebolCampeonato.tabela.${onde}.${fase}.texto`,
  });

  return steps;
}

export const BETINHO_DASH_TOUR_ID = 'betinho-dashboard';

// Painel do Betinho (/betting-dashboard) — a leitura da banca.
// Alvo de "resumo" muda por viewport (StatusStrip desktop vs hero mobile).
export function makeBetinhoDashboardSteps({ isMobile }: { isMobile: boolean }): PassoDoTour[] {
  return [
    {
      id: 'dash-intro',
      target: 'body',
      placement: 'center',
      tituloChave: 'betinhoPainel.intro.titulo',
      conteudoChave: 'betinhoPainel.intro.texto',
    },
    {
      id: 'dash-header',
      target: '[data-tour="dash-header"]',
      placement: 'bottom',
      tituloChave: 'betinhoPainel.cabecalho.titulo',
      conteudoChave: 'betinhoPainel.cabecalho.texto',
    },
    {
      id: 'dash-stats',
      target: isMobile ? '[data-tour="dash-stats-m"]' : '[data-tour="dash-stats"]',
      placement: 'bottom',
      tituloChave: 'betinhoPainel.resumo.titulo',
      conteudoChave: isMobile
        ? 'betinhoPainel.resumo.textoCelular'
        : 'betinhoPainel.resumo.textoComputador',
    },
    {
      id: 'dash-diagnostico',
      target: '[data-tour="dash-diagnostico"]',
      placement: 'bottom',
      tituloChave: 'betinhoPainel.diagnostico.titulo',
      conteudoChave: 'betinhoPainel.diagnostico.texto',
    },
    {
      id: 'dash-heatmap',
      target: '[data-tour="dash-heatmap"]',
      placement: 'top',
      tituloChave: 'betinhoPainel.heatmap.titulo',
      conteudoChave: 'betinhoPainel.heatmap.texto',
    },
    {
      id: 'dash-tags',
      target: '[data-tour="dash-tags"]',
      placement: 'top',
      tituloChave: 'betinhoPainel.etiquetas.titulo',
      conteudoChave: 'betinhoPainel.etiquetas.texto',
    },
    {
      id: 'dash-odds',
      target: '[data-tour="dash-odds"]',
      placement: 'top',
      tituloChave: 'betinhoPainel.odds.titulo',
      conteudoChave: 'betinhoPainel.odds.texto',
    },
    {
      id: 'dash-atividade',
      target: '[data-tour="dash-atividade"]',
      placement: 'top',
      tituloChave: 'betinhoPainel.atividade.titulo',
      conteudoChave: 'betinhoPainel.atividade.texto',
    },
  ];
}

export const FUTEBOL_TIME_TOUR_ID = 'futebol-time';

// Perfil do time (/futebol/time/:id). Raio-X é condicional a dados.
export function makeFutebolTimeSteps({ hasRaiox }: { hasRaiox: boolean }): PassoDoTour[] {
  const steps: PassoDoTour[] = [
    {
      id: 'ftime-intro',
      target: 'body',
      placement: 'center',
      tituloChave: 'futebolTime.intro.titulo',
      conteudoChave: 'futebolTime.intro.texto',
    },
    {
      id: 'ftime-header',
      target: '[data-tour="ftime-header"]',
      placement: 'bottom',
      tituloChave: 'futebolTime.cabecalho.titulo',
      conteudoChave: 'futebolTime.cabecalho.texto',
    },
    {
      id: 'ftime-medias',
      target: '[data-tour="ftime-medias"]',
      placement: 'top',
      tituloChave: 'futebolTime.medias.titulo',
      conteudoChave: 'futebolTime.medias.texto',
    },
  ];
  if (hasRaiox) {
    steps.push({
      id: 'ftime-raiox',
      target: '[data-tour="ftime-raiox"]',
      placement: 'top',
      tituloChave: 'futebolTime.raiox.titulo',
      conteudoChave: 'futebolTime.raiox.texto',
    });
  }
  steps.push({
    id: 'ftime-resultados',
    target: '[data-tour="ftime-resultados"]',
    placement: 'top',
    tituloChave: 'futebolTime.resultados.titulo',
    conteudoChave: 'futebolTime.resultados.texto',
  });
  return steps;
}

// Betinho (/bets) — gestão de banca. Multi-passo. Desktop e mobile têm blocos
// separados de KPIs/gráfico, então o alvo de "seus números" muda por viewport;
// o passo do Telegram só entra na banca vazia (é onde o CTA grande aparece).
export function makeBetinhoSteps({
  isMobile,
  hasEmptyState,
}: {
  isMobile: boolean;
  hasEmptyState: boolean;
}): PassoDoTour[] {
  const steps: PassoDoTour[] = [
    {
      id: 'betinho-intro',
      target: 'body',
      placement: 'center',
      tituloChave: 'betinho.intro.titulo',
      conteudoChave: 'betinho.intro.texto',
    },
  ];

  if (hasEmptyState) {
    steps.push({
      id: 'betinho-telegram',
      target: '[data-tour="betinho-telegram"]',
      placement: 'bottom',
      tituloChave: 'betinho.telegram.titulo',
      conteudoChave: 'betinho.telegram.texto',
    });
  }

  steps.push({
    id: 'betinho-stats',
    target: isMobile ? '[data-tour="betinho-stats-m"]' : '[data-tour="betinho-stats"]',
    placement: 'bottom',
    tituloChave: 'betinho.numeros.titulo',
    conteudoChave: isMobile ? 'betinho.numeros.textoCelular' : 'betinho.numeros.textoComputador',
  });

  if (!isMobile) {
    steps.push({
      id: 'betinho-evolucao',
      target: '[data-tour="betinho-evolucao"]',
      placement: 'top',
      tituloChave: 'betinho.evolucao.titulo',
      conteudoChave: 'betinho.evolucao.texto',
    });
  }

  steps.push({
    id: 'betinho-lista',
    target: '[data-tour="betinho-lista"]',
    placement: 'top',
    tituloChave: 'betinho.lista.titulo',
    conteudoChave: 'betinho.lista.texto',
  });

  return steps;
}

export const BANKROLL_TOUR_ID = 'bankroll';

// Fluxo de caixa (/bankroll) — tela simples, sem variações relevantes de
// viewport, então array estático.
export const bankrollSteps: PassoDoTour[] = [
  {
    id: 'bankroll-intro',
    target: 'body',
    placement: 'center',
    tituloChave: 'bankroll.intro.titulo',
    conteudoChave: 'bankroll.intro.texto',
  },
  {
    id: 'bankroll-acoes',
    target: '[data-tour="bankroll-acoes"]',
    placement: 'bottom',
    tituloChave: 'bankroll.acoes.titulo',
    conteudoChave: 'bankroll.acoes.texto',
  },
  {
    id: 'bankroll-resumo',
    target: '[data-tour="bankroll-resumo"]',
    placement: 'bottom',
    tituloChave: 'bankroll.resumo.titulo',
    conteudoChave: 'bankroll.resumo.texto',
  },
  {
    id: 'bankroll-extrato',
    target: '[data-tour="bankroll-extrato"]',
    placement: 'top',
    tituloChave: 'bankroll.extrato.titulo',
    conteudoChave: 'bankroll.extrato.texto',
  },
];

// NBA hub (/home-nba). Multi-passo; todas as âncoras existem após o load,
// então array estático (disparo gated em !isLoading na página).
export const nbaSteps: PassoDoTour[] = [
  {
    id: 'nba-intro',
    target: 'body',
    placement: 'center',
    tituloChave: 'nba.intro.titulo',
    conteudoChave: 'nba.intro.texto',
  },
  {
    id: 'nba-hero',
    target: '[data-tour="nba-hero"]',
    placement: 'bottom',
    tituloChave: 'nba.hero.titulo',
    conteudoChave: 'nba.hero.texto',
  },
  {
    id: 'nba-hots',
    target: '[data-tour="nba-hots"]',
    placement: 'top',
    tituloChave: 'nba.quentes.titulo',
    conteudoChave: 'nba.quentes.texto',
  },
  {
    id: 'nba-injuries',
    target: '[data-tour="nba-injuries"]',
    placement: 'top',
    tituloChave: 'nba.lesoes.titulo',
    conteudoChave: 'nba.lesoes.texto',
  },
  {
    id: 'nba-jogos',
    target: '[data-tour="nba-jogos"]',
    placement: 'top',
    tituloChave: 'nba.jogos.titulo',
    conteudoChave: 'nba.jogos.texto',
  },
  {
    id: 'nba-relatorio',
    target: '[data-tour="nba-relatorio"]',
    placement: 'top',
    tituloChave: 'nba.relatorio.titulo',
    conteudoChave: 'nba.relatorio.texto',
  },
];

export const NBA_GAMES_TOUR_ID = 'nba-games';

// Jogos NBA (/home-games). dateNavBlock renderiza 1x conforme viewport, então
// a âncora vai na definição dele; demais seções são container único.
export const nbaGamesSteps: PassoDoTour[] = [
  {
    id: 'nba-games-intro',
    target: 'body',
    placement: 'center',
    tituloChave: 'nbaJogos.intro.titulo',
    conteudoChave: 'nbaJogos.intro.texto',
  },
  {
    id: 'nba-games-data',
    target: '[data-tour="nba-games-data"]',
    placement: 'bottom',
    tituloChave: 'nbaJogos.data.titulo',
    conteudoChave: 'nbaJogos.data.texto',
  },
  {
    id: 'nba-games-lista',
    target: '[data-tour="nba-games-lista"]',
    placement: 'top',
    tituloChave: 'nbaJogos.lista.titulo',
    conteudoChave: 'nbaJogos.lista.texto',
  },
  {
    id: 'nba-games-sidebar',
    target: '[data-tour="nba-games-sidebar"]',
    placement: 'top',
    tituloChave: 'nbaJogos.lateral.titulo',
    conteudoChave: 'nbaJogos.lateral.texto',
  },
];

export const NBA_GAME_TOUR_ID = 'nba-game';

// Detalhe do jogo NBA (/game/:id). Conteúdo atrás do gate !game, então o
// disparo espera o jogo carregar. HeroCard/abas cuidam do responsivo internamente.
export const nbaGameSteps: PassoDoTour[] = [
  {
    id: 'nba-game-intro',
    target: 'body',
    placement: 'center',
    tituloChave: 'nbaJogo.intro.titulo',
    conteudoChave: 'nbaJogo.intro.texto',
  },
  {
    id: 'nba-game-hero',
    target: '[data-tour="nba-game-hero"]',
    placement: 'bottom',
    tituloChave: 'nbaJogo.times.titulo',
    conteudoChave: 'nbaJogo.times.texto',
  },
  {
    id: 'nba-game-abas',
    target: '[data-tour="nba-game-abas"]',
    placement: 'top',
    tituloChave: 'nbaJogo.abas.titulo',
    conteudoChave: 'nbaJogo.abas.texto',
  },
];

export const NBA_DASH_TOUR_ID = 'nba-dashboard';

// Painel do jogador (/nba-dashboard/:player). Blocos desktop/mobile são
// DUPLICADOS no DOM (toggle por CSS no breakpoint lg=1024). `mobile` escolhe o
// alvo do bloco visível (a página calcula via matchMedia 1024, não useIsMobile).
export function makeNbaDashSteps({ mobile }: { mobile: boolean }): PassoDoTour[] {
  const alvo = (id: string) => `[data-tour="${id}${mobile ? '-m' : ''}"]`;
  return [
    {
      id: 'nba-dash-intro',
      target: 'body',
      placement: 'center',
      tituloChave: 'nbaPainel.intro.titulo',
      conteudoChave: 'nbaPainel.intro.texto',
    },
    {
      id: 'nba-dash-header',
      target: alvo('nba-dash-header'),
      placement: 'bottom',
      tituloChave: 'nbaPainel.cabecalho.titulo',
      conteudoChave: 'nbaPainel.cabecalho.texto',
    },
    {
      id: 'nba-dash-opps',
      target: alvo('nba-dash-opps'),
      placement: 'top',
      tituloChave: 'nbaPainel.oportunidades.titulo',
      conteudoChave: 'nbaPainel.oportunidades.texto',
    },
    {
      id: 'nba-dash-chart',
      target: alvo('nba-dash-chart'),
      placement: 'top',
      tituloChave: 'nbaPainel.grafico.titulo',
      conteudoChave: 'nbaPainel.grafico.texto',
    },
  ];
}

export const ANALISE360_LIST_TOUR_ID = 'nba-analise360-list';

// Análise 360 lista (/analise-360, premium). Grid é gated por dados.
export function makeAnalise360ListSteps({ hasGrid }: { hasGrid: boolean }): PassoDoTour[] {
  const steps: PassoDoTour[] = [
    {
      id: 'a360l-intro',
      target: 'body',
      placement: 'center',
      tituloChave: 'analise360Lista.intro.titulo',
      conteudoChave: 'analise360Lista.intro.texto',
    },
    {
      id: 'a360l-header',
      target: '[data-tour="a360l-header"]',
      placement: 'bottom',
      tituloChave: 'analise360Lista.cabecalho.titulo',
      conteudoChave: 'analise360Lista.cabecalho.texto',
    },
  ];
  if (hasGrid) {
    steps.push({
      id: 'a360l-grid',
      target: '[data-tour="a360l-grid"]',
      placement: 'top',
      tituloChave: 'analise360Lista.gatilhos.titulo',
      conteudoChave: 'analise360Lista.gatilhos.texto',
    });
  }
  return steps;
}

export const ANALISE360_DETAIL_TOUR_ID = 'nba-analise360-detail';

// Análise 360 detalhe (/analise-360/:id, premium). Conteúdo atrás de
// isLoading/!triggerInfo; cadeia troca componente por viewport internamente
// (um elemento só), então array estático.
export const nbaAnalise360DetailSteps: PassoDoTour[] = [
  {
    id: 'a360d-intro',
    target: 'body',
    placement: 'center',
    tituloChave: 'analise360Detalhe.intro.titulo',
    conteudoChave: 'analise360Detalhe.intro.texto',
  },
  {
    id: 'a360d-header',
    target: '[data-tour="a360d-header"]',
    placement: 'bottom',
    tituloChave: 'analise360Detalhe.jogador.titulo',
    conteudoChave: 'analise360Detalhe.jogador.texto',
  },
  {
    id: 'a360d-cadeia',
    target: '[data-tour="a360d-cadeia"]',
    placement: 'top',
    tituloChave: 'analise360Detalhe.cadeia.titulo',
    conteudoChave: 'analise360Detalhe.cadeia.texto',
  },
];

export const bolaoSteps: PassoDoTour[] = [
  {
    id: 'bolao-hero',
    target: '[data-tour="bolao-hero"]',
    placement: 'bottom',
    tituloChave: 'bolao.hero.titulo',
    conteudoChave: 'bolao.hero.texto',
  },
];
