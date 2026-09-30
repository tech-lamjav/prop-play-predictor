import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Porteiro } from './Porteiro';
import type { EstadoDoPorteiro } from '@/hooks/use-porteiro';

// ============================================================================
// O que é regra, e não desenho
// ============================================================================
// Texto, cor e espaçamento da tela de bloqueio mudam sem aviso e não entram
// aqui. O que entra é o que foi decidido e pode regredir calado: quem vê o
// produto, quem vê o bloqueio, e o que aparece enquanto ninguém sabe.
//
// O erro mais provável desta tela não é errar o país — é decidir ANTES de ter
// resposta, e aí a tela de bloqueio pisca em cima de todo mundo a cada
// carregamento, inclusive de quem está no Peru.
// ============================================================================

const estado = vi.hoisted(() => ({ atual: null as EstadoDoPorteiro | null }));

vi.mock('@/hooks/use-porteiro', () => ({
  usePorteiro: () => estado.atual,
}));

function montar(novo: EstadoDoPorteiro, rota = '/futebol') {
  estado.atual = novo;
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Porteiro>
        <p>o produto</p>
      </Porteiro>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  estado.atual = null;
});

describe('quem entrou', () => {
  it('vê o produto', () => {
    montar({ carregando: false, resposta: { origem: 'fora', veredito: 'entrou' } });
    expect(screen.getByText('o produto')).toBeInTheDocument();
  });

  it('vê o produto mesmo quando a origem não deu para saber', () => {
    // Fail-open: o defeito nosso não tranca ninguém.
    montar({ carregando: false, resposta: { origem: 'nao_sei', veredito: 'entrou' } });
    expect(screen.getByText('o produto')).toBeInTheDocument();
  });
});

describe('quem foi barrado', () => {
  it('não vê o produto', () => {
    montar({ carregando: false, resposta: { origem: 'brasil', veredito: 'barrado' } });
    expect(screen.queryByText('o produto')).not.toBeInTheDocument();
  });

  it('recebe uma explicação e um caminho de contato', () => {
    montar({ carregando: false, resposta: { origem: 'brasil', veredito: 'barrado' } });
    expect(screen.getByRole('heading')).toBeInTheDocument();
    // O contato é a saída de emergência de quem foi classificado no país
    // errado. Sem ele, essa pessoa não tem para onde ir.
    expect(screen.getByRole('link', { name: /whatsapp/i })).toBeInTheDocument();
  });

  it('ainda consegue chegar aos documentos', () => {
    montar({ carregando: false, resposta: { origem: 'brasil', veredito: 'barrado' } });
    expect(screen.getByRole('link', { name: /termos/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacidade/i })).toBeInTheDocument();
  });
});

describe('enquanto ninguém sabe', () => {
  it('espera, e não mostra o bloqueio', () => {
    montar({ carregando: true, resposta: null });
    expect(screen.queryByText('o produto')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('espera também quando a resposta ainda não chegou sem estar carregando', () => {
    montar({ carregando: false, resposta: null });
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
  });
});

describe('as rotas que sobrevivem ao bloqueio', () => {
  it('mostram o conteúdo para quem foi barrado', () => {
    montar({ carregando: false, resposta: { origem: 'brasil', veredito: 'barrado' } }, '/termos');
    expect(screen.getByText('o produto')).toBeInTheDocument();
  });

  it('não esperam o porteiro responder', () => {
    montar({ carregando: true, resposta: null }, '/privacidade');
    expect(screen.getByText('o produto')).toBeInTheDocument();
  });
});
