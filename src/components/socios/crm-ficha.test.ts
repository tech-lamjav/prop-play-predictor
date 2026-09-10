import { describe, expect, it } from 'vitest';
import { acessos, ganchoDe, nomeDoPlano, primeiroNome, type Pessoa } from './crm-ficha';
import { cadastroDeTeste } from './crm-cadastro-de-teste';

/**
 * A ficha é o cadastro da lista mais três campos. A fábrica reflete isso em vez
 * de repetir a dúzia de campos comuns — cópias de fixture divergem calado.
 */
const pessoa = (over: Partial<Pessoa> = {}): Pessoa => ({
  ...cadastroDeTeste({
    name: 'Maria Silva',
    email: 'maria@exemplo.com',
    created_at: '2026-09-01T12:00:00Z',
  }),
  telegram_username: null,
  betinho_subscription_period_end: null,
  analytics_subscription_period_end: null,
  ...over,
});

describe('nomeDoPlano', () => {
  it('traduz os três degraus da escada', () => {
    expect(nomeDoPlano('entrada')).toBe('Entrada');
    expect(nomeDoPlano('essencial')).toBe('Essencial');
    expect(nomeDoPlano('completo')).toBe('Completo');
  });

  it('traduz também os nomes legados que vivem no Stripe', () => {
    // Assinantes vivos carregam `betinho`, `futebol`, `analytics` e `platform`
    // no metadata da assinatura — está documentado em `shared/concessoes.ts`.
    // Só capitalizar o valor cru mostraria "Platform" na tela do sócio.
    expect(nomeDoPlano('betinho')).toBe('Entrada');
    expect(nomeDoPlano('futebol')).toBe('Essencial');
    expect(nomeDoPlano('analytics')).toBe('Análises (plano antigo)');
    expect(nomeDoPlano('platform')).toBe('Análises (plano antigo)');
  });

  it('não inventa nome para valor desconhecido', () => {
    expect(nomeDoPlano('qualquer-coisa')).toBeNull();
    expect(nomeDoPlano(null)).toBeNull();
    expect(nomeDoPlano('  ')).toBeNull();
  });
});

describe('acessos', () => {
  it('diz qual está ligado', () => {
    const lista = acessos(pessoa({ futebol_subscription_status: 'premium' }));
    expect(lista.find((a) => a.produto === 'Futebol')?.ativo).toBe(true);
    expect(lista.find((a) => a.produto === 'Betinho')?.ativo).toBe(false);
  });

  it('o teste gratuito conta como acesso ao futebol', () => {
    const agora = Date.parse('2026-09-10T12:00:00Z');
    const dentro = pessoa({ futebol_trial_started_at: '2026-09-08T12:00:00Z' });
    const fora = pessoa({ futebol_trial_started_at: '2026-08-01T12:00:00Z' });
    expect(acessos(dentro, agora).find((a) => a.produto === 'Futebol')?.ativo).toBe(true);
    expect(acessos(fora, agora).find((a) => a.produto === 'Futebol')?.ativo).toBe(false);
  });

  it('o futebol não tem data de renovação no banco, e isso é dito', () => {
    // `public.users` só tem `futebol_subscription_status`, sem as três colunas
    // de metadados. É deliberado, está em `shared/concessoes.ts`. Mostrar um
    // traço ali seria lido como "não renova", que é outra coisa.
    const futebol = acessos(pessoa({ futebol_subscription_status: 'premium' })).find(
      (a) => a.produto === 'Futebol',
    );
    expect(futebol?.semDataNoBanco).toBe(true);
    expect(futebol?.renovaEm).toBeNull();
  });

  it('os outros dois trazem a renovação quando existe', () => {
    const lista = acessos(
      pessoa({
        betinho_subscription_status: 'premium',
        betinho_subscription_period_end: '2026-10-01T00:00:00Z',
      }),
    );
    const betinho = lista.find((a) => a.produto === 'Betinho');
    expect(betinho?.semDataNoBanco).toBe(false);
    expect(betinho?.renovaEm).toBe('2026-10-01T00:00:00Z');
  });
});

describe('ganchoDe', () => {
  it('uso de verdade vence o plano', () => {
    // O caso que originou o CRM: assinante do Essencial cujo olho brilhou no
    // Betinho. Pelo plano o gancho seria futebol, e a abordagem erraria o alvo.
    const g = ganchoDe(pessoa({ subscription_product_type: 'essencial' }), { total: 12, ultima: null });
    expect(g.tipo).toBe('betinho');
    expect(g.porque).toMatch(/12 apostas/);
  });

  it('quem começou o teste do futebol veio pelo futebol', () => {
    const g = ganchoDe(pessoa({ futebol_trial_started_at: '2026-09-05T12:00:00Z' }), {
      total: 0,
      ultima: null,
    });
    expect(g.tipo).toBe('futebol');
  });

  it('dispensar o cartão dos alertas também é sinal de futebol', () => {
    const g = ganchoDe(pessoa({ futebol_publication_alerts_ack_at: '2026-09-05T12:00:00Z' }), {
      total: 0,
      ultima: null,
    });
    expect(g.tipo).toBe('futebol');
  });

  it('a preferência de alertas NÃO é sinal, porque nasce ligada', () => {
    // `futebol_publication_alerts_enabled` tem default true na migration: todo
    // mundo tem. Usá-la como sinal marcaria a base inteira como futebol.
    const g = ganchoDe(pessoa(), { total: 0, ultima: null });
    expect(g.tipo).toBe('indefinido');
  });

  it('sem uso nenhum, o plano decide', () => {
    const semUso = { total: 0, ultima: null };
    expect(ganchoDe(pessoa({ subscription_product_type: 'completo' }), semUso).tipo).toBe('nba');
    expect(ganchoDe(pessoa({ subscription_product_type: 'essencial' }), semUso).tipo).toBe('futebol');
    expect(ganchoDe(pessoa({ subscription_product_type: 'entrada' }), semUso).tipo).toBe('betinho');
  });

  it('vincular o Telegram sem mais nada aponta para o Betinho', () => {
    const g = ganchoDe(pessoa({ telegram_synced: true }), { total: 0, ultima: null });
    expect(g.tipo).toBe('betinho');
  });

  it('sem sinal nenhum, admite que não sabe', () => {
    // Um gancho inventado é pior que gancho nenhum: a abordagem sai com a
    // confiança errada.
    const g = ganchoDe(pessoa(), { total: 0, ultima: null });
    expect(g.tipo).toBe('indefinido');
    expect(g.porque).toMatch(/não deu sinal/i);
  });

  it('consulta de apostas falhando NÃO vira "não apostou"', () => {
    // O erro e o zero caíam no mesmo galho, e o palpite dizia "não deu sinal"
    // com a cara de quem tinha conferido. A aposta é o sinal mais forte e o
    // primeiro da fila: sem ela, qualquer palpite abaixo pode estar errado.
    const g = ganchoDe(pessoa({ subscription_product_type: 'essencial' }), null);
    expect(g.apostasDesconhecidas).toBe(true);
    expect(g.tipo).toBe('futebol');
  });

  it('com a consulta respondendo, o palpite não é marcado como manco', () => {
    expect(ganchoDe(pessoa(), { total: 0, ultima: null }).apostasDesconhecidas).toBe(false);
  });

  it('todo gancho vem com o porquê preenchido', () => {
    const casos = [
      ganchoDe(pessoa(), { total: 3, ultima: null }),
      ganchoDe(pessoa({ futebol_trial_started_at: '2026-09-05T12:00:00Z' }), { total: 0, ultima: null }),
      ganchoDe(pessoa({ subscription_product_type: 'completo' }), { total: 0, ultima: null }),
      ganchoDe(pessoa(), { total: 0, ultima: null }),
    ];
    for (const c of casos) expect(c.porque.trim().length).toBeGreaterThan(0);
  });
});

describe('primeiroNome', () => {
  it('pega só o primeiro', () => {
    expect(primeiroNome('Maria Silva Souza')).toBe('Maria');
  });

  it('sem nome, devolve nulo em vez de string vazia', () => {
    // String vazia vira "Oi, !" na mensagem pronta.
    expect(primeiroNome(null)).toBeNull();
    expect(primeiroNome('   ')).toBeNull();
  });
});
