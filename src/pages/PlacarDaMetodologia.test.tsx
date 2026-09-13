import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import type { LinhaPublicada } from '@/components/placar/placar-agregacao';

// ============================================================================
// A página do placar sobe
// ============================================================================
// Os componentes têm teste de comportamento e a aritmética tem teste próprio,
// mas a PÁGINA — a que liga o estado, a consulta, o recorte e a tela — não
// tinha nenhum. O buraco é de um tipo específico: nada aqui quebra typecheck
// nem teste de unidade, e o defeito aparece como tela branca no navegador.
//
// O header do site e a faixa da área são trocados por dublês: os dois puxam
// autenticação, assinatura e Telegram, que não têm nada a ver com o que esta
// página decide, e montá-los aqui testaria o site inteiro por engano.
// ============================================================================

vi.mock('@/components/AnalyticsNav', () => ({
  default: () => <nav>header do site</nav>,
}));

const estado = vi.hoisted(() => ({
  publicadas: [] as LinhaPublicada[],
  tipo: 'pronto' as 'pronto' | 'carregando' | 'erro',
}));

vi.mock('@/hooks/use-oportunidades-publicadas', () => ({
  useOportunidadesPublicadas: () =>
    estado.tipo === 'pronto'
      ? { tipo: 'pronto', publicadas: estado.publicadas }
      : { tipo: estado.tipo },
}));

vi.mock('@/hooks/use-futebol-data', () => ({
  useVitrine: () => ({
    vitrine: [{ market: 'asian_handicap', ocultoDesde: '2026-09-01T00:00:00Z' }],
    ocultos: ['asian_handicap'],
    isLoading: false,
  }),
}));

const { default: PlacarDaMetodologia } = await import('./PlacarDaMetodologia');

const linha = (p: Partial<LinhaPublicada> = {}): LinhaPublicada => ({
  opportunity_key: Math.random().toString(36).slice(2),
  fixture_id: 1,
  competition: 'Brasileirão',
  home_team_name: 'Casa',
  away_team_name: 'Fora',
  kickoff_utc: '2026-09-10T23:00:00',
  status_short: 'FT',
  goals_home: 2,
  goals_away: 0,
  detectada_em: '2026-09-10T03:00:00',
  market: 'match_winner',
  outcome: 'Home',
  line_value: null,
  best_odd: 2,
  edge: 1,
  score: 65,
  faixa: 'Alta',
  score_versao: 'contexto_v1',
  pts_premissas: 20,
  penalidades: 0,
  premissas_sem_dado: 0,
  modelo_api_concorda: true,
  linha_sharp_confirma: false,
  pen_odd_outlier: false,
  pen_poucas_casas: false,
  pen_odd_longshot: false,
  pen_odd_juice: false,
    premissas_acesas: [],
  ...p,
});

const montar = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/socios/metodologia']}>
        <PlacarDaMetodologia />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe('a página do placar', () => {
  it('monta com dado e mostra a identidade, o filtro e as tabelas', () => {
    estado.tipo = 'pronto';
    estado.publicadas = [linha(), linha({ outcome: 'Away' })];
    montar();

    expect(screen.getByRole('heading', { name: 'Metodologia', level: 1 })).toBeInTheDocument();
    // O seletor mostra a janela no próprio botão: a série comparável começa em
    // 04/09, e os atalhos vivem dentro do popover, que abre fechado.
    expect(screen.getByText(/^04\/09 a /)).toBeInTheDocument();
    expect(screen.getByText('Por apito')).toBeInTheDocument();
    expect(screen.getByText('Board inteiro')).toBeInTheDocument();
    expect(screen.getByText('Por mercado')).toBeInTheDocument();
    expect(screen.getByText(/2 oportunidades publicadas no período/)).toBeInTheDocument();
  });

  // A porta de volta para o CRM saiu daqui: ela agora é uma pílula da faixa 2 do
  // cabeçalho do site, como Futebol e NBA. Quem guarda isso é crm-rota.test.ts,
  // que lê o AnalyticsNav — aqui o header é um dublê.

  it('sem nada publicado, não finge resultado', () => {
    estado.publicadas = [];
    montar();
    expect(screen.getByText(/0 oportunidades publicadas no período/)).toBeInTheDocument();
    expect(screen.getAllByText(/nenhuma oportunidade liquidada/i).length).toBeGreaterThan(0);
  });

  it('carregando, não mostra tabela vazia', () => {
    estado.tipo = 'carregando';
    montar();
    expect(screen.getByText('Carregando…')).toBeInTheDocument();
    expect(screen.queryByText('Por mercado')).not.toBeInTheDocument();
  });

  it('com erro, diz que não deu para carregar em vez de dizer que não houve nada', () => {
    // Tabela vazia afirmaria que a metodologia não publicou nada, o que é
    // diferente de não ter resposta.
    estado.tipo = 'erro';
    montar();
    expect(screen.getByText(/não deu para carregar/i)).toBeInTheDocument();
  });
});
