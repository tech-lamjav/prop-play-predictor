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

export const betinhoSteps: Step[] = [
  {
    id: 'betinho-hero',
    target: '[data-tour="betinho-hero"]',
    placement: 'bottom',
    title: 'Sua banca, no automático',
    content:
      'Tudo o que você registra com o Betinho no Telegram cai aqui: apostas, resultado, lucro e ROI sempre atualizados. Sem planilha.',
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
