import type { Step } from 'react-joyride';

// Passos do onboarding guiado. Escopo Fase 1: o hub /inicio (boas-vindas + 1
// passo por destino). Os passos contextuais dentro de cada produto entram numa
// fase seguinte, ancorados por data-tour nas respectivas telas.

export const HUB_TOUR_ID = 'hub';

export const hubSteps: Step[] = [
  {
    id: 'welcome',
    target: 'body',
    placement: 'center',
    title: 'Bem-vindo à Smartbetting 👋',
    content:
      'Em 30 segundos te mostro o que cada área faz. Pode pular quando quiser, dá pra rever depois nas configurações.',
  },
  {
    id: 'futebol',
    target: '[data-tour="hub-futebol"]',
    placement: 'bottom',
    title: 'Futebol',
    content:
      'As oportunidades de valor do dia: onde o dado aponta aposta com vantagem, com o Score pra você comparar. É por aqui que a maioria começa.',
  },
  {
    id: 'betinho',
    target: '[data-tour="hub-betinho"]',
    placement: 'bottom',
    title: 'Betinho',
    content:
      'Seu gestor de banca no Telegram: registra as apostas, liquida os resultados e te manda o resumo. A banca no automático, sem planilha.',
  },
  {
    id: 'nba',
    target: '[data-tour="hub-nba"]',
    placement: 'bottom',
    title: 'Análises NBA',
    content:
      'Prop bets e dashboards dos jogadores, a análise mais robusta pra quem acompanha a NBA de perto.',
  },
  {
    id: 'bolao',
    target: '[data-tour="hub-bolao"]',
    placement: 'bottom',
    title: 'Bolão da Copa',
    content:
      'Palpites e ranking entre amigos. Entra num bolão, manda seus palpites e acompanha a classificação em tempo real.',
  },
];

// ── Fase 2: passos contextuais (1 por produto, na 1a visita à tela) ──────────

export const FUTEBOL_TOUR_ID = 'futebol';
export const BETINHO_TOUR_ID = 'betinho';
export const NBA_TOUR_ID = 'nba';
export const BOLAO_TOUR_ID = 'bolao';

// Futebol é multi-passo: apresenta o produto de fato (metodologia, datas,
// oportunidades, jogos). A barra de datas só existe quando há jogos no
// período, então o passo dela é condicional — por isso um builder.
export function makeFutebolSteps({ hasDayBar }: { hasDayBar: boolean }): Step[] {
  const steps: Step[] = [
    {
      id: 'futebol-intro',
      target: 'body',
      placement: 'center',
      title: 'Bem-vindo ao Futebol',
      content:
        'Esta é a sua central do dia. Todo dia a gente cruza as odds das casas com a nossa metodologia e destaca onde existe valor de verdade. Decisão com dado, não com achismo.',
    },
  ];

  if (hasDayBar) {
    steps.push({
      id: 'futebol-datas',
      target: '[data-tour="futebol-datas"]',
      placement: 'bottom',
      title: 'Navegue entre os dias',
      content:
        'Cada dia tem sua própria agenda. Use esta barra pra alternar entre as datas e ver as oportunidades dos próximos jogos.',
    });
  }

  steps.push(
    {
      id: 'futebol-resumo',
      target: '[data-tour="futebol-resumo"]',
      placement: 'bottom',
      title: 'O raio-x do dia',
      content:
        'Um resumo rápido: quantos jogos na agenda, quantas oportunidades pagam acima da chance real (+EV) e quantas estão na faixa Alta, as de maior confiança pela metodologia.',
    },
    {
      id: 'futebol-oportunidades',
      target: '[data-tour="futebol-oportunidades"]',
      placement: 'top',
      title: 'As oportunidades de valor',
      content:
        'Aqui ficam as principais apostas com valor do dia, ranqueadas pelo Score de Confiabilidade. Quanto maior o Score, mais o histórico sustenta aquela linha. Toque numa pra abrir a análise completa do jogo.',
    },
    {
      id: 'futebol-jogos',
      target: '[data-tour="futebol-jogos"]',
      placement: 'top',
      title: 'Todos os jogos do dia',
      content:
        'A agenda completa, com a melhor oportunidade de cada partida destacada. Um atalho pra explorar jogo por jogo.',
    },
    {
      id: 'futebol-metodologia',
      target: '[data-tour="futebol-metodologia"]',
      placement: 'top',
      title: 'Confiabilidade, não garantia',
      content:
        'Importante: o Score e a faixa medem a confiabilidade da aposta, não uma garantia de acerto. A gente aponta onde a odd paga mais do que o risco real, mas a decisão final é sempre sua.',
    },
  );

  return steps;
}

export const FUT_OPP_TOUR_ID = 'futebol-oportunidades';

// Tela /futebol/oportunidades — a régua completa. Multi-passo explicando
// filtros, leitura da lista e a metodologia do Score. Barra de datas e a
// própria lista são condicionais (dependem de dados), daí o builder.
export function makeFutebolOportunidadesSteps({
  hasDayBar,
  hasBoard,
}: {
  hasDayBar: boolean;
  hasBoard: boolean;
}): Step[] {
  const steps: Step[] = [
    {
      id: 'fut-opp-intro',
      target: 'body',
      placement: 'center',
      title: 'Todas as oportunidades',
      content:
        'Aqui está a lista completa do dia. Toda aposta com valor, ranqueada do Score mais alto pro mais baixo.',
    },
  ];

  if (hasDayBar) {
    steps.push({
      id: 'fut-opp-datas',
      target: '[data-tour="fut-opp-datas"]',
      placement: 'bottom',
      title: 'Escolha o dia',
      content: 'Cada dia tem sua própria lista. Use esta barra pra alternar entre as datas.',
    });
  }

  steps.push({
    id: 'fut-opp-filtros',
    target: '[data-tour="fut-opp-filtros"]',
    placement: 'bottom',
    title: 'Filtre do seu jeito',
    content:
      'Ajuste por mercado (resultado, gols, handicap e mais), por faixa de confiança e por competição pra chegar no que te interessa.',
  });

  if (hasBoard) {
    steps.push({
      id: 'fut-opp-lista',
      target: '[data-tour="fut-opp-lista"]',
      placement: 'top',
      title: 'Como ler cada linha',
      content:
        'Cada linha é uma aposta: o Score e a faixa de confiança, a aposta em si, a chance estimada, a melhor odd e o valor (o quanto a odd paga acima da chance). Uma régua separa o que tem valor claro do resto. Toque pra abrir a análise do jogo.',
    });
  }

  steps.push({
    id: 'fut-opp-metodologia',
    target: '[data-tour="fut-opp-metodologia"]',
    placement: 'top',
    title: 'Entenda o Score',
    content:
      'Ficou em dúvida no Score ou nas faixas? Esta parte fica sempre aqui embaixo, explicando como o Score é calculado e o que Alta, Média e Baixa significam.',
  });

  return steps;
}

export const FUT_JOGO_TOUR_ID = 'futebol-jogo';

// Tela /futebol/jogo/:id — análise completa da partida. Várias seções são
// condicionais (só existem em jogo com valor / com dados descritivos), daí o
// builder com flags. Mostrado uma vez (não por jogo).
export function makeFutebolJogoSteps({
  hasValue,
  hasModel,
  hasContext,
}: {
  hasValue: boolean;
  hasModel: boolean;
  hasContext: boolean;
}): Step[] {
  const steps: Step[] = [
    {
      id: 'fut-jogo-intro',
      target: 'body',
      placement: 'center',
      title: 'A análise do jogo',
      content:
        'Esta é a análise completa de uma partida. Tudo que a gente reuniu pra você decidir com base em dado.',
    },
    {
      id: 'fut-jogo-header',
      target: '[data-tour="fut-jogo-header"]',
      placement: 'bottom',
      title: 'O confronto',
      content:
        'Os dois times, a forma recente (os últimos resultados) e onde e quando o jogo acontece. Toque num escudo pra abrir o perfil do time.',
    },
  ];

  if (hasValue) {
    steps.push({
      id: 'fut-jogo-oque-olhar',
      target: '[data-tour="fut-jogo-oque-olhar"]',
      placement: 'top',
      title: 'O que olhar neste jogo',
      content:
        'A síntese da partida: a aposta de maior valor, o porquê dela, os pontos de atenção e o Score de confiabilidade num só lugar.',
    });
  }

  if (hasModel) {
    steps.push({
      id: 'fut-jogo-modelo',
      target: '[data-tour="fut-jogo-modelo"]',
      placement: 'top',
      title: 'Nosso modelo de gols',
      content:
        'Um modelo estatístico projeta os gols esperados e a probabilidade de cada mercado, a partir das médias da temporada.',
    });
  }

  if (hasValue) {
    steps.push({
      id: 'fut-jogo-mercados',
      target: '[data-tour="fut-jogo-mercados"]',
      placement: 'top',
      title: 'Explorar mercados',
      content:
        'Quer ir além da síntese? Aqui estão todos os mercados e opções, com chance, odd e valor lado a lado.',
    });
  }

  if (hasContext) {
    steps.push({
      id: 'fut-jogo-contexto',
      target: '[data-tour="fut-jogo-contexto"]',
      placement: 'top',
      title: 'O contexto pra fechar',
      content:
        'E pra completar a leitura: escalação provável, desfalques, confrontos diretos e as estatísticas da temporada.',
    });
  }

  return steps;
}

export const FUT_JOGOS_TOUR_ID = 'futebol-jogos';

// Tela /futebol/jogos — panorama do campeonato (rodadas, tabela, artilheiros).
// O stepper de rodada é condicional (depende de rodadas carregadas).
export function makeFutebolJogosSteps({ hasRounds }: { hasRounds: boolean }): Step[] {
  const steps: Step[] = [
    {
      id: 'fut-jogos-intro',
      target: 'body',
      placement: 'center',
      title: 'O campeonato inteiro',
      content:
        'Aqui é o panorama do campeonato: rodadas, tabela e artilheiros num lugar só.',
    },
    {
      id: 'fut-jogos-header',
      target: '[data-tour="fut-jogos-header"]',
      placement: 'bottom',
      title: 'Competição e temporada',
      content:
        'Escolha a competição (Brasileirão, Série B, Copa) e a temporada aqui em cima.',
    },
  ];

  if (hasRounds) {
    steps.push({
      id: 'fut-jogos-rodada',
      target: '[data-tour="fut-jogos-rodada"]',
      placement: 'bottom',
      title: 'Navegue pelas rodadas',
      content: 'Use as setas pra ir de uma rodada pra outra e ver os jogos de cada uma.',
    });
  }

  steps.push(
    {
      id: 'fut-jogos-lista',
      target: '[data-tour="fut-jogos-lista"]',
      placement: 'top',
      title: 'Os jogos da rodada',
      content:
        'Os jogos agrupados por dia. A etiqueta na direita mostra a faixa de valor de cada jogo. Toque pra abrir a análise completa.',
    },
    {
      id: 'fut-jogos-tabela',
      target: '[data-tour="fut-jogos-tabela"]',
      placement: 'top',
      title: 'Tabela e artilheiros',
      content:
        'Pra acompanhar a temporada: a classificação e os artilheiros, com a tabela e a lista completas a um toque.',
    },
  );

  return steps;
}

export const BETINHO_DASH_TOUR_ID = 'betinho-dashboard';

// Dashboard do Betinho (/betting-dashboard) — diagnóstico da banca.
// Alvo de "resumo" muda por viewport (StatusStrip desktop vs hero mobile).
export function makeBetinhoDashboardSteps({ isMobile }: { isMobile: boolean }): Step[] {
  return [
    {
      id: 'dash-intro',
      target: 'body',
      placement: 'center',
      title: 'O diagnóstico da banca',
      content: 'Este é o diagnóstico da sua banca: onde você ganha, onde perde, e o que dá pra ajustar.',
    },
    {
      id: 'dash-header',
      target: '[data-tour="dash-header"]',
      placement: 'bottom',
      title: 'Escolha o período',
      content:
        'Comece pelo período. Dá pra ver os números em R$ ou em unidades, e exportar tudo em CSV.',
    },
    {
      id: 'dash-stats',
      target: isMobile ? '[data-tour="dash-stats-m"]' : '[data-tour="dash-stats"]',
      placement: 'bottom',
      title: 'Seu resumo',
      content: isMobile
        ? 'Seu resumo do período num relance: lucro, ROI, acerto e a evolução.'
        : 'Seu resumo do período: banca atual, lucro, ROI e taxa de acerto.',
    },
    {
      id: 'dash-diagnostico',
      target: '[data-tour="dash-diagnostico"]',
      placement: 'bottom',
      title: 'A leitura do Betinho',
      content:
        'Aqui o Betinho lê suas apostas e conta, em texto, onde você está ganhando e onde está vazando dinheiro.',
    },
    {
      id: 'dash-heatmap',
      target: '[data-tour="dash-heatmap"]',
      placement: 'top',
      title: 'O mapa de calor',
      content:
        'Cada célula cruza liga e mercado, pintada pelo seu resultado: verde você lucra, vermelho você perde. Toque numa pra abrir o detalhe.',
    },
    {
      id: 'dash-tags',
      target: '[data-tour="dash-tags"]',
      placement: 'top',
      title: 'Performance por tag',
      content:
        'O resultado das etiquetas que você cria pra agrupar apostas (tipo "live", "gols", "palpite do grupo"). Dá pra selecionar e comparar.',
    },
    {
      id: 'dash-odds',
      target: '[data-tour="dash-odds"]',
      placement: 'top',
      title: 'Faixa de odd',
      content: 'Em quais faixas de odd a sua banca prospera e em quais ela sangra.',
    },
    {
      id: 'dash-atividade',
      target: '[data-tour="dash-atividade"]',
      placement: 'top',
      title: 'Quando você aposta',
      content: 'Seus dias mais ativos e as sequências, pra enxergar o seu padrão de atividade.',
    },
  ];
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
}): Step[] {
  const steps: Step[] = [
    {
      id: 'betinho-intro',
      target: 'body',
      placement: 'center',
      title: 'Bem-vindo ao Betinho',
      content:
        'Este é o Betinho, seu gestor de banca. Ele registra e acompanha suas apostas pra você enxergar o resultado real, sem planilha.',
    },
  ];

  if (hasEmptyState) {
    steps.push({
      id: 'betinho-telegram',
      target: '[data-tour="betinho-telegram"]',
      placement: 'bottom',
      title: 'Comece pelo Telegram',
      content:
        'É aqui que tudo começa: manda o bilhete pro Betinho no Telegram, por texto, áudio ou print, e esta tela enche sozinha. Prefere na mão? Dá pra cadastrar manualmente também.',
    });
  }

  steps.push({
    id: 'betinho-stats',
    target: isMobile ? '[data-tour="betinho-stats-m"]' : '[data-tour="betinho-stats"]',
    placement: 'bottom',
    title: 'Seus números',
    content: isMobile
      ? 'Sua banca num relance: taxa de acerto, ROI, total de apostas e a evolução no tempo.'
      : 'Sempre atualizados: ROI, lucro líquido, total apostado e taxa de acerto.',
  });

  if (!isMobile) {
    steps.push({
      id: 'betinho-evolucao',
      target: '[data-tour="betinho-evolucao"]',
      placement: 'top',
      title: 'A evolução da banca',
      content: 'A evolução da sua banca ao longo do tempo, pra ver se a estratégia está no caminho.',
    });
  }

  steps.push({
    id: 'betinho-lista',
    target: '[data-tour="betinho-lista"]',
    placement: 'top',
    title: 'Suas apostas',
    content:
      'Todas as suas apostas ficam aqui, com filtros por status, período, liga e mercado. Cada aposta que você liquida entra nos números lá de cima.',
  });

  return steps;
}

export const BANKROLL_TOUR_ID = 'bankroll';

// Fluxo de caixa (/bankroll) — tela simples, sem variações relevantes de
// viewport, então array estático.
export const bankrollSteps: Step[] = [
  {
    id: 'bankroll-intro',
    target: 'body',
    placement: 'center',
    title: 'O fluxo de caixa da banca',
    content: 'Aqui fica o dinheiro que entra e sai da sua banca, separado do lucro das apostas.',
  },
  {
    id: 'bankroll-acoes',
    target: '[data-tour="bankroll-acoes"]',
    placement: 'bottom',
    title: 'Aportes e resgates',
    content:
      'Registre aportes (o que você põe) e resgates (o que você tira) por aqui. O saldo recalcula na hora.',
  },
  {
    id: 'bankroll-resumo',
    target: '[data-tour="bankroll-resumo"]',
    placement: 'bottom',
    title: 'O resumo da banca',
    content: 'Saldo atual, total aportado, total retirado e o lucro acumulado das apostas.',
  },
  {
    id: 'bankroll-extrato',
    target: '[data-tour="bankroll-extrato"]',
    placement: 'top',
    title: 'O extrato',
    content:
      'O histórico em ordem: cada aposta liquidada, aporte e resgate, com o saldo evoluindo linha a linha.',
  },
];

export const nbaSteps: Step[] = [
  {
    id: 'nba-hero',
    target: '[data-tour="nba-hero"]',
    placement: 'bottom',
    title: 'Comece por um jogador',
    content:
      'Busque um jogador pra abrir a Análise 360: prop bets, médias e o histórico que embasa cada pick da NBA.',
  },
];

export const bolaoSteps: Step[] = [
  {
    id: 'bolao-hero',
    target: '[data-tour="bolao-hero"]',
    placement: 'bottom',
    title: 'Bolão com a galera',
    content:
      'Crie um bolão do zero ou entre num com o código, mande seus palpites e acompanhe o ranking em tempo real.',
  },
];
