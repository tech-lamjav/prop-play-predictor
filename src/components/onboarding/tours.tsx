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
      'Em 30 segundos te mostro o que cada área faz. Pode pular quando quiser — dá pra rever depois nas configurações.',
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
      'Prop bets e dashboards dos jogadores — a análise mais robusta pra quem acompanha a NBA de perto.',
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

export const futebolSteps: Step[] = [
  {
    id: 'futebol-hero',
    target: '[data-tour="futebol-hero"]',
    placement: 'bottom',
    title: 'Seu dia no futebol',
    content:
      'Aqui ficam as oportunidades de valor do dia, com o Score pra você comparar num relance onde o dado aponta vantagem. Toque numa oportunidade pra abrir a análise completa.',
  },
];

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
