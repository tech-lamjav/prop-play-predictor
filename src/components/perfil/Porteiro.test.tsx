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

// A porta joga fora a sessão guardada no navegador quando barra alguém (#552).
// Não é a trava — a trava é o servidor derrubando a sessão —, então aqui basta
// que a chamada exista e não exploda.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } },
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
    montar({ resposta: { origem: 'fora', veredito: 'entrou' } });
    expect(screen.getByText('o produto')).toBeInTheDocument();
  });

  it('vê o produto mesmo quando a origem não deu para saber', () => {
    // Fail-open: o defeito nosso não tranca ninguém.
    montar({ resposta: { origem: 'nao_sei', veredito: 'entrou' } });
    expect(screen.getByText('o produto')).toBeInTheDocument();
  });
});

describe('quem foi barrado', () => {
  it('não vê o produto', () => {
    montar({ resposta: { origem: 'brasil', veredito: 'barrado' } });
    expect(screen.queryByText('o produto')).not.toBeInTheDocument();
  });

  it('recebe uma explicação e um caminho de contato', () => {
    montar({ resposta: { origem: 'brasil', veredito: 'barrado' } });
    expect(screen.getByRole('heading')).toBeInTheDocument();
    // O contato é a saída de emergência de quem foi classificado no país
    // errado. Sem ele, essa pessoa não tem para onde ir.
    expect(screen.getByRole('link', { name: /whatsapp/i })).toBeInTheDocument();
  });

  it('ainda consegue chegar aos documentos', () => {
    montar({ resposta: { origem: 'brasil', veredito: 'barrado' } });
    expect(screen.getByRole('link', { name: /termos/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacidade/i })).toBeInTheDocument();
  });
});

describe('enquanto ninguém sabe', () => {
  it('mostra o produto, e não o bloqueio', () => {
    // Com a chave do bloqueio desligada ninguém nunca é barrado. Se esta tela
    // segurasse o produto até o porteiro responder, ela cobraria uma ida à
    // rede de cada pessoa do mundo para comprar nada — inclusive na página
    // pública, e inclusive de quem está no Peru.
    montar({ resposta: null });
    expect(screen.getByText('o produto')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});

describe('as rotas que sobrevivem ao bloqueio', () => {
  it('mostram o conteúdo para quem foi barrado', () => {
    montar({ resposta: { origem: 'brasil', veredito: 'barrado' } }, '/termos');
    expect(screen.getByText('o produto')).toBeInTheDocument();
  });

  it('abrem mesmo sem resposta do porteiro', () => {
    montar({ resposta: null }, '/privacidade');
    expect(screen.getByText('o produto')).toBeInTheDocument();
  });
});
