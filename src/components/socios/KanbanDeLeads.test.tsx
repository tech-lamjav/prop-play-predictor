import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { KanbanDeLeads } from './KanbanDeLeads';
import { montarLeads, type Lead } from './crm-painel';
import { cadastroDeTeste } from './crm-cadastro-de-teste';

// ============================================================================
// O kanban mostra a FORMA do funil
// ============================================================================
// Ele vive ao lado da tabela, e não no lugar dela. A tabela é para trabalhar a
// fila — quem está esperando, em que ordem. O kanban é para ver onde a base
// empilha.
//
// O protótipo (branch prototype/painel-do-crm) mostrou o custo dele: com a
// proporção real da base, mais de 80% cai em "Novo" e as outras colunas ficam
// quase vazias. Foi escolhido sabendo disso.
// ============================================================================

const HOJE = '2026-09-11';

function leads(quantos: number, etapas: Record<string, string> = {}): Lead[] {
  const cadastros = Array.from({ length: quantos }, (_, i) =>
    cadastroDeTeste({ id: String(i), name: `Pessoa ${i}` }),
  );
  return montarLeads(cadastros, etapas, {}, {}, HOJE);
}

const montar = (lista: Lead[]) =>
  render(
    <MemoryRouter>
      <KanbanDeLeads leads={lista} />
    </MemoryRouter>,
  );

describe('KanbanDeLeads', () => {
  it('desenha as oito colunas, inclusive as vazias', () => {
    // Coluna que some esconde onde está o gargalo.
    montar(leads(1));
    expect(screen.getAllByRole('region')).toHaveLength(8);
    expect(within(screen.getByRole('region', { name: 'Boletada' })).getByText('vazia')).toBeInTheDocument();
  });

  it('cada coluna diz quantos tem, mesmo os que não desenha', () => {
    montar(leads(40));
    const novo = screen.getByRole('region', { name: 'Novo' });
    expect(within(novo).getByText('40')).toBeInTheDocument();
  });

  it('coluna cheia demais diz quantos sobraram e manda para a tabela', () => {
    // O teto não é performance, é honestidade: rolar por centenas de cartões
    // não é trabalho que alguém faça, e fingir que a coluna é navegável seria
    // pior que admitir o limite.
    montar(leads(40));
    const novo = screen.getByRole('region', { name: 'Novo' });
    expect(within(novo).getByText(/\+ 15 que não cabem aqui/)).toBeInTheDocument();
    expect(within(novo).getByText(/use a tabela/i)).toBeInTheDocument();
  });

  it('coluna que cabe não fala de sobra', () => {
    montar(leads(3));
    expect(screen.queryByText(/não cabem aqui/)).not.toBeInTheDocument();
  });

  it('marca as duas colunas que o banco responde', () => {
    // O formato promete arrastar, e para essas duas não dá.
    montar(leads(1));
    expect(screen.getAllByText(/o banco responde/i)).toHaveLength(2);
  });

  it('cada cartão leva para a ficha da pessoa', () => {
    montar(leads(1));
    expect(screen.getByRole('link', { name: /Pessoa 0/ })).toHaveAttribute('href', '/socios/0');
  });

  it('põe cada lead na coluna da sua posição', () => {
    montar(leads(2, { '1': 'boletada' }));
    expect(within(screen.getByRole('region', { name: 'Boletada' })).getByText('Pessoa 1')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Novo' })).getByText('Pessoa 0')).toBeInTheDocument();
  });
});
