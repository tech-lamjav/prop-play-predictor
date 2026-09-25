import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePerfilDeclarado } from './use-perfil-declarado';

// ============================================================================
// O pedaço entre o banco e a decisão de perguntar
// ============================================================================
// O módulo puro decide COM o estado; este hook é quem vai buscar o estado e
// quem grava a resposta. O que importa testar é o contrato — linha ausente
// significa nunca respondeu, adiar incrementa, responder carimba — e os dois
// casos de falha, que são os que não podem travar ninguém.
// ============================================================================

const banco = vi.hoisted(() => ({
  leitura: { data: null as unknown, error: null as unknown },
  escrita: { error: null as unknown },
  gravou: [] as unknown[],
}));

vi.mock('@/integrations/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => banco.leitura,
        }),
      }),
      upsert: async (linha: unknown) => {
        banco.gravou.push(linha);
        return banco.escrita;
      },
    }),
  }),
}));

beforeEach(() => {
  banco.leitura = { data: null, error: null };
  banco.escrita = { error: null };
  banco.gravou = [];
});

describe('quem nunca apareceu por aqui', () => {
  it('não respondeu — a ausência de linha é o estado inicial', async () => {
    const { result } = renderHook(() => usePerfilDeclarado('u1'));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.respondeu).toBe(false);
  });
});

describe('quem já respondeu', () => {
  it('não volta a ser perguntada', async () => {
    banco.leitura = {
      data: { respondido_em: '2026-09-20T10:00:00Z', adiamentos: 2 },
      error: null,
    };
    const { result } = renderHook(() => usePerfilDeclarado('u1'));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.respondeu).toBe(true);
  });
});

describe('quem só adiou', () => {
  it('continua sem ter respondido', async () => {
    banco.leitura = { data: { respondido_em: null, adiamentos: 3 }, error: null };
    const { result } = renderHook(() => usePerfilDeclarado('u1'));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.respondeu).toBe(false);
  });

  it('adiar de novo soma ao que já havia', async () => {
    banco.leitura = { data: { respondido_em: null, adiamentos: 3 }, error: null };
    const { result } = renderHook(() => usePerfilDeclarado('u1'));
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await act(async () => {
      await result.current.adiar();
    });

    expect(banco.gravou).toHaveLength(1);
    expect(banco.gravou[0]).toMatchObject({ user_id: 'u1', adiamentos: 4 });
  });

  it('o primeiro adiamento cria a linha contando um', async () => {
    const { result } = renderHook(() => usePerfilDeclarado('u1'));
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await act(async () => {
      await result.current.adiar();
    });

    expect(banco.gravou[0]).toMatchObject({ user_id: 'u1', adiamentos: 1 });
  });
});

describe('responder', () => {
  it('grava as duas escolhas com o carimbo', async () => {
    const { result } = renderHook(() => usePerfilDeclarado('u1'));
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await act(async () => {
      await result.current.responder({ objetivo: 'economizar_tempo', frequencia: 'toda_semana' });
    });

    const linha = banco.gravou[0] as Record<string, unknown>;
    expect(linha).toMatchObject({
      user_id: 'u1',
      objetivo: 'economizar_tempo',
      frequencia: 'toda_semana',
    });
    // Meia resposta não entra: o carimbo anda junto das duas escolhas.
    expect(typeof linha.respondido_em).toBe('string');
  });

  it('a pessoa para de ser perguntada na hora, sem esperar outra leitura', async () => {
    const { result } = renderHook(() => usePerfilDeclarado('u1'));
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await act(async () => {
      await result.current.responder({ objetivo: 'oportunidades_prontas', frequencia: 'comecando' });
    });

    expect(result.current.respondeu).toBe(true);
  });
});

describe('quando o banco falha', () => {
  // Quem respondeu e teve a gravação recusada não pode ficar presa no pop-up.
  // Ela segue em frente, e como "já respondeu" mora no banco, a falha se
  // conserta sozinha: na próxima sessão a pergunta volta.
  it('gravação recusada não trava quem respondeu', async () => {
    banco.escrita = { error: { message: 'sem conexão' } };
    const { result } = renderHook(() => usePerfilDeclarado('u1'));
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await act(async () => {
      await result.current.responder({ objetivo: 'entender_o_porque', frequencia: 'quase_todo_dia' });
    });

    expect(result.current.respondeu).toBe(true);
  });

  it('adiar com o banco fora não lança', async () => {
    banco.escrita = { error: { message: 'sem conexão' } };
    const { result } = renderHook(() => usePerfilDeclarado('u1'));
    await waitFor(() => expect(result.current.carregando).toBe(false));

    await expect(
      act(async () => {
        await result.current.adiar();
      }),
    ).resolves.not.toThrow();
  });

  // Leitura que falha cala a pesquisa em vez de insistir. Perguntar de novo a
  // quem já respondeu é pior do que deixar de perguntar a quem não respondeu:
  // o primeiro é atrito em cima de quem já colaborou, o segundo volta sozinho
  // na sessão seguinte.
  it('leitura que falha não faz a pesquisa aparecer', async () => {
    banco.leitura = { data: null, error: { message: 'timeout' } };
    const { result } = renderHook(() => usePerfilDeclarado('u1'));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.leituraFalhou).toBe(true);
  });

  // O hook não tem o direito de afirmar que alguém respondeu quando o que
  // houve foi um timeout. Quem chama cala a pesquisa nos dois casos, mas os
  // dois não são a mesma coisa e não podem virar o mesmo booleano.
  it('e não mente dizendo que a pessoa respondeu', async () => {
    banco.leitura = { data: null, error: { message: 'timeout' } };
    const { result } = renderHook(() => usePerfilDeclarado('u1'));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.respondeu).toBe(false);
  });
});

describe('sem ninguém logado', () => {
  it('não consulta o banco e não há o que perguntar', async () => {
    const { result } = renderHook(() => usePerfilDeclarado(undefined));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.respondeu).toBe(false);
    expect(banco.gravou).toHaveLength(0);
  });
});
