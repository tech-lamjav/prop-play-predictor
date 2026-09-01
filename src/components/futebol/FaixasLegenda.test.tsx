import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { opcoesDeFaixa } from '@/utils/futebol-score';
import { FaixasLegenda } from './FaixasLegenda';

describe('FaixasLegenda', () => {
  it('mostra os cortes legacy enquanto o board vem na escala antiga', () => {
    render(<FaixasLegenda opcoes={opcoesDeFaixa('legacy')} />);

    expect(screen.getByText('60+', { exact: true })).toHaveClass('bg-forest');
    expect(screen.getByText('40+', { exact: true })).toHaveClass('bg-amber/15');
    expect(screen.getByText('<40', { exact: true })).toHaveClass('bg-canvas-2');
  });

  it('acompanha a virada sozinha quando o board declara a escala nova', () => {
    render(<FaixasLegenda opcoes={opcoesDeFaixa('contexto_v1')} />);

    expect(screen.getByText('55+', { exact: true })).toHaveClass('bg-forest');
    expect(screen.getByText('25+', { exact: true })).toHaveClass('bg-amber/15');
    expect(screen.getByText('<25', { exact: true })).toHaveClass('bg-canvas-2');
  });

  it('omite o selo na janela indefinida, em vez de cravar um corte errado', () => {
    render(<FaixasLegenda opcoes={opcoesDeFaixa('indefinida')} />);

    expect(screen.queryByText('60+', { exact: true })).toBeNull();
    expect(screen.queryByText('55+', { exact: true })).toBeNull();
    expect(screen.getByText(/^Alta,/)).toBeInTheDocument();
    expect(screen.getByText(/^Média,/)).toBeInTheDocument();
    expect(screen.getByText(/^Baixa,/)).toBeInTheDocument();
  });
});
