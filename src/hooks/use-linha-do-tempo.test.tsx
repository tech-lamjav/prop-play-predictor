import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAnotar, useLinhaDoTempo } from './use-linha-do-tempo';

// ============================================================================
// A fiação da linha do tempo
// ============================================================================
// O componente tem testes próprios, com a lista já na mão. Aqui é o pedaço
// entre o banco e ele: duas consultas juntadas numa lista, e a escrita que
// precisa recarregar a lista da PESSOA CERTA — invalidar a chave sem o
// identificador recarregaria a ficha errada e deixaria esta parada.
// ============================================================================

const resposta = vi.hoisted(() => ({
  anotacoes: { data: [] as unknown, error: null as unknown },
  eventos: { data: [] as unknown, error: null as unknown },
  rpc: { data: null as unknown, error: null as unknown },
  chamadaDoRpc: null as unknown,
}));

vi.mock('@/integrations/supabase/client', () => ({
  createClient: () => ({
    from: (tabela: string) => ({
      select: () => ({
        eq: async () => (tabela === 'crm_anotacao' ? resposta.anotacoes : resposta.eventos),
      }),
    }),
    rpc: async (nome: string, args: unknown) => {
      resposta.chamadaDoRpc = { nome, args };
      return resposta.rpc;
    },
  }),
}));

function ambiente() {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
  return { cliente, wrapper };
}

beforeEach(() => {
  resposta.anotacoes = { data: [], error: null };
  resposta.eventos = { data: [], error: null };
  resposta.rpc = { data: 'id-novo', error: null };
  resposta.chamadaDoRpc = null;
});

describe('useLinhaDoTempo', () => {
  it('junta as duas consultas numa lista só, do mais recente para o mais antigo', async () => {
    resposta.anotacoes = {
      data: [
        {
          id: 'a1',
          tipo: 'anotacao',
          texto: 'ligou',
          criada_em: '2026-09-10T12:00:00Z',
          criada_por: 's1',
        },
      ],
      error: null,
    };
    resposta.eventos = {
      data: [{ id: 'e1', de: 'novo', para: 'contatado', em: '2026-09-11T12:00:00Z', por: 's1' }],
      error: null,
    };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useLinhaDoTempo('u1'), { wrapper });
    await waitFor(() => expect(result.current.tipo).toBe('pronta'));
    if (result.current.tipo !== 'pronta') throw new Error('não ficou pronta');
    expect(result.current.itens.map((i) => i.id)).toEqual(['e1', 'a1']);
  });

  it('começa em nulo, e não em lista vazia', () => {
    // Lista vazia diz ao sócio que ninguém falou com essa pessoa, e ele age em
    // cima disso.
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useLinhaDoTempo('u1'), { wrapper });
    expect(result.current.tipo).toBe('carregando');
  });

  it('qualquer uma das duas consultas falhando vira erro', async () => {
    resposta.eventos = { data: null, error: { message: 'caiu' } };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useLinhaDoTempo('u1'), { wrapper });
    await waitFor(() => expect(result.current.tipo).toBe('erro'));
  });

  it('endereço sem identificador não vira linha do tempo vazia', () => {
    // "Nada registrado ainda" é uma afirmação sobre a pessoa. Sem saber de quem
    // é a ficha, não há afirmação a fazer.
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useLinhaDoTempo(undefined), { wrapper });
    expect(result.current.tipo).toBe('carregando');
  });
});

describe('useAnotar', () => {
  it('manda tipo e texto para a função do banco', async () => {
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useAnotar('u1'), { wrapper });
    result.current.mutate({ tipo: 'feedback', texto: 'achou confuso' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(resposta.chamadaDoRpc).toEqual({
      nome: 'crm_anotar',
      args: { p_user_id: 'u1', p_tipo: 'feedback', p_texto: 'achou confuso' },
    });
  });

  it('erro do banco vira erro da mutação', async () => {
    resposta.rpc = { data: null, error: { message: 'anotacao vazia' } };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useAnotar('u1'), { wrapper });
    result.current.mutate({ tipo: 'anotacao', texto: ' ' });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('recarrega a linha do tempo DESTA pessoa', async () => {
    // Sem o identificador na chave, a escrita recarregaria a ficha errada e
    // deixaria esta parada mostrando a lista velha.
    const { cliente, wrapper } = ambiente();
    const invalidar = vi.spyOn(cliente, 'invalidateQueries');
    const { result } = renderHook(() => useAnotar('u1'), { wrapper });
    result.current.mutate({ tipo: 'anotacao', texto: 'ok' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['socios', 'linha-do-tempo', 'u1'] });
  });
});
