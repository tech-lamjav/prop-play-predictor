import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// A captura não pode derrubar a tela, nem vazar dado pessoal
// ============================================================================
// Duas garantias, e as duas vêm de defeitos concretos deste repositório:
//
//  1. O PostHog pode estar DESLIGADO. O `main.tsx` só chama `posthog.init` se
//     `VITE_PUBLIC_POSTHOG_KEY` existir — e neste checkout ela não existe em
//     nenhum dos arquivos de ambiente. Mas o `usePostHog()` devolve o client
//     mesmo assim, truthy, então o `if (posthog)` espalhado pelas telas não
//     protege coisa nenhuma. Quem protege é `analyticsLigado()`.
//
//  2. Telemetria que lança derruba o que a pessoa veio fazer. Um evento perdido
//     custa uma linha num painel; uma exceção não tratada num handler de clique
//     custa a navegação.
// ============================================================================

const { posthogMock, configMock } = vi.hoisted(() => ({
  posthogMock: { capture: vi.fn(), identify: vi.fn(), reset: vi.fn() },
  configMock: { posthog: { key: 'fake-key' as string | undefined, host: 'https://h' } },
}));

vi.mock('posthog-js', () => ({ default: posthogMock }));
vi.mock('@/config/environment', () => ({ config: configMock }));

import {
  analyticsLigado,
  capturar,
  chegadaDoTelegram,
  ctaClicado,
  esquecerPessoa,
  identificar,
  jogoClicado,
  oportunidadeExibida,
} from './captura';
import { EVENTOS, chavesPessoaisEm, propsDaOportunidade } from './eventos';

beforeEach(() => {
  vi.clearAllMocks();
  configMock.posthog.key = 'fake-key';
});

describe('com o PostHog de pé', () => {
  it('captura com o nome e as propriedades', () => {
    jogoClicado({
      game_id: 123,
      source: 'home_featured',
      is_featured: true,
      destination_path: '/futebol/jogo/123',
    });

    expect(posthogMock.capture).toHaveBeenCalledTimes(1);
    const [nome, props] = posthogMock.capture.mock.calls[0];
    expect(nome).toBe('futebol_game_clicked');
    expect(props.game_id).toBe(123);
    expect(props.source).toBe('home_featured');
  });

  it('um clique é UM evento', () => {
    ctaClicado({
      ...propsDaOportunidade(
        { fixture_id: 1, market: 'match_winner', outcome: 'Home', line_value: null },
        { source: 'opportunities', subscription_status: 'subscribed' },
      ),
      action: 'register_bet',
    });

    expect(posthogMock.capture).toHaveBeenCalledTimes(1);
  });

  it('tira `undefined`, mas preserva nulo', () => {
    // Nulo e ausente dizem coisas diferentes: "medi e não havia" não é "não
    // medi". Um vira zero no painel; o outro some da conta.
    capturar(EVENTOS.oportunidadeExibida, { a: undefined, b: null, c: 0 });

    const [, props] = posthogMock.capture.mock.calls[0];
    expect(props).not.toHaveProperty('a');
    expect(props.b).toBeNull();
    expect(props.c).toBe(0);
  });

  it('identifica com o id da aplicação', () => {
    identificar('uuid-do-auth');
    expect(posthogMock.identify).toHaveBeenCalledWith('uuid-do-auth', {});
  });

  it('esquece a pessoa no logout', () => {
    esquecerPessoa();
    expect(posthogMock.reset).toHaveBeenCalledTimes(1);
  });
});

describe('com o PostHog desligado', () => {
  beforeEach(() => {
    configMock.posthog.key = undefined;
  });

  it('`analyticsLigado` diz que não', () => {
    expect(analyticsLigado()).toBe(false);
  });

  it('não captura nada', () => {
    jogoClicado({
      game_id: 1,
      source: 'direct',
      is_featured: false,
      destination_path: '/futebol/jogo/1',
    });
    expect(posthogMock.capture).not.toHaveBeenCalled();
  });

  it('não identifica nem reseta', () => {
    identificar('uuid');
    esquecerPessoa();
    expect(posthogMock.identify).not.toHaveBeenCalled();
    expect(posthogMock.reset).not.toHaveBeenCalled();
  });

  it('e nada disso lança', () => {
    expect(() => {
      jogoClicado({ game_id: 1, source: 'direct', is_featured: false, destination_path: '/' });
      identificar('uuid');
      esquecerPessoa();
    }).not.toThrow();
  });
});

describe('quando o SDK falha', () => {
  it('a exceção não escapa para o handler de clique', () => {
    posthogMock.capture.mockImplementationOnce(() => {
      throw new Error('rede caiu');
    });

    expect(() =>
      jogoClicado({ game_id: 1, source: 'direct', is_featured: false, destination_path: '/' }),
    ).not.toThrow();
  });

  it('um `identify` que falha também não derruba o login', () => {
    posthogMock.identify.mockImplementationOnce(() => {
      throw new Error('rede caiu');
    });
    expect(() => identificar('uuid')).not.toThrow();
  });
});

describe('nada de dado pessoal nos eventos novos', () => {
  it('a impressão de uma oportunidade não carrega PII', () => {
    oportunidadeExibida(
      propsDaOportunidade(
        {
          fixture_id: 123,
          market: 'match_winner',
          outcome: 'Home',
          line_value: null,
          competition: 'brasileirao',
          faixa: 'Alta',
          score: 72,
        },
        { source: 'opportunities', subscription_status: 'subscribed', position: 0 },
      ),
    );

    const [, props] = posthogMock.capture.mock.calls[0];
    expect(chavesPessoaisEm(props)).toEqual([]);
  });

  it('a chegada do Telegram não carrega chat_id nem telefone', () => {
    // O vínculo Telegram↔pessoa já existe no banco (`users.telegram_chat_id`).
    // Repeti-lo no evento refaria em texto o que o contrato de identidade
    // resolveu com o UUID.
    chegadaDoTelegram({
      delivery_id: 'd1',
      batch_id: 'b1',
      link_id: 'l1',
      campaign_id: 'c1',
      campaign_type: 'published_opportunities',
      opportunity_id: '123|match_winner|Home|',
      landing_path: '/futebol/jogo/123',
      segment: 'A',
      time_since_sent_ms: 60000,
      is_authenticated: true,
    });

    const [nome, props] = posthogMock.capture.mock.calls[0];
    expect(nome).toBe('telegram_opportunity_landing_opened');
    expect(chavesPessoaisEm(props)).toEqual([]);
  });
});
