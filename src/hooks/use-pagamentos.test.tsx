import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useEstornarPagamento,
  usePagamentos,
  usePagamentosDasAssinaturas,
  useRegistrarPagamento,
} from './use-pagamentos';

// ============================================================================
// A fiação do dinheiro
// ============================================================================
// O componente tem teste próprio, com os pagamentos já na mão. Este arquivo
// cobre o pedaço entre o banco e ele, que é onde moram os erros silenciosos:
// mandar o mês sem o dia, esquecer de invalidar a assinatura depois de empurrar
// o vencimento, ou consultar os pagamentos de todo mundo em vez dos de uma
// assinatura. Os três passavam com a suíte inteira verde.
// ============================================================================

const resposta = vi.hoisted(() => ({
  linhas: { data: null as unknown, error: null as unknown },
  rpc: { data: null as unknown, error: null as unknown },
  chamadaDoRpc: null as { nome: string; args: Record<string, unknown> } | null,
  filtros: [] as { metodo: string; campo?: string; valor?: unknown }[],
}));

vi.mock('@/integrations/supabase/client', () => ({
  createClient: () => {
    const consulta = {
      /*
       * ⚠️ As colunas pedidas são GUARDADAS, e não jogadas fora.
       *
       * O dublê ignorava o argumento, e isso abriu um buraco no dia em que a
       * consulta passou a precisar de `user_id` para agrupar o dinheiro do
       * gateway por pessoa: tirar a coluna do select deixaria o mapa vazio em
       * silêncio, com a suíte inteira verde, e a virada para o cartão
       * simplesmente pararia de existir.
       */
      select: (colunas: string) => {
        resposta.filtros.push({ metodo: 'select', campo: colunas });
        return consulta;
      },
      eq: (campo: string, valor: unknown) => {
        resposta.filtros.push({ metodo: 'eq', campo, valor });
        return consulta;
      },
      order: (campo: string) => {
        resposta.filtros.push({ metodo: 'order', campo });
        return Promise.resolve(resposta.linhas);
      },
    };
    return {
      from: (tabela: string) => {
        resposta.filtros.push({ metodo: 'from', campo: tabela });
        return consulta;
      },
      rpc: async (nome: string, args: Record<string, unknown>) => {
        resposta.chamadaDoRpc = { nome, args };
        return resposta.rpc;
      },
    };
  },
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

const linhaDoBanco = {
  id: 'p1',
  competencia: '2026-09-01',
  valor: '39.90',
  origem: 'pix',
  pago_em: '2026-09-03',
  estornado_em: null,
  motivo_do_estorno: null,
};

beforeEach(() => {
  resposta.linhas = { data: [], error: null };
  resposta.rpc = { data: 'p1', error: null };
  resposta.chamadaDoRpc = null;
  resposta.filtros = [];
});

describe('usePagamentos', () => {
  it('pede só os pagamentos daquela PESSOA', () => {
    // Sem o filtro, a tela somaria a receita da base inteira num cliente só. O
    // número apareceria enorme e ninguém desconfiaria na hora.
    //
    // ⚠️ Por pessoa, e não por assinatura. Mudou com a #457: o dinheiro do
    // gateway não tem assinatura manual, e enquanto a consulta fosse por
    // assinatura ele ficava gravado no banco e invisível na tela.
    const { wrapper } = ambiente();
    renderHook(() => usePagamentos('u1'), { wrapper });
    expect(resposta.filtros).toContainEqual({ metodo: 'eq', campo: 'user_id', valor: 'u1' });
    expect(resposta.filtros.some((f) => f.campo === 'assinatura_id')).toBe(false);
  });

  it('monta os pagamentos, com o valor virando número', async () => {
    resposta.linhas = { data: [linhaDoBanco], error: null };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePagamentos('a1'), { wrapper });
    await waitFor(() => expect(result.current.tipo).toBe('pronto'));
    if (result.current.tipo !== 'pronto') throw new Error('não ficou pronto');
    expect(result.current.pagamentos[0].valor).toBe(39.9);
    expect(result.current.pagamentos[0].mes).toBe('2026-09');
  });

  it('começa carregando, e não com a lista vazia', async () => {
    // ⚠️ Lista vazia quer dizer "nunca pagou", e o sócio cobra em cima disso.
    // Enquanto a consulta está no ar, a resposta certa é "ainda não sei".
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePagamentos('a1'), { wrapper });
    expect(result.current.tipo).toBe('carregando');
    await waitFor(() => expect(result.current.tipo).toBe('pronto'));
  });

  it('sem pessoa, não consulta nada e já vem pronto', () => {
    // Não há o que esperar: sem pessoa a resposta é vazia de verdade, e não
    // vazia por enquanto.
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePagamentos(undefined), { wrapper });
    expect(result.current.tipo).toBe('pronto');
    expect(resposta.filtros).toEqual([]);
  });

  it('erro é erro, e não lista vazia', async () => {
    resposta.linhas = { data: null, error: { message: 'caiu' } };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePagamentos('a1'), { wrapper });
    await waitFor(() => expect(result.current.tipo).toBe('erro'));
  });
});

describe('useRegistrarPagamento', () => {
  it('manda o mês como o dia 1º, que é o que o banco exige', async () => {
    // ⚠️ A restrição da tabela recusa qualquer outro dia. A tela pensa em mês e
    // manda `2026-09`; sem o `-01` a gravação morre no banco e o sócio vê um
    // erro de restrição sem entender o que fez.
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useRegistrarPagamento('a1', 'u1'), { wrapper });
    result.current.mutate({ mes: '2026-09', valor: 39.9, origem: 'pix', pagoEm: '2026-09-03' });
    await waitFor(() => expect(resposta.chamadaDoRpc).not.toBeNull());
    expect(resposta.chamadaDoRpc!.nome).toBe('crm_registrar_pagamento');
    expect(resposta.chamadaDoRpc!.args).toEqual({
      p_assinatura_id: 'a1',
      p_competencia: '2026-09-01',
      p_valor: 39.9,
      p_origem: 'pix',
      p_pago_em: '2026-09-03',
    });
  });

  it('erro do banco vira erro da mutação', async () => {
    // Sem o `throw`, a tela diria que gravou e a lista não mudaria: o sócio
    // marcaria a pessoa como paga sem o pagamento existir.
    resposta.rpc = { data: null, error: { message: 'apenas socios' } };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useRegistrarPagamento('a1', 'u1'), { wrapper });
    result.current.mutate({ mes: '2026-09', valor: 39.9, origem: 'pix', pagoEm: '2026-09-03' });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('invalida a assinatura junto, porque o vencimento andou', async () => {
    // ⚠️ Registrar empurra o `vence_em`. Sem esta invalidação a ficha mostraria
    // a data velha ao lado do pagamento novo, e as duas se contradizem na tela.
    const { cliente, wrapper } = ambiente();
    const espiao = vi.spyOn(cliente, 'invalidateQueries');
    const { result } = renderHook(() => useRegistrarPagamento('a1', 'u1'), { wrapper });
    result.current.mutate({ mes: '2026-09', valor: 39.9, origem: 'pix', pagoEm: '2026-09-03' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const chaves = espiao.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    /*
     * ⚠️ A chave da PESSOA, e este é o guarda mais importante deste arquivo.
     *
     * A condição da invalidação era `if (assinaturaId)`. Com a chave passando a
     * ser por pessoa na #457, deixar assim faria lançar um Pix parar de
     * atualizar a lista na frente do sócio: dado velho, sem erro nenhum. O
     * Victor confirmou que hoje ela atualiza na hora, então quebrar isso seria
     * regressão de comportamento que ele usa todo dia.
     */
    expect(chaves).toContain(JSON.stringify(['socios', 'pagamentos', 'u1']));
    expect(chaves).toContain(JSON.stringify(['socios', 'assinaturas-manuais']));
    expect(chaves).toContain(JSON.stringify(['socios', 'linha-do-tempo', 'u1']));
    // A fila de inadimplentes lê todos os pagamentos de uma vez. Sem invalidar
    // a chave dela, quem acabou de pagar continuaria na fila de devedores.
    expect(chaves).toContain(JSON.stringify(['socios', 'pagamentos', 'todas']));
  });
});

describe('useEstornarPagamento', () => {
  it('manda o identificador e o motivo', async () => {
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useEstornarPagamento('a1', 'u1'), { wrapper });
    result.current.mutate({ id: 'p1', motivo: 'lancei no mês errado' });
    await waitFor(() => expect(resposta.chamadaDoRpc).not.toBeNull());
    expect(resposta.chamadaDoRpc!.nome).toBe('crm_estornar_pagamento');
    expect(resposta.chamadaDoRpc!.args).toEqual({
      p_id: 'p1',
      p_motivo: 'lancei no mês errado',
    });
  });

  it('erro do banco vira erro da mutação', async () => {
    resposta.rpc = { data: null, error: { message: 'estorno sem motivo' } };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => useEstornarPagamento('a1', 'u1'), { wrapper });
    result.current.mutate({ id: 'p1', motivo: '  ' });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('usePagamentosDasAssinaturas', () => {
  it('agrupa os pagamentos por assinatura, com o valor virando número', async () => {
    resposta.linhas = {
      data: [
        { ...linhaDoBanco, id: 'p1', assinatura_id: 'a1' },
        { ...linhaDoBanco, id: 'p2', assinatura_id: 'a1', competencia: '2026-08-01' },
        { ...linhaDoBanco, id: 'p3', assinatura_id: 'a2' },
      ],
      error: null,
    };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePagamentosDasAssinaturas(), { wrapper });
    await waitFor(() => expect(result.current.tipo).toBe('pronto'));
    if (result.current.tipo !== 'pronto') throw new Error('não ficou pronto');
    expect(result.current.porAssinatura.get('a1')).toHaveLength(2);
    expect(result.current.porAssinatura.get('a2')?.[0].valor).toBe(39.9);
  });

  it('⚠️ pagamento SEM assinatura fica FORA do mapa por assinatura', async () => {
    // O dinheiro do gateway não tem assinatura manual desde a migration 151, e
    // o tipo local dizia que tinha. O mapa por assinatura alimenta a conta de
    // mês em aberto, que é derivada do NOSSO registro e vale apenas para a
    // origem manual. Sem esta separação, o dinheiro do Stripe quitaria mês de
    // acordo feito na mão.
    resposta.linhas = {
      data: [
        { ...linhaDoBanco, id: 'p1', assinatura_id: 'a1', user_id: 'u1' },
        { ...linhaDoBanco, id: 'p2', assinatura_id: null, user_id: 'u1', origem: 'stripe' },
      ],
      error: null,
    };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePagamentosDasAssinaturas(), { wrapper });
    await waitFor(() => expect(result.current.tipo).toBe('pronto'));
    if (result.current.tipo !== 'pronto') throw new Error('não ficou pronto');
    expect(result.current.porAssinatura.get('a1')).toHaveLength(1);
    expect([...result.current.porAssinatura.keys()]).toEqual(['a1']);
  });

  it('⚠️ mas ele NÃO é descartado: vai para o mapa da pessoa', async () => {
    // Era descartado, e o descarte é o que impedia a **virada para o cartão**
    // de existir: sem saber desde quando o gateway cobra aquela pessoa, o
    // acordo manual antigo dela seguia acumulando mês em aberto para sempre.
    resposta.linhas = {
      data: [
        { ...linhaDoBanco, id: 'p1', assinatura_id: 'a1', user_id: 'u1' },
        {
          ...linhaDoBanco,
          id: 'p2',
          assinatura_id: null,
          user_id: 'u1',
          origem: 'stripe',
          competencia: '2026-08-01',
        },
      ],
      error: null,
    };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePagamentosDasAssinaturas(), { wrapper });
    await waitFor(() => expect(result.current.tipo).toBe('pronto'));
    if (result.current.tipo !== 'pronto') throw new Error('não ficou pronto');
    expect(result.current.doGatewayPorPessoa.get('u1')).toHaveLength(1);
    expect(result.current.doGatewayPorPessoa.get('u1')?.[0].mes).toBe('2026-08');
  });

  it('⚠️ e a linha com assinatura NÃO vaza para o mapa da pessoa', async () => {
    // Os dois mapas respondem perguntas diferentes. Se o dinheiro da mão
    // entrasse no mapa do gateway, o primeiro Pix da pessoa viraria a virada
    // para o cartão dela — e a cobrança do acordo se desligaria sozinha no mês
    // em que começou a funcionar.
    resposta.linhas = {
      data: [{ ...linhaDoBanco, id: 'p1', assinatura_id: 'a1', user_id: 'u1', origem: 'pix' }],
      error: null,
    };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePagamentosDasAssinaturas(), { wrapper });
    await waitFor(() => expect(result.current.tipo).toBe('pronto'));
    if (result.current.tipo !== 'pronto') throw new Error('não ficou pronto');
    expect([...result.current.doGatewayPorPessoa.keys()]).toEqual([]);
  });

  it('linha sem assinatura E sem pessoa é pulada, e não agrupada sob chave indefinida', async () => {
    // Não deveria existir — a 151 fez a pessoa virar o pai do pagamento —, mas
    // agrupar sob uma chave indefinida foi exatamente o defeito de antes.
    resposta.linhas = {
      data: [{ ...linhaDoBanco, id: 'p2', assinatura_id: null, user_id: null, origem: 'stripe' }],
      error: null,
    };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePagamentosDasAssinaturas(), { wrapper });
    await waitFor(() => expect(result.current.tipo).toBe('pronto'));
    if (result.current.tipo !== 'pronto') throw new Error('não ficou pronto');
    expect([...result.current.doGatewayPorPessoa.keys()]).toEqual([]);
    expect([...result.current.porAssinatura.keys()]).toEqual([]);
  });

  it('⚠️ pede a coluna da PESSOA ao banco', async () => {
    // O guarda mais barato e o mais fácil de perder: sem `user_id` no select, o
    // agrupamento por pessoa recebe indefinido em toda linha, o mapa do gateway
    // nasce vazio, e a virada para o cartão some da tela sem nenhum erro.
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePagamentosDasAssinaturas(), { wrapper });
    await waitFor(() => expect(result.current.tipo).toBe('pronto'));
    const select = resposta.filtros.find((f) => f.metodo === 'select');
    expect(select?.campo).toContain('user_id');
    expect(select?.campo).toContain('assinatura_id');
  });

  it('lê a tabela inteira, sem filtrar por assinatura', async () => {
    // A fila de inadimplentes precisa de todo mundo de uma vez.
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePagamentosDasAssinaturas(), { wrapper });
    await waitFor(() => expect(result.current.tipo).toBe('pronto'));
    expect(resposta.filtros).toContainEqual({ metodo: 'from', campo: 'crm_pagamento' });
    expect(resposta.filtros.some((f) => f.metodo === 'eq')).toBe(false);
  });

  it('começa carregando, e erro é erro', async () => {
    // "Ninguém devendo" por falta de dado faria o sócio deixar de cobrar.
    resposta.linhas = { data: null, error: { message: 'caiu' } };
    const { wrapper } = ambiente();
    const { result } = renderHook(() => usePagamentosDasAssinaturas(), { wrapper });
    expect(result.current.tipo).toBe('carregando');
    await waitFor(() => expect(result.current.tipo).toBe('erro'));
  });
});
