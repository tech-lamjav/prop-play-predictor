import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotivosJogoPorJogo } from './MotivosJogoPorJogo';
import { premissaDe } from '@/utils/futebol-premissas';
import { separarMotivosDoContrato } from '@/utils/futebol-motivos';
import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';
import { alinharAbaixoDoCabecalho } from '@/utils/rolagem';

vi.mock('@/utils/rolagem', () => ({ alinharAbaixoDoCabecalho: vi.fn() }));

// ============================================================================
// O que as abas A favor e Contra mostram (issue #306, spec #301)
// ============================================================================
// A decisão de qual motivo entra em qual grupo é do backend. O que se testa
// aqui é o observável: a aba exibe as premissas que recebeu, não anuncia preço
// como cenário do jogo, e não afirma o contrário de uma premissa a favor.
// ============================================================================

const premissas = (market: string, slugs: string[]) =>
  slugs.map((s) => premissaDe(market, s)!).filter(Boolean);

function renderAba(
  modo: 'favor' | 'contra',
  slugs: string[],
  extras: { t: string; sub?: string }[] = [],
) {
  return render(
    <MotivosJogoPorJogo
      mercado="goals_over_under"
      premissas={premissas('goals_over_under', slugs)}
      modo={modo}
      extras={extras}
      historico={[]}
      numeros={[]}
      lado={null}
      linha={1.5}
      saidaLabel="Mais de 1,5 gols"
    />,
  );
}

describe('aba A favor', () => {
  it('lista as premissas que o backend mandou, com a saída no fechamento', () => {
    renderAba('favor', ['xg_combinado_alto', 'ritmo_alto']);

    expect(screen.getByText(/2 motivos sustentam mais de 1,5 gols/i)).toBeInTheDocument();
  });

  it('diz que não há motivo quando o backend não mandou nenhum', () => {
    renderAba('favor', []);

    expect(screen.getByText('Nenhum motivo a favor desta saída.')).toBeInTheDocument();
  });
});

describe('a aba do que não atingiu o corte', () => {
  // O rótulo "Contra" AFIRMAVA oposição, e o dado de produção diz o contrário:
  // `favor` e `contra` somados são exatamente as premissas do próprio lado (#351).
  // Estes testes guardam a afirmação, não a frase: o cabeçalho não pode voltar a
  // dizer que existe evidência empurrando para o outro lado.
  it('descreve a ausência de sinal deste lado, sem citar preço', () => {
    renderAba('contra', ['defesas_vazaveis']);

    const cabecalho = screen.getByText(/aquém do corte/i);
    expect(cabecalho).toHaveTextContent(/premissas de mais de 1,5 gols/i);
    expect(cabecalho).toHaveTextContent(/não são sinal para o outro lado/i);
    expect(cabecalho).not.toHaveTextContent(/preço/i);
  });

  it('sem nenhuma aquém do corte, afirma que todas as que valem acenderam', () => {
    renderAba('contra', []);

    expect(screen.getByText(/todas as que valem acenderam/i)).toBeInTheDocument();
  });

  it('o cabeçalho nunca afirma oposição', () => {
    // "pesando contra", "contra esta saída", "joga contra": qualquer uma delas
    // devolve o defeito. A busca é pela AFIRMAÇÃO, e por isso exclui o "aquém do
    // corte" que é a frase certa.
    for (const slugs of [['defesas_vazaveis'], []]) {
      const { unmount } = renderAba('contra', slugs);
      expect(screen.queryByText(/contra esta saída|pesando contra|joga contra/i)).toBeNull();
      unmount();
    }
  });
});

describe('a premissa presta contas do modelo na tela', () => {
  // ==========================================================================
  // O card mostra o CORTE, e a frase acima dele mostra o MESMO número (#353).
  // Antes: "2,4 gols sofridos por jogo" no card, "2,3" no subtítulo, e a
  // explicação dizendo "fica abaixo da linha de 3,25" — quando o corte é 2,95.
  // ==========================================================================
  const jogo = (over: Partial<FutebolFixtureHistorico> = {}): FutebolFixtureHistorico => ({
    side: 'home',
    team_id: 1,
    team_name: 'Casa',
    past_fixture_id: 1,
    data: '2026-08-01',
    ordem: 1,
    mesma_competicao: true,
    em_casa: true,
    adversario: 'Adversário',
    adversario_id: 9,
    gols_pro: 1,
    gols_contra: 1,
    total_gols: 2,
    ambos_marcaram: true,
    sem_sofrer: false,
    sem_marcar: false,
    xg: 1,
    xg_contra: 1,
    resultado: 'E',
    ...over,
  });

  /** Cada lado sofrendo `ga` por jogo no mando que a premissa mede. */
  const historico = (ga: number): FutebolFixtureHistorico[] => [
    ...[1, 2, 3].map((i) =>
      jogo({ side: 'home', team_id: 1, team_name: 'Casa', ordem: i, past_fixture_id: i, em_casa: true, gols_contra: ga }),
    ),
    ...[1, 2, 3].map((i) =>
      jogo({ side: 'away', team_id: 2, team_name: 'Fora', ordem: i, past_fixture_id: 10 + i, em_casa: false, gols_contra: ga }),
    ),
  ];

  const renderDefesasFirmes = (ga: number) =>
    render(
      <MotivosJogoPorJogo
        mercado="goals_over_under"
        premissas={premissas('goals_over_under', ['defesas_firmes'])}
        modo="favor"
        extras={[]}
        historico={historico(ga)}
        numeros={[]}
        lado="home"
        linha={3.25}
        saidaLabel="Menos de 3,25 gols"
      />,
    );

  it('o card anuncia o corte, e não a linha', () => {
    renderDefesasFirmes(1);

    expect(screen.getByText('Corte da premissa')).toBeInTheDocument();
    expect(screen.getByText('corte 2,95')).toBeInTheDocument();
    // A linha continua dita, mas como origem do corte — nunca como a régua.
    expect(screen.getByText(/O corte é a linha de 3,25 com uma margem de 0,3/)).toBeInTheDocument();
  });

  it('a frase da lista e o card mostram o mesmo número', () => {
    renderDefesasFirmes(1);

    // 1 + 1 = 2,0, uma vez na frase da lista e uma no card.
    expect(screen.getAllByText(/2,0/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/2,0 gols sofridos por jogo, somados · o corte é no máximo 2,95/)).toBeInTheDocument();
  });

  it('o valor abaixo da linha e acima do corte não acende, e a tela diz isso', () => {
    // 1,55 + 1,55 = 3,10: abaixo da linha de 3,25 e acima do corte de 2,95.
    // É a faixa em que a tela antiga afirmava o contrário do modelo.
    renderDefesasFirmes(1.55);

    expect(screen.getByText(/3,1 não atingiu o corte de 2,95/)).toBeInTheDocument();
    expect(screen.queryByText(/é por isso que esta premissa sustenta/)).toBeNull();
  });

  it('a base de jogos aparece', () => {
    renderDefesasFirmes(1);

    expect(screen.getByText(/Base: Casa, 3 jogos · Fora, 3 jogos/)).toBeInTheDocument();
  });
});

describe('preço não chega à aba como premissa do jogo', () => {
  it('o contrato antigo ainda manda movimento de linha, e ele é barrado antes', () => {
    // Durante a janela da virada, a RPC antiga lista linha_subindo entre as
    // premissas aplicáveis de Over. É premissasVisiveisDoContrato que a
    // descarta, antes de virar catálogo visual.
    const visiveis = separarMotivosDoContrato([
      { id: 'xg_combinado_alto', tipo: 'premissa' },
      { id: 'linha_subindo', tipo: 'premissa' },
      { id: 'ritmo_alto', tipo: 'premissa' },
    ]);

    expect(visiveis.slugsDePremissas).toEqual(['xg_combinado_alto', 'ritmo_alto']);
  });

  it('e o que sobra é o que a aba renderiza', () => {
    renderAba('favor', separarMotivosDoContrato([
      { id: 'linha_subindo', tipo: 'premissa' },
      { id: 'linha_descendo', tipo: 'premissa' },
    ]).slugsDePremissas);

    expect(screen.getByText('Nenhum motivo a favor desta saída.')).toBeInTheDocument();
  });
});

// ============================================================================
// A rolagem obedece ao toque, e só a ele (04/09)
// ============================================================================
// Abrir uma premissa leva o topo dela para baixo do cabeçalho — no celular o
// gráfico nascia embaixo do dedo e a pessoa ficava no meio do que abriu.
//
// O risco do conserto é maior que o defeito: a lista abre a primeira premissa
// SOZINHA sempre que o conjunto muda, e arrastar a régua muda o conjunto a cada
// parada. Se a rolagem seguisse a abertura em vez do toque, a tela pularia no
// meio do arrasto sem ninguém ter clicado.
//
// Só premissa com jogo a jogo abre, então o histórico aqui não é decoração: sem
// ele nenhuma linha é clicável e o teste passaria sem testar nada.
// ============================================================================

describe('rolagem ao abrir a premissa', () => {
  const umJogo = (over: Partial<FutebolFixtureHistorico>): FutebolFixtureHistorico => ({
    side: 'home', team_id: 1, team_name: 'Casa', past_fixture_id: 1, data: '2026-08-01', ordem: 1,
    mesma_competicao: true, em_casa: true, adversario: 'Adversário', adversario_id: 9,
    gols_pro: 1, gols_contra: 1, total_gols: 2, ambos_marcaram: true, sem_sofrer: false,
    sem_marcar: false, xg: 1, xg_contra: 1, resultado: 'E', ...over,
  });

  const comHistorico = [
    ...[1, 2, 3].map((i) => umJogo({ side: 'home', team_id: 1, ordem: i, past_fixture_id: i, em_casa: true })),
    ...[1, 2, 3].map((i) => umJogo({ side: 'away', team_id: 2, team_name: 'Fora', ordem: i, past_fixture_id: 10 + i, em_casa: false })),
  ];

  const renderDuas = () =>
    render(
      <MotivosJogoPorJogo
        mercado="goals_over_under"
        premissas={premissas('goals_over_under', ['defesas_firmes', 'defesas_vazaveis'])}
        modo="favor"
        extras={[]}
        historico={comHistorico}
        numeros={[]}
        lado="home"
        linha={3.25}
        saidaLabel="Menos de 3,25 gols"
      />,
    );

  it('não rola quando a lista abre a primeira sozinha', () => {
    // É o que acontece ao montar, e a cada parada da régua.
    renderDuas();

    expect(alinharAbaixoDoCabecalho).not.toHaveBeenCalled();
  });

  it('rola quando o toque abre uma premissa fechada', async () => {
    renderDuas();
    vi.mocked(alinharAbaixoDoCabecalho).mockClear();

    // Pelo PAPEL, e não pelo texto: o texto casa também com a div do card, que
    // fica FORA do botão — clicar nela não abre nada e o teste passaria a
    // afirmar o contrário do que quer.
    await userEvent.click(screen.getByRole('button', { name: /ver os jogos/i }));

    expect(alinharAbaixoDoCabecalho).toHaveBeenCalledTimes(1);
  });

  it('fechar não mexe na rolagem', async () => {
    renderDuas();
    vi.mocked(alinharAbaixoDoCabecalho).mockClear();

    await userEvent.click(screen.getByRole('button', { name: /fechar/i }));

    expect(alinharAbaixoDoCabecalho).not.toHaveBeenCalled();
  });
});
