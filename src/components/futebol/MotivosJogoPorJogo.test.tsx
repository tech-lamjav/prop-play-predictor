import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MotivosJogoPorJogo } from './MotivosJogoPorJogo';
import { premissaDe } from '@/utils/futebol-premissas';
import { separarMotivosDoContrato } from '@/utils/futebol-motivos';

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

describe('aba Contra', () => {
  it('descreve o que o jogo não sustenta, sem citar preço', () => {
    renderAba('contra', ['defesas_vazaveis']);

    const cabecalho = screen.getByText(/colocam contra|deixa de sustentar/i);
    expect(cabecalho).toHaveTextContent('O que o jogo deixa de sustentar nesta saída.');
    expect(cabecalho).not.toHaveTextContent(/preço/i);
  });

  it('sem nada contra, afirma que as premissas que valem aconteceram', () => {
    renderAba('contra', []);

    expect(
      screen.getByText('Nada pesando contra esta saída: todas as premissas que valem aconteceram.'),
    ).toBeInTheDocument();
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
