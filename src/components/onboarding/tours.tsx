import type { Step } from 'react-joyride';

// Passos do onboarding guiado. Escopo Fase 1: o hub /inicio (boas-vindas + 1
// passo por destino). Os passos contextuais dentro de cada produto entram numa
// fase seguinte, ancorados por data-tour nas respectivas telas.
//
// Régua de copy: linguagem o mais simples possível (nosso público tem baixo
// letramento em média). Evitar palavra difícil e termo em inglês; jargão de
// apostador que ele já conhece (over, ambos marcam, handicap, odd, linha, ROI,
// prop, pick, desfalque, escalação, artilheiro, unidade, aporte) pode ficar.

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
      'As oportunidades do dia: o que o modelo leu em cada jogo, com o Score pra você comparar e o preço de mercado ao lado. É por aqui que a maioria começa.',
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
      'Prop bets e painéis dos jogadores, a análise mais completa pra quem acompanha a NBA de perto.',
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

// Futebol é multi-passo: apresenta o produto de fato (método, datas,
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
        'Esta é a sua central do dia. Todo dia a gente cruza as odds das casas com o nosso método e destaca onde existe valor de verdade. Decisão com dado, não com achismo.',
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
        'Um resumo rápido: quantos jogos na agenda, quantas oportunidades pagam acima da chance real e quantas estão na faixa Alta, as de maior confiança pelo nosso método.',
    },
    {
      id: 'futebol-oportunidades',
      target: '[data-tour="futebol-oportunidades"]',
      placement: 'top',
      // Bloco grande: mais respiro nas bordas do destaque que o padrão (6).
      spotlightPadding: 14,
      title: 'As oportunidades do dia',
      content:
        'Aqui ficam as principais leituras do dia, ordenadas pelo Score de Confiabilidade. Quanto maior o Score, mais o histórico apoia aquela linha. Toque numa pra abrir a análise completa do jogo.',
    },
    {
      id: 'futebol-jogos',
      target: '[data-tour="futebol-jogos"]',
      placement: 'top',
      spotlightPadding: 14,
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
// filtros, leitura da lista e o Score. Barra de datas e a própria lista são
// condicionais (dependem de dados), daí o builder.
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
        'Aqui está a lista completa do dia, ordenada do Score mais alto pro mais baixo. O filtro de valor separa as que pagam acima do preço justo.',
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
    // Box com borda: folga o spotlight pra o texto não colar no contorno.
    spotlightPadding: 14,
    title: 'Entenda o Score',
    content:
      'Ficou em dúvida no Score ou nas faixas? Esta parte fica sempre aqui embaixo, explicando como o Score é calculado e o que Alta, Média e Baixa significam.',
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
}): Step[] {
  const steps: Step[] = [
    {
      id: 'fut-jogo-intro',
      target: 'body',
      placement: 'center',
      title: 'A leitura do jogo',
      content:
        'Esta tela responde uma pergunta só: o que os números deste jogo sustentam. A aposta vem depois disso, não antes.',
    },
    {
      id: 'fut-jogo-header',
      target: '[data-tour="fut-jogo-header"]',
      placement: 'bottom',
      title: 'O confronto',
      content:
        'Os dois times, como cada um vem chegando, e à direita a melhor leitura da partida com o Score dela.',
    },
    {
      id: 'fut-jogo-abas',
      target: '[data-tour="fut-jogo-abas"]',
      placement: 'bottom',
      title: 'Duas abas',
      content:
        'Leitura e mercados é onde a análise mora. Times é o retrato dos dois: campanha, forma e confrontos diretos.',
    },
    {
      id: 'fut-jogo-mercados',
      target: '[data-tour="fut-jogo-mercados"]',
      placement: ladoALado ? 'right' : 'bottom',
      title: 'Os cinco mercados, sempre à vista',
      content:
        'Gols, resultado, handicap, ambos marcam e dupla chance ficam sempre à mão, em coluna no computador e numa fileira que rola no celular. A barra é o Score de cada um, e o tracinho é a régua que separa o que vale olhar.',
    },
    {
      id: 'fut-jogo-folha',
      target: '[data-tour="fut-jogo-folha"]',
      placement: ladoALado ? 'left' : 'center',
      title: 'A folha do mercado',
      content:
        'Clique num mercado e ele abre aqui: a aposta, a chance, a odd, a vantagem sobre o preço e o veredito em uma frase.',
    },
  ];

  if (hasRegua) {
    steps.push({
      id: 'fut-jogo-regua',
      target: '[data-tour="fut-jogo-regua"]',
      placement: 'bottom',
      title: 'Arraste a linha',
      content:
        'Nos gols e no handicap dá para arrastar a bolinha e ver a leitura mudar em cada linha. As bolinhas maiores são as linhas que mais premissas sustentam.',
    });
  }

  if (hasPremissas) {
    steps.push({
      id: 'fut-jogo-premissas',
      target: '[data-tour="fut-jogo-premissas"]',
      placement: 'top',
      title: 'A favor e contra',
      content:
        'Aqui está o porquê: o que sustenta a leitura, o que faltou acontecer e, em cada premissa, o "ver os jogos" abre o gráfico dos jogos que produziram aquele número.',
    });
  }

  return steps;
}

export const FUT_JOGOS_TOUR_ID = 'futebol-jogos';

// Tela /futebol/jogos — agenda por dia, todas as ligas juntas. O passo do painel
// só existe no desktop, porque em telas menores o clique navega pra tela do jogo
// e o alvo não está montado.
export function makeFutebolJogosSteps({ hasPanel }: { hasPanel: boolean }): Step[] {
  const steps: Step[] = [
    {
      id: 'fut-jogos-intro',
      target: 'body',
      placement: 'center',
      title: 'Os jogos do dia',
      content:
        'Aqui ficam os jogos de todos os campeonatos, dia por dia. É a resposta pra "o que tem hoje".',
    },
    {
      id: 'fut-jogos-datas',
      target: '[data-tour="fut-jogos-datas"]',
      placement: 'bottom',
      title: 'Escolha o dia',
      content:
        'Use as setas pra andar pelos dias, ou o calendário pra pular pra qualquer data. O pontinho embaixo do dia avisa que tem jogo.',
    },
    {
      id: 'fut-jogos-lista',
      target: '[data-tour="fut-jogos-lista"]',
      placement: 'top',
      title: 'A leitura na própria linha',
      content:
        'Os jogos vêm separados por campeonato, e cada campeonato recolhe. Na linha: o mercado, a aposta, a odd e o selo do Score. Jogo encerrado troca o Score por certo ou errado, dizendo se a leitura bateu.',
    },
  ];

  if (hasPanel) {
    steps.push({
      id: 'fut-jogos-painel',
      target: '[data-tour="fut-jogos-painel"]',
      placement: 'left',
      title: 'O porquê, do lado',
      content:
        'Clique num jogo e o resumo abre aqui, sem sair da lista: o que sustenta a leitura, o que pesa contra e como os dois times chegam. Pra ver tudo, é o botão de análise completa.',
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
}): Step[] {
  const steps: Step[] = [
    {
      id: 'fut-camp-intro',
      target: 'body',
      placement: 'center',
      title: 'O campeonato inteiro',
      content: 'Aqui é a visão de uma competição: rodada a rodada, com os números da temporada.',
    },
    {
      id: 'fut-camp-header',
      target: '[data-tour="fut-camp-header"]',
      placement: 'bottom',
      title: 'Competição e números',
      content:
        'Troque de campeonato ou de temporada aqui em cima. Embaixo ficam os números da temporada: média de gols, quanto passa de 2,5, quanto o mandante ganha e em quantos jogos os dois lados marcam.',
    },
  ];

  if (hasRounds) {
    steps.push({
      id: 'fut-camp-rodada',
      target: '[data-tour="fut-camp-rodada"]',
      placement: 'bottom',
      title: ehCopa ? 'A régua de fases' : 'A régua de rodadas',
      content: ehCopa
        ? 'Todas as fases numa linha, da primeira até a final: clique em qualquer uma pra ver os jogos dela. As de areia já passaram, a verde é a que está aberta.'
        : 'A temporada inteira numa linha: clique em qualquer rodada pra ver os jogos dela. As de areia já passaram, a verde é a que está aberta.',
    });
  }

  // O alvo muda por viewport: no desktop é a coluna da direita, no celular é a
  // barra de abas (a coluna existe no DOM mas fica escondida, e apontar pra ela
  // deixava o último passo no vazio).
  steps.push({
    id: 'fut-camp-tabela',
    target: isMobile ? '[data-tour="fut-camp-abas"]' : '[data-tour="fut-camp-tabela"]',
    placement: isMobile ? 'bottom' : 'top',
    title: isMobile
      ? (ehCopa ? 'Fase, chave e artilheiros' : 'Rodada, tabela e artilheiros')
      : (ehCopa ? 'A chave e os artilheiros' : 'A tabela e os artilheiros'),
    content: isMobile
      ? (ehCopa
          ? 'Nestas abas você troca entre os jogos da fase, a chave da competição (ou a tabela dos grupos, quando ela está na fase de grupos) e os artilheiros.'
          : 'Nestas abas você troca entre os jogos da rodada, a classificação separada por zona e os artilheiros.')
      : (ehCopa
          ? 'Copa não tem tabela de pontos, tem chave: os confrontos fase a fase até a final, com ida e volta somadas. Na fase de grupos, este mesmo espaço mostra a tabela de cada grupo.'
          : 'A classificação vem separada por zona, com o miolo recolhido pra caber na tela, e logo abaixo os artilheiros.'),
  });

  return steps;
}

export const BETINHO_DASH_TOUR_ID = 'betinho-dashboard';

// Painel do Betinho (/betting-dashboard) — a leitura da banca.
// Alvo de "resumo" muda por viewport (StatusStrip desktop vs hero mobile).
export function makeBetinhoDashboardSteps({ isMobile }: { isMobile: boolean }): Step[] {
  return [
    {
      id: 'dash-intro',
      target: 'body',
      placement: 'center',
      title: 'O raio-x da banca',
      content: 'Este é o raio-x da sua banca: onde você ganha, onde perde, e o que dá pra ajustar.',
    },
    {
      id: 'dash-header',
      target: '[data-tour="dash-header"]',
      placement: 'bottom',
      title: 'Escolha o período',
      content:
        'Comece pelo período. Dá pra ver os números em R$ ou em unidades, e baixar tudo em planilha.',
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
        'Cada quadradinho cruza liga e mercado, pintado pelo seu resultado: verde você lucra, vermelho você perde. Toque num pra abrir o detalhe.',
    },
    {
      id: 'dash-tags',
      target: '[data-tour="dash-tags"]',
      placement: 'top',
      title: 'Resultado por etiqueta',
      content:
        'O resultado das etiquetas que você cria pra agrupar apostas (tipo "live", "gols", "palpite do grupo"). Dá pra selecionar e comparar.',
    },
    {
      id: 'dash-odds',
      target: '[data-tour="dash-odds"]',
      placement: 'top',
      title: 'Faixa de odd',
      content: 'Em quais faixas de odd a sua banca cresce e em quais ela perde dinheiro.',
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

export const FUTEBOL_TIME_TOUR_ID = 'futebol-time';

// Perfil do time (/futebol/time/:id). Raio-X é condicional a dados.
export function makeFutebolTimeSteps({ hasRaiox }: { hasRaiox: boolean }): Step[] {
  const steps: Step[] = [
    {
      id: 'ftime-intro',
      target: 'body',
      placement: 'center',
      title: 'O perfil do time',
      content: 'Como o time vem jogando, traduzido em números.',
    },
    {
      id: 'ftime-header',
      target: '[data-tour="ftime-header"]',
      placement: 'bottom',
      title: 'A visão geral',
      content: 'Posição na tabela, forma recente e o balanço de vitórias, empates e derrotas.',
    },
    {
      id: 'ftime-medias',
      target: '[data-tour="ftime-medias"]',
      placement: 'top',
      title: 'Médias e eficiência',
      content:
        'As médias por mando (geral, casa e fora) e a eficiência: os gols que fez contra o que era esperado (xG), pra ver se o time está numa fase quente ou fria.',
    },
  ];
  if (hasRaiox) {
    steps.push({
      id: 'ftime-raiox',
      target: '[data-tour="ftime-raiox"]',
      placement: 'top',
      title: 'O raio-X da temporada',
      content: 'Jogos sem sofrer gol, sequências, e a frequência de over 2.5 e de ambos marcam.',
    });
  }
  steps.push({
    id: 'ftime-resultados',
    target: '[data-tour="ftime-resultados"]',
    placement: 'top',
    title: 'Os últimos jogos',
    content: 'Os resultados recentes, com placar, adversário e mando.',
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

// NBA hub (/home-nba). Multi-passo; todas as âncoras existem após o load,
// então array estático (disparo gated em !isLoading na página).
export const nbaSteps: Step[] = [
  {
    id: 'nba-intro',
    target: 'body',
    placement: 'center',
    title: 'Bem-vindo às Análises NBA',
    content:
      'Todo dia a gente cruza jogadores, lesões e jogos pra achar as melhores oportunidades de prop bet da NBA.',
  },
  {
    id: 'nba-hero',
    target: '[data-tour="nba-hero"]',
    placement: 'bottom',
    title: 'Comece por um jogador',
    content:
      'Busque um jogador aqui pra abrir a Análise 360 dele: prop bets, médias e o histórico por trás de cada pick.',
  },
  {
    id: 'nba-hots',
    target: '[data-tour="nba-hots"]',
    placement: 'top',
    title: 'Oportunidades quentes',
    content:
      'As props mais quentes do dia. Toque numa pra ver a análise, ou abra a lista completa pra comparar lado a lado.',
  },
  {
    id: 'nba-injuries',
    target: '[data-tour="nba-injuries"]',
    placement: 'top',
    title: 'Lesões que mexem no jogo',
    content:
      'As lesões que mais impactam os jogos de hoje, e quem tende a se valorizar por causa delas.',
  },
  {
    id: 'nba-jogos',
    target: '[data-tour="nba-jogos"]',
    placement: 'top',
    title: 'Jogos de hoje',
    content: 'Os jogos do dia. Toque num pra abrir o confronto completo, com escalações e oportunidades.',
  },
  {
    id: 'nba-relatorio',
    target: '[data-tour="nba-relatorio"]',
    placement: 'top',
    title: 'Relatório do dia',
    content: 'Um resumo com as melhores análises e picks do dia, tudo num lugar só.',
  },
];

export const NBA_GAMES_TOUR_ID = 'nba-games';

// Jogos NBA (/home-games). dateNavBlock renderiza 1x conforme viewport, então
// a âncora vai na definição dele; demais seções são container único.
export const nbaGamesSteps: Step[] = [
  {
    id: 'nba-games-intro',
    target: 'body',
    placement: 'center',
    title: 'Os jogos da NBA',
    content: 'Todos os jogos de NBA do dia, num lugar só.',
  },
  {
    id: 'nba-games-data',
    target: '[data-tour="nba-games-data"]',
    placement: 'bottom',
    title: 'Escolha o dia',
    content: 'Navegue entre as datas aqui pra ver os jogos de outros dias.',
  },
  {
    id: 'nba-games-lista',
    target: '[data-tour="nba-games-lista"]',
    placement: 'top',
    title: 'Os jogos',
    content: 'Cada card é um jogo: horário, times e o placar quando rola. Toque pra abrir o confronto completo.',
  },
  {
    id: 'nba-games-sidebar',
    target: '[data-tour="nba-games-sidebar"]',
    placement: 'top',
    title: 'Atalhos do dia',
    content: 'Na lateral: a melhor oportunidade, as lesões do dia e o atalho pro relatório.',
  },
];

export const NBA_GAME_TOUR_ID = 'nba-game';

// Detalhe do jogo NBA (/game/:id). Conteúdo atrás do gate !game, então o
// disparo espera o jogo carregar. HeroCard/abas cuidam do responsivo internamente.
export const nbaGameSteps: Step[] = [
  {
    id: 'nba-game-intro',
    target: 'body',
    placement: 'center',
    title: 'O confronto',
    content: 'Tudo sobre o jogo num lugar só, pra você montar suas props com contexto.',
  },
  {
    id: 'nba-game-hero',
    target: '[data-tour="nba-game-hero"]',
    placement: 'bottom',
    title: 'Os dois times',
    content: 'O placar ou o horário, e as notas de ataque e defesa de cada lado.',
  },
  {
    id: 'nba-game-abas',
    target: '[data-tour="nba-game-abas"]',
    placement: 'top',
    title: 'As visões do jogo',
    content:
      'Escalações e lesões, oportunidades de prop do jogo, e as estatísticas completas quando a partida termina. Toque nas abas pra alternar.',
  },
];

export const NBA_DASH_TOUR_ID = 'nba-dashboard';

// Painel do jogador (/nba-dashboard/:player). Blocos desktop/mobile são
// DUPLICADOS no DOM (toggle por CSS no breakpoint lg=1024). `mobile` escolhe o
// alvo do bloco visível (a página calcula via matchMedia 1024, não useIsMobile).
export function makeNbaDashSteps({ mobile }: { mobile: boolean }): Step[] {
  const t = (id: string) => `[data-tour="${id}${mobile ? '-m' : ''}"]`;
  return [
    {
      id: 'nba-dash-intro',
      target: 'body',
      placement: 'center',
      title: 'O painel do jogador',
      content: 'Médias, histórico e as props do dia deste jogador, tudo num lugar.',
    },
    {
      id: 'nba-dash-header',
      target: t('nba-dash-header'),
      placement: 'bottom',
      title: 'O jogador em números',
      content: 'Foto, time e as médias que importam pra ler as linhas.',
    },
    {
      id: 'nba-dash-opps',
      target: t('nba-dash-opps'),
      placement: 'top',
      title: 'As oportunidades do dia',
      content: 'As props do jogador pra hoje, com a linha e a vantagem.',
    },
    {
      id: 'nba-dash-chart',
      target: t('nba-dash-chart'),
      placement: 'top',
      title: 'O gráfico de desempenho',
      content:
        'Escolha a estatística e veja jogo a jogo, com a linha da aposta na frente pra comparar.',
    },
  ];
}

export const ANALISE360_LIST_TOUR_ID = 'nba-analise360-list';

// Análise 360 lista (/analise-360, premium). Grid é gated por dados.
export function makeAnalise360ListSteps({ hasGrid }: { hasGrid: boolean }): Step[] {
  const steps: Step[] = [
    {
      id: 'a360l-intro',
      target: 'body',
      placement: 'center',
      title: 'Análise 360',
      content:
        'Parte de um desfalque (um titular fora) e mostra quem herda os minutos e se valoriza nas props.',
    },
    {
      id: 'a360l-header',
      target: '[data-tour="a360l-header"]',
      placement: 'bottom',
      title: 'O impacto das lesões de hoje',
      content: 'A lista é do dia: traz as lesões e desfalques de hoje e quem se beneficia com cada um.',
    },
  ];
  if (hasGrid) {
    steps.push({
      id: 'a360l-grid',
      target: '[data-tour="a360l-grid"]',
      placement: 'top',
      title: 'Os gatilhos do dia',
      content:
        'Cada card é uma lesão, agrupada por status (fora, dúvida). Toque num pra ver os companheiros valorizados.',
    });
  }
  return steps;
}

export const ANALISE360_DETAIL_TOUR_ID = 'nba-analise360-detail';

// Análise 360 detalhe (/analise-360/:id, premium). Conteúdo atrás de
// isLoading/!triggerInfo; cadeia troca componente por viewport internamente
// (um elemento só), então array estático.
export const nbaAnalise360DetailSteps: Step[] = [
  {
    id: 'a360d-intro',
    target: 'body',
    placement: 'center',
    title: 'A Análise 360 do gatilho',
    content: 'Quem se valoriza quando este jogador não joga, e o quanto cada linha muda.',
  },
  {
    id: 'a360d-header',
    target: '[data-tour="a360d-header"]',
    placement: 'bottom',
    title: 'O jogador que saiu',
    content: 'O status, as estrelas de impacto e, nas abas, a estatística que você quer analisar.',
  },
  {
    id: 'a360d-cadeia',
    target: '[data-tour="a360d-cadeia"]',
    placement: 'top',
    title: 'A cadeia de impacto',
    content:
      'Com ele de fora, pra onde vão os minutos e os chutes do time, e quem herda o quê. Toque num jogador pra abrir a análise.',
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
