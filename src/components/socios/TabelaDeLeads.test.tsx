import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TabelaDeLeads } from './TabelaDeLeads';
import { montarLeads } from './crm-painel';
import { cadastroDeTeste, fimDoTesteEm } from './crm-cadastro-de-teste';

const HOJE = '2026-09-11';

const montar = (cadastros: Parameters<typeof montarLeads>[0]) =>
  render(
    <MemoryRouter>
      <TabelaDeLeads leads={montarLeads(cadastros, {}, {}, {}, HOJE)} vazio="Ninguém." />
    </MemoryRouter>,
  );

describe('TabelaDeLeads · a etiqueta de teste', () => {
  it('aparece ao lado do nome, e fora do link', () => {
    // A etiqueta é da pessoa, e não só um filtro no topo. Fora do link porque
    // dentro ela entraria no nome acessível, e quem navega por leitor de tela
    // ouviria "Em teste" colado ao nome em toda linha.
    montar([
      cadastroDeTeste({ id: 'x', name: 'Testando', futebol_trial_ends_at: fimDoTesteEm(HOJE, 5) }),
    ]);
    expect(screen.getByRole('link', { name: 'Testando' })).toBeInTheDocument();
    expect(screen.getByText('Em teste')).toBeInTheDocument();
  });

  it('a véspera aparece como vencendo', () => {
    montar([
      cadastroDeTeste({ id: 'x', name: 'Testando', futebol_trial_ends_at: fimDoTesteEm(HOJE, 1) }),
    ]);
    expect(screen.getByText('Teste vencendo')).toBeInTheDocument();
  });

  it('quem nunca testou não ganha etiqueta', () => {
    montar([cadastroDeTeste({ id: 'y', name: 'Seco' })]);
    expect(screen.queryByText(/Em teste|Teste vencendo|Teste vencido/)).not.toBeInTheDocument();
  });
});
