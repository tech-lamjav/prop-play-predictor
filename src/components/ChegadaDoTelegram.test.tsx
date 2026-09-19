import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { limparAtribuicao } from '@/lib/analytics';

// ============================================================================
// A chegada pelo Telegram — a perna que faltava no funil do bot
// ============================================================================
// O envio e o clique já eram medidos. A CHEGADA não, e a diferença entre
// clicar e chegar não é detalhe: o redirecionador `go` responde um 302 e conta
// o clique ANTES de o navegador pedir a página. Todo abandono no meio do
// caminho — rede caindo, webview do Telegram fechando, redirect perdido —
// estava sendo contado como visita ao site.
//
// O caso difícil é o login. Quem chega deslogado numa rota protegida passa por
// /auth, sai para o Google e volta em /auth/callback: três rotas, uma chegada
// só. Sem a marca persistida, cada uma contaria de novo.
// ============================================================================

const { capturas, authMock } = vi.hoisted(() => ({
  capturas: [] as { nome: string; props: Record<string, unknown> }[],
  authMock: { user: null as { id: string } | null, isLoading: false },
}));

vi.mock('@/hooks/use-auth', () => ({ useAuth: () => authMock }));
vi.mock('@/lib/analytics', async (importOriginal) => {
  // O módulo REAL, menos a captura: a atribuição (sessionStorage, validade,
  // marca de disparo) é justamente o que este teste precisa exercitar de
  // verdade. Dublar tudo testaria o dublê.
  const real = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...real,
    chegadaDoTelegram: (props: Record<string, unknown>) => {
      capturas.push({ nome: 'telegram_opportunity_landing_opened', props });
    },
  };
});

import { ChegadaDoTelegram } from './ChegadaDoTelegram';

const LINK =
  '/futebol/jogo/123?delivery_id=d1&batch_id=b1&link_id=l1&campaign_id=published_opportunities' +
  '&campaign_type=published_opportunities&opportunity_id=123%7Cmatch_winner%7CHome%7C' +
  '&segment=A&sent_at=2026-09-19T10%3A00%3A00Z&utm_source=telegram&utm_medium=bot';

function montar(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <ChegadaDoTelegram />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  capturas.length = 0;
  limparAtribuicao();
  authMock.user = null;
  authMock.isLoading = false;
});

describe('ChegadaDoTelegram', () => {
  it('reporta a chegada com a corrente inteira', () => {
    montar(LINK);

    expect(capturas).toHaveLength(1);
    const p = capturas[0].props;
    expect(p.delivery_id).toBe('d1');
    expect(p.batch_id).toBe('b1');
    expect(p.link_id).toBe('l1');
    expect(p.campaign_type).toBe('published_opportunities');
    expect(p.opportunity_id).toBe('123|match_winner|Home|');
    expect(p.landing_path).toBe('/futebol/jogo/123');
    expect(p.segment).toBe('A');
  });

  it('mede o tempo entre o envio e a chegada', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-19T10:05:00Z'));
    montar(LINK);
    vi.useRealTimers();

    expect(capturas[0].props.time_since_sent_ms).toBe(5 * 60 * 1000);
  });

  it('link sem atribuição não reporta nada', () => {
    // Uma visita direta ao mesmo endereço não é chegada do Telegram, e
    // carimbá-la assim creditaria ao bot uma visita que ele não causou.
    montar('/futebol/jogo/123');
    expect(capturas).toHaveLength(0);
  });

  it('a mesma entrega não reporta duas vezes', () => {
    montar(LINK);
    montar(LINK);
    expect(capturas).toHaveLength(1);
  });

  it('sobrevive ao redirect do login', () => {
    // Chega deslogado com a atribuição na URL…
    montar(LINK);
    expect(capturas).toHaveLength(1);

    // …e volta do Google em /auth/callback, SEM query nenhuma. A chegada já
    // foi contada, então não conta de novo — mas também não se perde.
    montar('/auth/callback');
    expect(capturas).toHaveLength(1);
  });

  it('diz se a pessoa estava autenticada', () => {
    authMock.user = { id: 'uuid-do-auth' };
    montar(LINK);
    expect(capturas[0].props.is_authenticated).toBe(true);
  });

  it('anônimo é reportado como anônimo', () => {
    montar(LINK);
    expect(capturas[0].props.is_authenticated).toBe(false);
  });

  it('não reporta enquanto a sessão não resolveu', () => {
    // Com a sessão em voo, `user` é nulo por DESCONHECIMENTO, não por ausência.
    // Reportar ali sairia dizendo "anônimo" para gente logada — um campo que
    // mente sempre é pior que um evento que chega meio segundo depois.
    authMock.isLoading = true;
    montar(LINK);
    expect(capturas).toHaveLength(0);
  });
});
