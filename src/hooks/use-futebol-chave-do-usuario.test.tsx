import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ============================================================================
// Quem pergunta entra na chave de cache
// ============================================================================
// As RPCs guardadas por `futebol_acesso_do_chamador` devolvem a linha com as
// colunas NULAS para quem não tem acesso. O React Query não sabe disso: para
// ele a resposta é função da chave, e só.
//
// Sem o usuário na chave, a cópia buscada enquanto a pessoa estava deslogada
// seguia servindo depois do cadastro. Foi o que aconteceu em homologação em
// 19/09/2026: o chip do cabeçalho dizia "Teste · 48h" — porque
// `get_futebol_access` JÁ era keyed por usuário e refazia — com a lista inteira
// cadeada logo abaixo, porque o board não era. Duas respostas do mesmo banco
// discordando na mesma tela, até o cache vencer em cinco minutos.
//
// O teste não olha o conteúdo: olha se a pergunta é REFEITA quando quem
// pergunta muda. É isso que estava faltando.
// ============================================================================

let usuario: { id: string } | null = null;
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: usuario, isLoading: false }) }));

const getValueBoard = vi.fn(async () => []);
const getFixtureValue = vi.fn(async () => ({ linhas: [], cortadas: [] }));
const getOddsBoard = vi.fn(async () => []);
vi.mock('@/services/futebol-data.service', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return {
    ...real,
    futebolDataService: {
      getValueBoard: () => getValueBoard(),
      getFixtureValue: () => getFixtureValue(),
      getOddsBoard: () => getOddsBoard(),
    },
  };
});

const { useFutebolValueBoard, useFutebolOddsBoard, useFutebolFixtureValue } = await import(
  './use-futebol-data'
);

function envolver() {
  // `retry: false` e cache próprio por teste: o que se mede aqui é a chave, não
  // a política de repetição.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  usuario = null;
  getValueBoard.mockClear();
  getOddsBoard.mockClear();
  getFixtureValue.mockClear();
});

describe('as consultas que o banco fecha por acesso', () => {
  it('o board refaz a pergunta quando alguém entra na conta', async () => {
    const wrapper = envolver();
    const { rerender } = renderHook(() => useFutebolValueBoard(), { wrapper });
    await waitFor(() => expect(getValueBoard).toHaveBeenCalledTimes(1));

    // O cadastro acontece: a MESMA tela, outro usuário.
    usuario = { id: 'usuario-novo' };
    rerender();
    await waitFor(() => expect(getValueBoard).toHaveBeenCalledTimes(2));
  });

  it('o quadro de odds também', async () => {
    const wrapper = envolver();
    const { rerender } = renderHook(() => useFutebolOddsBoard(), { wrapper });
    await waitFor(() => expect(getOddsBoard).toHaveBeenCalledTimes(1));
    usuario = { id: 'usuario-novo' };
    rerender();
    await waitFor(() => expect(getOddsBoard).toHaveBeenCalledTimes(2));
  });

  it('e o valor do jogo, que é a tela de detalhe', async () => {
    const wrapper = envolver();
    const { rerender } = renderHook(() => useFutebolFixtureValue(123), { wrapper });
    await waitFor(() => expect(getFixtureValue).toHaveBeenCalledTimes(1));
    usuario = { id: 'usuario-novo' };
    rerender();
    await waitFor(() => expect(getFixtureValue).toHaveBeenCalledTimes(2));
  });

  // O contrário também importa: sem troca de usuário, não há pergunta repetida.
  // Um teste que só exigisse "refaz" passaria com a chave estragada de outro
  // jeito — por exemplo, se alguém zerasse o cache a cada render.
  it('sem ninguém entrar, a pergunta não se repete', async () => {
    const wrapper = envolver();
    const { rerender } = renderHook(() => useFutebolValueBoard(), { wrapper });
    await waitFor(() => expect(getValueBoard).toHaveBeenCalledTimes(1));
    rerender();
    rerender();
    expect(getValueBoard).toHaveBeenCalledTimes(1);
  });
});
