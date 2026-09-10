import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNomeDoSocio } from './use-nome-do-socio';

const resposta = vi.hoisted(() => ({ dados: { data: null as unknown, error: null as unknown } }));

vi.mock('@/integrations/supabase/client', () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ eq: async () => resposta.dados }) }),
  }),
}));

function ambiente() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    ),
  };
}

beforeEach(() => {
  resposta.dados = {
    data: [
      { id: 's1', name: 'Diogo', email: 'diogo@exemplo.com' },
      { id: 's2', name: null, email: 'mateus@exemplo.com' },
    ],
    error: null,
  };
});

describe('useNomeDoSocio', () => {
  it('traduz o identificador no nome', async () => {
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useNomeDoSocio(), { wrapper });
    await waitFor(() => expect(result.current('s1')).toBe('Diogo'));
  });

  it('sem nome cadastrado, cai no e-mail', async () => {
    // Melhor um e-mail que um identificador de trinta e seis caracteres.
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useNomeDoSocio(), { wrapper });
    await waitFor(() => expect(result.current('s2')).toBe('mateus@exemplo.com'));
  });

  it('enquanto carrega, não afirma que o autor não é sócio', () => {
    // "outro sócio" antes da resposta chegar mente inclusive para quem acabou
    // de escrever e está olhando a própria anotação.
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useNomeDoSocio(), { wrapper });
    expect(result.current('s1')).toBe('…');
  });

  it('autor fora da lista não some do registro', async () => {
    // Pode ser alguém que perdeu o acesso. Esconder a anotação seria pior.
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useNomeDoSocio(), { wrapper });
    await waitFor(() => expect(result.current('s1')).toBe('Diogo'));
    expect(result.current('desconhecido')).toBe('outro sócio');
  });

  it('registro sem autor é dito, e não fingido', async () => {
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useNomeDoSocio(), { wrapper });
    await waitFor(() => expect(result.current('s1')).toBe('Diogo'));
    expect(result.current(null)).toBe('sem autor');
  });

  it('falhando a consulta, ninguém vira "outro sócio" por engano', async () => {
    resposta.dados = { data: null, error: { message: 'caiu' } };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useNomeDoSocio(), { wrapper });
    await waitFor(() => expect(result.current('s1')).toBe('…'));
  });
});
