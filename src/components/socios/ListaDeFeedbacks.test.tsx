import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListaDeFeedbacks } from './ListaDeFeedbacks';
import { montarFeedbacks } from './crm-linha-do-tempo';

// ============================================================================
// A leitura transversal do que a base falou
// ============================================================================
// O feedback continua morando na linha do tempo de quem falou, porque é lá que
// ele tem contexto. Esta tela existe para a outra pergunta: "o que estão
// achando do produto", que não se responde abrindo trinta fichas.
// ============================================================================

const ANOTACOES = [
  {
    id: 'f1',
    user_id: 'u1',
    tipo: 'feedback',
    texto: 'achou o Betinho confuso no começo',
    criada_em: '2026-09-10T12:00:00Z',
    criada_por: 's1',
  },
  {
    id: 'n1',
    user_id: 'u1',
    tipo: 'anotacao',
    texto: 'ligou hoje',
    criada_em: '2026-09-11T12:00:00Z',
    criada_por: 's1',
  },
  {
    id: 'f2',
    user_id: 'u2',
    tipo: 'feedback',
    texto: 'queria ver o histórico de acertos antes de assinar',
    criada_em: '2026-09-08T12:00:00Z',
    criada_por: 's2',
  },
];

const NOMES = { u1: 'Maria Silva', u2: 'João Souza' };

const montar = (estado: Parameters<typeof ListaDeFeedbacks>[0]['estado']) =>
  render(
    <MemoryRouter>
      <ListaDeFeedbacks estado={estado} nomeDoSocio={(id) => (id === 's1' ? 'Diogo' : 'Mateus')} />
    </MemoryRouter>,
  );

const pronto = (nomes: Record<string, string> = NOMES) => ({
  tipo: 'pronto' as const,
  feedbacks: montarFeedbacks(ANOTACOES, nomes),
});

describe('ListaDeFeedbacks', () => {
  it('mostra só o que é feedback', () => {
    // Anotação e objeção continuam na ficha. Misturá-las aqui faria a tela
    // responder outra pergunta.
    montar(pronto());
    expect(screen.getByText(/achou o Betinho confuso/)).toBeInTheDocument();
    expect(screen.queryByText(/ligou hoje/)).not.toBeInTheDocument();
  });

  it('do mais recente para o mais antigo', () => {
    montar(pronto());
    const textos = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(textos[0]).toMatch(/Betinho confuso/);
    expect(textos[1]).toMatch(/histórico de acertos/);
  });

  it('diz quem registrou e quando', () => {
    montar(pronto());
    expect(screen.getByText(/10\/09\/2026 · registrado por Diogo/)).toBeInTheDocument();
  });

  it('o nome leva de volta para a ficha da pessoa', () => {
    // Feedback sem a conversa em volta costuma ser mal interpretado, e o
    // caminho de volta precisa ser um clique.
    montar(pronto());
    expect(screen.getByRole('link', { name: 'Maria Silva' })).toHaveAttribute('href', '/socios/u1');
  });

  it('feedback de gente que não está na base some, em vez de virar identificador cru', () => {
    // Um feedback sem dono é um feedback que ninguém consegue responder.
    montar(pronto({ u1: 'Maria Silva' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('sem feedback nenhum, explica de onde eles vêm', () => {
    // Lista vazia sem explicação parece defeito; a frase diz o caminho.
    montar({ tipo: 'pronto', feedbacks: [] });
    expect(screen.getByText(/marca uma anotação como feedback/i)).toBeInTheDocument();
  });

  it('carregando não é o mesmo que vazio', () => {
    montar({ tipo: 'carregando' });
    expect(screen.getByText(/carregando os feedbacks/i)).toBeInTheDocument();
    expect(screen.queryByText(/nenhum feedback/i)).not.toBeInTheDocument();
  });

  it('falhar não vira lista vazia', () => {
    montar({ tipo: 'erro' });
    expect(screen.getByText(/não deu para carregar/i)).toBeInTheDocument();
    expect(screen.queryByText(/nenhum feedback/i)).not.toBeInTheDocument();
  });
});
