import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEtapas, useMudarEtapa } from './use-etapas';

// ============================================================================
// A fiação do funil
// ============================================================================
// Os componentes têm testes próprios, com a etapa já na mão. Este arquivo cobre
// o pedaço entre o banco e eles, que é onde estavam os buracos: sem estes
// testes, tirar a invalidação, tirar o `throw` da mutação, ou devolver mapa
// vazio sempre — as três coisas passavam com a suíte inteira verde.
// ============================================================================

const resposta = vi.hoisted(() => ({
  linhas: { data: null as unknown, error: null as unknown },
  rpc: { data: null as unknown, error: null as unknown },
  chamadaDoRpc: null as unknown,
}));

vi.mock('@/integrations/supabase/client', () => ({
  createClient: () => ({
    from: () => ({ select: async () => resposta.linhas }),
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
  resposta.linhas = { data: [], error: null };
  resposta.rpc = { data: 'contatado', error: null };
  resposta.chamadaDoRpc = null;
});

describe('useEtapas', () => {
  it('vira um mapa do identificador para a etapa', async () => {
    resposta.linhas = {
      data: [
        { user_id: 'a', etapa: 'proposta' },
        { user_id: 'b', etapa: 'assinou' },
      ],
      error: null,
    };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useEtapas(), { wrapper });
    await waitFor(() => expect(result.current.tipo).toBe('pronto'));
    if (result.current.tipo !== 'pronto') throw new Error('não ficou pronto');
    expect(result.current.etapas).toEqual({ a: 'proposta', b: 'assinou' });
  });

  it('começa carregando, e não com a base inteira em branco', async () => {
    // Mapa vazio no lugar de "ainda não sei" pinta o crachá "Novo" em todo
    // mundo, que é uma afirmação e não um vazio.
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useEtapas(), { wrapper });
    expect(result.current.tipo).toBe('carregando');
    await waitFor(() => expect(result.current.tipo).toBe('pronto'));
  });

  it('falhar é erro, e não base sem etapa nenhuma', async () => {
    // Erro virando mapa vazio faria o filtro de "novo" — a lista de quem ainda
    // falta abordar — devolver todo mundo que já foi abordado.
    resposta.linhas = { data: null, error: { message: 'caiu' } };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useEtapas(), { wrapper });
    await waitFor(() => expect(result.current.tipo).toBe('erro'));
  });
});

describe('useMudarEtapa', () => {
  it('chama a função do banco com o lead e a etapa', async () => {
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useMudarEtapa('u1'), { wrapper });
    result.current.mutate('contatado');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(resposta.chamadaDoRpc).toEqual({
      nome: 'crm_mudar_etapa',
      args: { p_user_id: 'u1', p_etapa: 'contatado' },
    });
  });

  it('erro do banco vira erro da mutação, e não sucesso silencioso', async () => {
    // Sem o `throw`, a mutação "dá certo" com nada gravado: a ficha invalida a
    // consulta, o seletor volta para a etapa antiga, e o rodapé continua
    // prometendo que a mudança ficou registrada.
    resposta.rpc = { data: null, error: { message: 'apenas socios' } };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useMudarEtapa('u1'), { wrapper });
    result.current.mutate('contatado');
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('gravar recarrega as etapas, para a lista e a ficha concordarem', async () => {
    // As duas telas leem a mesma chave. Sem a invalidação, a ficha mostra a
    // etapa nova e a lista continua na antiga até alguém recarregar a página.
    const { cliente, wrapper } = ambiente();
    const invalidar = vi.spyOn(cliente, 'invalidateQueries');
    const { result } = renderHook(() => useMudarEtapa('u1'), { wrapper });
    result.current.mutate('contatado');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['socios', 'etapas'] });
  });

  it('falhando, não recarrega nada', async () => {
    resposta.rpc = { data: null, error: { message: 'caiu' } };
    const { cliente, wrapper } = ambiente();
    const invalidar = vi.spyOn(cliente, 'invalidateQueries');
    const { result } = renderHook(() => useMudarEtapa('u1'), { wrapper });
    result.current.mutate('contatado');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidar).not.toHaveBeenCalled();
  });
});
