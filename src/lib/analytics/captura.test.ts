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
  posthogMock: {
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    setPersonProperties: vi.fn(),
  },
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
  guardarNaPessoa,
  perfilDeclaradoDaPessoa,
  pesquisaDePerfilAdiada,
  pesquisaDePerfilExibida,
  pesquisaDePerfilRespondida,
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

// ============================================================================
// A pesquisa de perfil (#524)
// ============================================================================
// Os três eventos e o traço da pessoa. O que importa aqui é que o que chega ao
// PostHog seja o CÓDIGO e não a frase da tela, que o traço da pessoa não
// derrube ninguém quando o SDK falhar, e que nada disso carregue dado pessoal.
// ============================================================================

describe('a pesquisa de perfil', () => {
  it('a exibição diz qual das duas aberturas a pessoa viu', () => {
    pesquisaDePerfilExibida({ audience: 'chegada' });

    const [nome, props] = posthogMock.capture.mock.calls[0];
    expect(nome).toBe('profile_survey_shown');
    expect(props).toEqual({ audience: 'chegada' });
  });

  it('a resposta carrega os códigos, e não o texto da tela', () => {
    pesquisaDePerfilRespondida({
      goal: 'economizar_tempo',
      betting_frequency: 'toda_semana',
      audience: 'base',
      deferrals: 2,
    });

    const [nome, props] = posthogMock.capture.mock.calls[0];
    expect(nome).toBe('profile_survey_answered');
    expect(props).toEqual({
      goal: 'economizar_tempo',
      betting_frequency: 'toda_semana',
      audience: 'base',
      deferrals: 2,
    });
  });

  it('o adiamento relata a contagem', () => {
    pesquisaDePerfilAdiada({ audience: 'chegada', deferrals: 1 });

    const [nome, props] = posthogMock.capture.mock.calls[0];
    expect(nome).toBe('profile_survey_deferred');
    expect(props).toEqual({ audience: 'chegada', deferrals: 1 });
  });

  it('nenhum dos três carrega dado pessoal', () => {
    pesquisaDePerfilExibida({ audience: 'chegada' });
    pesquisaDePerfilRespondida({
      goal: 'aprender_a_analisar',
      betting_frequency: 'comecando',
      audience: 'chegada',
      deferrals: 0,
    });
    pesquisaDePerfilAdiada({ audience: 'chegada', deferrals: 3 });

    for (const [, props] of posthogMock.capture.mock.calls) {
      expect(chavesPessoaisEm(props)).toEqual([]);
    }
  });

  it('a resposta vira traço da pessoa, com prefixo próprio', () => {
    perfilDeclaradoDaPessoa({ goal: 'entender_o_porque', betting_frequency: 'quase_todo_dia' });

    expect(posthogMock.setPersonProperties).toHaveBeenCalledWith({
      profile_goal: 'entender_o_porque',
      profile_betting_frequency: 'quase_todo_dia',
    });
  });

  it('com o PostHog desligado, nada vaza e nada lança', () => {
    configMock.posthog.key = undefined;

    expect(() => {
      pesquisaDePerfilExibida({ audience: 'base' });
      perfilDeclaradoDaPessoa({ goal: 'oportunidades_prontas', betting_frequency: 'comecando' });
    }).not.toThrow();

    expect(posthogMock.capture).not.toHaveBeenCalled();
    expect(posthogMock.setPersonProperties).not.toHaveBeenCalled();
  });

  // Se o traço da pessoa lançasse, a exceção subiria pelo handler do botão
  // Enviar — e a pessoa ficaria presa no pop-up por causa de telemetria.
  it('um traço que falha não trava o envio da resposta', () => {
    posthogMock.setPersonProperties.mockImplementationOnce(() => {
      throw new Error('sdk quebrado');
    });

    expect(() =>
      perfilDeclaradoDaPessoa({ goal: 'economizar_tempo', betting_frequency: 'de_vez_em_quando' }),
    ).not.toThrow();
  });
});

describe('o traço de pessoa tem a mesma guarda do evento', () => {
  // Um evento com dado pessoal suja uma linha; um TRAÇO com dado pessoal gruda
  // na pessoa e passa a acompanhar todo evento futuro dela. Se a guarda valia
  // para `capturar`, valia mais ainda aqui.
  it('avisa em DEV quando o payload carrega chave pessoal', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});

    guardarNaPessoa({ email: 'alguem@exemplo.com', profile_goal: 'economizar_tempo' });

    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('email'));
    aviso.mockRestore();
  });

  it('e não avisa quando o payload está limpo', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});

    guardarNaPessoa({ profile_goal: 'economizar_tempo' });

    expect(aviso).not.toHaveBeenCalled();
    aviso.mockRestore();
  });
});

describe('o que não está na lista não suja a base', () => {
  // Quem monta a resposta guarda as escolhas num mapa de string e afirma o tipo
  // com um `as`. Afirmação de tipo não é garantia de valor: se a frase da tela
  // vazar para o lugar do código, o compilador não vê. A conversão é o que
  // impede que isso vire uma categoria nova, para sempre.
  it('um texto de tela no lugar do código vira o escape', () => {
    pesquisaDePerfilRespondida({
      goal: 'Economizar tempo na análise' as never,
      betting_frequency: 'toda_semana',
      audience: 'chegada',
      deferrals: 0,
    });

    const [, props] = posthogMock.capture.mock.calls[0];
    expect(props.goal).toBe('other');
    expect(props.betting_frequency).toBe('toda_semana');
  });

  it('e o traço da pessoa também não aceita', () => {
    perfilDeclaradoDaPessoa({
      goal: 'economizar_tempo',
      betting_frequency: 'Toda semana' as never,
    });

    expect(posthogMock.setPersonProperties).toHaveBeenCalledWith({
      profile_goal: 'economizar_tempo',
      profile_betting_frequency: 'other',
    });
  });
});
