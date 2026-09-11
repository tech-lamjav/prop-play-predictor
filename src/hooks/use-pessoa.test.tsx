import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePessoa } from './use-pessoa';

// ============================================================================
// O caminho que o sócio percorre de verdade
// ============================================================================
// A tela da ficha tem testes próprios, mas eles montam o componente com o
// estado já pronto. Este arquivo cobre o pedaço entre o banco e aquele estado —
// e ele tinha dois buracos que passaram por todos os testes de tela: o erro da
// consulta de apostas virava zero, e endereço sem identificador virava "não deu
// para carregar agora", que é mentira sobre o que aconteceu.
// ============================================================================

const resposta = vi.hoisted(() => ({
  linha: { data: null as unknown, error: null as unknown },
  apostas: { data: null as unknown, error: null as unknown },
}));

vi.mock('@/integrations/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => resposta.linha,
        }),
      }),
    }),
    rpc: async () => resposta.apostas,
  }),
}));

const PESSOA = {
  id: 'u1',
  name: 'Maria',
  email: 'maria@exemplo.com',
  whatsapp_number: null,
  created_at: '2026-09-01T12:00:00Z',
  betinho_subscription_status: 'free',
  futebol_subscription_status: 'free',
  analytics_subscription_status: 'free',
  telegram_username: null,
  telegram_synced: false,
  subscription_product_type: null,
  betinho_subscription_period_end: null,
  analytics_subscription_period_end: null,
  has_report_access: null,
  futebol_trial_started_at: null,
  futebol_publication_alerts_ack_at: null,
};

function montar(id: string | undefined) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => usePessoa(id), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    ),
  });
}

beforeEach(() => {
  resposta.linha = { data: PESSOA, error: null };
  resposta.apostas = { data: [{ total: 3, ultima: '2026-09-09T12:00:00Z' }], error: null };
});

describe('usePessoa', () => {
  it('traz a pessoa e o resumo de apostas', async () => {
    const { result } = montar('u1');
    await waitFor(() => expect(result.current.tipo).toBe('pronta'));
    if (result.current.tipo !== 'pronta') throw new Error('não ficou pronta');
    expect(result.current.pessoa.email).toBe('maria@exemplo.com');
    expect(result.current.apostas).toEqual({ total: 3, ultima: '2026-09-09T12:00:00Z' });
  });

  it('pessoa inexistente vira "não encontrada", e não ficha vazia', async () => {
    resposta.linha = { data: null, error: { code: 'PGRST116' } };
    const { result } = montar('some-id');
    await waitFor(() => expect(result.current.tipo).toBe('nao-encontrada'));
  });

  it('erro de leitura vira erro, e não "não encontrada"', async () => {
    // Os dois desfechos pedem coisas diferentes do sócio: um é "esse cadastro
    // não existe", o outro é "tenta de novo". Trocar um pelo outro manda ele
    // procurar a pessoa errada.
    resposta.linha = { data: null, error: { code: '500', message: 'caiu' } };
    const { result } = montar('u1');
    await waitFor(() => expect(result.current.tipo).toBe('erro'));
  });

  it('apostas falhando NÃO viram zero: o nulo chega à tela', async () => {
    // Era o buraco: a função do banco levanta exceção para quem não é sócio, e
    // engolir isso fazia o palpite dizer "não deu sinal nenhum" com a cara de
    // quem tinha conferido.
    resposta.apostas = { data: null, error: { message: 'apenas socios' } };
    const { result } = montar('u1');
    await waitFor(() => expect(result.current.tipo).toBe('pronta'));
    if (result.current.tipo !== 'pronta') throw new Error('não ficou pronta');
    expect(result.current.apostas).toBeNull();
  });

  it('resumo vazio é zero de verdade, e não desconhecido', async () => {
    resposta.apostas = { data: [], error: null };
    const { result } = montar('u1');
    await waitFor(() => expect(result.current.tipo).toBe('pronta'));
    if (result.current.tipo !== 'pronta') throw new Error('não ficou pronta');
    expect(result.current.apostas).toEqual({ total: 0, ultima: null });
  });

  it('endereço sem identificador não é falha de carregamento', async () => {
    const { result } = montar(undefined);
    expect(result.current.tipo).toBe('nao-encontrada');
  });
});
