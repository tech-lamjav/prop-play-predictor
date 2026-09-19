import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Os dois degraus do meio do funil: motivos e análise completa
// ============================================================================
// A spec pede "abertura dos motivos e da análise completa" na lista mínima de
// testes, e esses dois degraus têm uma particularidade que vale travar:
//
//  1. `opportunity_reason_expanded` só vale na ABERTURA. O mesmo cabeçalho que
//     abre a premissa também a fecha, e contar os dois sentidos com um evento
//     chamado "expandiu" inflaria o degrau exatamente onde se quer medir
//     interesse.
//
//  2. `opportunity_analysis_opened` sai de DOIS caminhos para a mesma tela — o
//     título do painel e o botão do rodapé. Com um rótulo só, o botão levaria o
//     crédito de um clique que aconteceu no título, e a conclusão seria "o
//     título não é usado", que é falsa.
//
// Aqui se testa o CONTRATO dos dois eventos, não a árvore de componentes: a
// bancada e o painel exigem board, premissas, histórico e acesso para montar, e
// um teste que arma tudo isso mede a montagem, não a regra.
// ============================================================================

const { capturas } = vi.hoisted(() => ({
  capturas: [] as { nome: string; props: Record<string, unknown> }[],
}));

vi.mock('posthog-js', () => ({
  default: {
    capture: (nome: string, props: Record<string, unknown>) => {
      capturas.push({ nome, props });
    },
    identify: vi.fn(),
    reset: vi.fn(),
  },
}));
vi.mock('@/config/environment', () => ({
  config: { posthog: { key: 'fake-key', host: 'https://h' } },
}));

import { analiseAberta, motivosExpandidos, propsDaOportunidade } from '@/lib/analytics';

const OPORTUNIDADE = {
  fixture_id: 123,
  market: 'match_winner',
  outcome: 'Home',
  line_value: null,
  competition: 'brasileirao',
  faixa: 'Alta',
  score: 72,
};

const comuns = () =>
  propsDaOportunidade(OPORTUNIDADE, {
    source: 'games_list',
    subscription_status: 'subscribed',
  });

beforeEach(() => {
  capturas.length = 0;
});

describe('abertura dos motivos', () => {
  it('carrega a premissa aberta, o grupo e quantos motivos havia', () => {
    motivosExpandidos({
      ...comuns(),
      reason_type: 'a_favor',
      reason_count: 4,
      premissa: 'superioridade_tabela',
    });

    expect(capturas).toHaveLength(1);
    const { nome, props } = capturas[0];
    expect(nome).toBe('opportunity_reason_expanded');
    expect(props.premissa).toBe('superioridade_tabela');
    expect(props.reason_count).toBe(4);
    expect(props.opportunity_id).toBe('123|match_winner|Home|');
    expect(props.game_id).toBe(123);
  });

  it('o grupo do outro lado usa o vocabulário do domínio', () => {
    // "Contra" é verbete do CONTEXT.md, e significa premissa DO PRÓPRIO LADO
    // que não atingiu o corte — não sinal para o lado oposto. O nome longo é o
    // que impede a leitura errada no painel, onde ninguém tem o glossário.
    motivosExpandidos({
      ...comuns(),
      reason_type: 'nao_atingiu_o_corte',
      reason_count: 2,
      premissa: 'defesas_vazaveis',
    });

    expect(capturas[0].props.reason_type).toBe('nao_atingiu_o_corte');
  });
});

describe('abertura da análise completa', () => {
  it('os dois caminhos se distinguem', () => {
    analiseAberta({
      ...comuns(),
      analysis_type: 'titulo_do_painel',
      destination_path: '/futebol/jogo/123?mercado=match_winner&saida=Home',
    });
    analiseAberta({
      ...comuns(),
      analysis_type: 'botao_do_rodape',
      destination_path: '/futebol/jogo/123?mercado=match_winner&saida=Home',
    });

    expect(capturas.map((c) => c.props.analysis_type)).toEqual([
      'titulo_do_painel',
      'botao_do_rodape',
    ]);
  });

  it('leva o destino, porque a navegação pode não terminar', () => {
    // O `$pageview` da tela de destino é quem confirma a chegada. A diferença
    // entre os dois eventos é o abandono no meio do caminho.
    analiseAberta({
      ...comuns(),
      analysis_type: 'botao_do_rodape',
      destination_path: '/futebol/jogo/123',
    });

    expect(capturas[0].nome).toBe('opportunity_analysis_opened');
    expect(capturas[0].props.destination_path).toBe('/futebol/jogo/123');
  });
});

describe('o clique originado na página de oportunidades', () => {
  it('emite os DOIS eventos, e eles respondem perguntas diferentes', async () => {
    // `opportunity_opened` é o degrau do funil da oportunidade;
    // `futebol_game_clicked` é o da navegação entre telas, e responde "de onde
    // veio quem abriu este jogo". Emitir só um deixaria um dos funis cego.
    const { jogoClicado, oportunidadeAberta, idDaOportunidade } = await import(
      '@/lib/analytics'
    );
    const props = propsDaOportunidade(OPORTUNIDADE, {
      source: 'opportunities',
      subscription_status: 'subscribed',
      position: 2,
    });
    const destino = '/futebol/jogo/123?mercado=match_winner&saida=Home';

    oportunidadeAberta({ ...props, open_mode: 'card', destination_path: destino });
    jogoClicado({
      game_id: OPORTUNIDADE.fixture_id,
      source: 'opportunities',
      position: 2,
      is_featured: false,
      destination_path: destino,
      competition: OPORTUNIDADE.competition,
      opportunity_id: idDaOportunidade(OPORTUNIDADE),
    });

    expect(capturas.map((c) => c.nome)).toEqual([
      'opportunity_opened',
      'futebol_game_clicked',
    ]);
    // A MESMA oportunidade nos dois, senão o funil não costura.
    expect(capturas[0].props.opportunity_id).toBe(capturas[1].props.opportunity_id);
    expect(capturas[0].props.position).toBe(2);
    expect(capturas[1].props.position).toBe(2);
    expect(capturas[1].props.is_featured).toBe(false);
  });

  it('o clique no destaque da home se diferencia pela origem', () => {
    // É a pergunta número um da spec: qual elemento levou a abrir o jogo.
    capturas.length = 0;
    return import('@/lib/analytics').then(({ jogoClicado }) => {
      jogoClicado({
        game_id: 123,
        source: 'home_featured',
        position: 0,
        is_featured: true,
        destination_path: '/futebol/jogo/123',
        competition: 'brasileirao',
        opportunity_id: '123|match_winner|Home|',
      });

      expect(capturas[0].props.source).toBe('home_featured');
      expect(capturas[0].props.is_featured).toBe(true);
    });
  });
});
