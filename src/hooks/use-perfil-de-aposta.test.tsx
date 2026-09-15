import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePerfilDeAposta } from './use-perfil-de-aposta';

// ============================================================================
// A fiação do perfil de aposta
// ============================================================================
// ⚠️ Passa por função do banco e não por consulta porque a tabela `bets`
// continua FECHADA para o sócio, e isso é decisão da migration 124. A função é
// `security definer` e devolve só agregado.
//
// O que este arquivo guarda é o pedaço entre o banco e a tela, onde moram os
// erros calados: tratar "nunca apostou" como perfil de zeros, e devolver vazio
// enquanto a consulta ainda está no ar — que faria o sócio abrir a conversa
// errada com quem aposta todo dia.
// ============================================================================

const resposta = vi.hoisted(() => ({
  rpc: { data: null as unknown, error: null as unknown },
  chamada: null as { nome: string; args: Record<string, unknown> } | null,
}));

vi.mock('@/integrations/supabase/client', () => ({
  createClient: () => ({
    rpc: async (nome: string, args: Record<string, unknown>) => {
      resposta.chamada = { nome, args };
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
  return { wrapper };
}

const perfilDoBanco = (over: Record<string, unknown> = {}) => ({
  total: 10,
  liquidadas: 8,
  primeira: '2026-01-10T12:00:00Z',
  ultima: '2026-09-01T12:00:00Z',
  apostado: '800.00',
  lucro: '-64.00',
  por_esporte: [{ nome: 'Futebol', n: 9, apostado: '700', lucro: '-60' }],
  por_mercado: [],
  por_faixa_de_odd: [],
  ...over,
});

beforeEach(() => {
  resposta.rpc = { data: [perfilDoBanco()], error: null };
  resposta.chamada = null;
});

describe('usePerfilDeAposta', () => {
  it('chama a função do banco com o identificador da pessoa', async () => {
    const { wrapper } = ambiente();
    renderHook(() => usePerfilDeAposta('u1'), { wrapper });
    await waitFor(() => expect(resposta.chamada).not.toBeNull());
    expect(resposta.chamada!.nome).toBe('crm_perfil_de_aposta');
    expect(resposta.chamada!.args).toEqual({ p_user_id: 'u1' });
  });

  it('monta o perfil, com os números virando números', async () => {
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePerfilDeAposta('u1'), { wrapper });
    await waitFor(() => expect(result.current.tipo).toBe('pronto'));
    if (result.current.tipo !== 'pronto') throw new Error('não ficou pronto');
    expect(result.current.perfil.apostado).toBe(800);
    expect(result.current.perfil.roi).toBeCloseTo(-8);
  });

  it('quem nunca apostou é vazio, e não um perfil de zeros', async () => {
    // ⚠️ São coisas diferentes, e a tela fala diferente com as duas. Um perfil
    // de zeros desenharia tabelas em branco e números "0" como se fossem
    // resultado; vazio diz "nunca registrou aposta", que é o caso da maior
    // parte da base.
    resposta.rpc = {
      data: [perfilDoBanco({ total: 0, liquidadas: 0, apostado: '0', lucro: '0' })],
      error: null,
    };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePerfilDeAposta('u1'), { wrapper });
    await waitFor(() => expect(result.current.tipo).toBe('vazio'));
  });

  it('lista vazia do banco também é vazio', async () => {
    resposta.rpc = { data: [], error: null };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePerfilDeAposta('u1'), { wrapper });
    await waitFor(() => expect(result.current.tipo).toBe('vazio'));
  });

  it('começa carregando, e não vazio', async () => {
    // Dizer "nunca apostou" enquanto a consulta está no ar faz o sócio abrir a
    // conversa errada com quem aposta todo dia.
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePerfilDeAposta('u1'), { wrapper });
    expect(result.current.tipo).toBe('carregando');
    await waitFor(() => expect(result.current.tipo).toBe('pronto'));
  });

  it('sem pessoa, não consulta nada', () => {
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePerfilDeAposta(undefined), { wrapper });
    expect(result.current.tipo).toBe('carregando');
    expect(resposta.chamada).toBeNull();
  });

  it('erro é erro, e não "nunca apostou"', async () => {
    // O portão da função recusa quem não é sócio. Cair para vazio aqui diria
    // que a pessoa não aposta quando o que houve foi uma porta fechada.
    resposta.rpc = { data: null, error: { message: 'apenas socios' } };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePerfilDeAposta('u1'), { wrapper });
    await waitFor(() => expect(result.current.tipo).toBe('erro'));
  });
});
