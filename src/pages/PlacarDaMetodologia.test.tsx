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
  /** Os argumentos de cada chamada do hook, para saber qual consulta sai. */
  chamadas: [] as unknown[][],
}));

vi.mock('@/hooks/use-oportunidades-publicadas', () => ({
  useOportunidadesPublicadas: (...args: unknown[]) => {
    estado.chamadas.push(args);
    return estado.tipo === 'pronto'
      ? { tipo: 'pronto', publicadas: estado.publicadas }
      : { tipo: estado.tipo };
  },
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

  it('abre na vitrine, porque a primeira pergunta é como foi o produto no ar', () => {
    // O padrão era o board inteiro. Ele respondia calado a segunda pergunta —
    // como está a metodologia — somando na mesma conta a linha que o assinante
    // nunca viu. A decisão sobre o mercado oculto continua aqui, a um clique.
    estado.tipo = 'pronto';
    estado.publicadas = [linha(), linha({ market: 'asian_handicap' })];
    montar();

    expect(screen.getByRole('button', { name: 'Só a vitrine', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Board inteiro', pressed: false })).toBeInTheDocument();
    // E a tela diz quantas ficaram de fora: sem isso, a conta encolhe calada.
    expect(screen.getByText(/uma oportunidade ficou de fora/i)).toBeInTheDocument();
  });

  it('abre simulando com as unidades que os sócios usam, e diz que é simulação', () => {
    // Zero na Baixa, meia na Média, uma nas Altas: pedido como padrão para a
    // primeira leitura já responder "como a gente teria ido". Como não é o
    // número medido em unidade fixa, o aviso tem de estar lá desde o começo.
    estado.tipo = 'pronto';
    estado.publicadas = [linha()];
    montar();

    expect(screen.getByText('Simulação ligada.')).toBeInTheDocument();
    expect(screen.getByText(/Baixa \(<30\) 0u · Média \(30–59\) 0,5u · Alta \(60–79\) 1u · Alta \(80\+\) 1u/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /simulando/i })).toBeInTheDocument();
  });

  // A porta de volta para o CRM saiu daqui: ela agora é uma pílula da faixa 2 do
  // cabeçalho do site, como Futebol e NBA. Quem guarda isso é crm-rota.test.ts,
  // que lê o AnalyticsNav — aqui o header é um dublê.

  it('sem comparação, a consulta do segundo período nem sai', () => {
    // Ela saía com datas iguais, "vazia e barata". Não era barata: rodava a
    // consulta inteira do placar de novo, e em produção disputava o mesmo
    // limite de tempo da primeira.
    estado.tipo = 'pronto';
    estado.publicadas = [linha()];
    estado.chamadas.length = 0;
    montar();

    const ativas = estado.chamadas.map((args) => args[2] ?? true);
    expect(ativas).toContain(true);
    expect(ativas).toContain(false);
  });

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
