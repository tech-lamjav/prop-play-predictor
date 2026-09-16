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
    // Com o dia dentro: o sócio ordena as ligações sem abrir ficha nenhuma.
    expect(screen.getByText('Em teste até 16/09, faltam 5 dias')).toBeInTheDocument();
  });

  it('a véspera aparece como vencendo, e diz que é amanhã', () => {
    montar([
      cadastroDeTeste({ id: 'x', name: 'Testando', futebol_trial_ends_at: fimDoTesteEm(HOJE, 1) }),
    ]);
    expect(screen.getByText('Vence amanhã, 12/09')).toBeInTheDocument();
  });

  it('quem venceu diz há quantos dias', () => {
    // Ontem e maio pedem conversas diferentes: uma é retomada, a outra é
    // recomeço. "Teste vencido" sozinho não separava as duas.
    montar([
      cadastroDeTeste({ id: 'x', name: 'Testando', futebol_trial_ends_at: fimDoTesteEm(HOJE, -3) }),
    ]);
    expect(screen.getByText('Venceu 08/09, faz 3 dias')).toBeInTheDocument();
  });

  it('quem nunca testou não ganha etiqueta', () => {
    montar([cadastroDeTeste({ id: 'y', name: 'Seco' })]);
    expect(screen.queryByText(/Em teste|Vence|Venceu/)).not.toBeInTheDocument();
  });
});
