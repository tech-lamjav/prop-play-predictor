import { describe, expect, it } from 'vitest';
import { acessoAtual, estadoDoTeste, PRODUTOS_EDITAVEIS } from './crm-acesso';
import type { Pessoa } from './crm-ficha';

const AGORA = new Date('2026-09-12T12:00:00Z').getTime();

function pessoa(campos: Partial<Pessoa> = {}): Pessoa {
  return {
    id: 'p1',
    name: 'Maria Silva',
    email: 'maria@exemplo.com',
    whatsapp_number: null,
    created_at: '2026-09-01T12:00:00Z',
    betinho_subscription_status: null,
    futebol_subscription_status: 'free',
    analytics_subscription_status: null,
    telegram_synced: null,
    subscription_product_type: null,
    futebol_trial_started_at: null,
    futebol_publication_alerts_ack_at: null,
    futebol_trial_ends_at: null,
    telegram_username: null,
    betinho_subscription_period_end: null,
    analytics_subscription_period_end: null,
    has_report_access: null,
    ...campos,
  };
}

describe('acessoAtual', () => {
  it('abre mostrando o que já vale, e não em branco', () => {
    // Um formulário em branco sobre um acesso que existe é um convite a
    // apagá-lo sem querer: o sócio mexe numa coisa e salva as outras zeradas.
    const p = pessoa({
      betinho_subscription_status: 'premium',
      betinho_subscription_period_end: '2026-10-12T03:00:00Z',
    });
    expect(acessoAtual(p, 'betinho')).toEqual({ ativo: true, ate: '2026-10-12' });
  });

  it('sem data guardada, o campo de prazo fica vazio', () => {
    const p = pessoa({ betinho_subscription_status: 'premium' });
    expect(acessoAtual(p, 'betinho')).toEqual({ ativo: true, ate: '' });
  });

  it('a renovação é o dia de Brasília, e não o de Greenwich', () => {
    // O Stripe grava 01/10 à meia-noite UTC, que é 30/09 às 21h aqui. A data
    // que o sócio lê é a daqui: ele vai falar com alguém que mora neste fuso,
    // e um dia a mais no campo vira um dia a mais prometido na conversa.
    const p = pessoa({
      betinho_subscription_status: 'premium',
      betinho_subscription_period_end: '2026-10-01T00:00:00Z',
    });
    expect(acessoAtual(p, 'betinho').ate).toBe('2026-09-30');
  });

  it('data ilegível no banco não vira "Invalid Date" no campo', () => {
    const p = pessoa({
      betinho_subscription_status: 'premium',
      betinho_subscription_period_end: 'qualquer coisa',
    });
    expect(acessoAtual(p, 'betinho').ate).toBe('');
  });

  it('o futebol lê o status, e nunca o teste', () => {
    // Juntar os dois num interruptor só faria desligar o premium apagar o
    // teste da pessoa, que é outra decisão e tem controle próprio.
    const p = pessoa({
      futebol_subscription_status: 'free',
      futebol_trial_started_at: '2026-09-11T12:00:00Z',
      futebol_trial_ends_at: '2026-09-13T12:00:00Z',
    });
    expect(acessoAtual(p, 'futebol').ativo).toBe(false);
  });

  it('cada produto da tela tem leitura própria', () => {
    const p = pessoa({ analytics_subscription_status: 'premium' });
    expect(acessoAtual(p, 'analises').ativo).toBe(true);
    expect(acessoAtual(p, 'betinho').ativo).toBe(false);
    expect(acessoAtual(p, 'futebol').ativo).toBe(false);
    expect(acessoAtual(p, 'relatorios').ativo).toBe(false);
  });

  it('a marca dos relatórios aparece, e ela não é assinatura', () => {
    // `has_report_access` abre os relatórios sem passar pelo Stripe, e
    // `use-report-access` olha ela ANTES de qualquer assinatura. A ficha não
    // mostrava: uma conta liberada assim aparecia como "sem acesso" enquanto o
    // produto deixava a pessoa entrar.
    const p = pessoa({ has_report_access: true });
    expect(acessoAtual(p, 'relatorios')).toEqual({ ativo: true, ate: '' });
    // E não contamina os outros: é coluna à parte.
    expect(acessoAtual(p, 'analises').ativo).toBe(false);
  });

  it('a coluna nula dos relatórios é "não", e não "não sei"', () => {
    expect(acessoAtual(pessoa({ has_report_access: null }), 'relatorios').ativo).toBe(false);
  });
});

describe('estadoDoTeste', () => {
  it('quem nunca testou', () => {
    expect(estadoDoTeste(pessoa(), AGORA)).toEqual({ tipo: 'nunca' });
  });

  it('teste correndo diz quando termina e quanto falta', () => {
    const p = pessoa({
      futebol_trial_started_at: '2026-09-10T12:00:00Z',
      futebol_trial_ends_at: '2026-09-17T12:00:00Z',
    });
    expect(estadoDoTeste(p, AGORA)).toEqual({
      tipo: 'correndo',
      terminaEm: '2026-09-17',
      diasRestantes: 5,
    });
  });

  it('vale o fim gravado, e não o início mais sete dias', () => {
    // ⚠️ O teste passou para 48 horas. Começado ontem, termina amanhã. Somar
    // sete dias ao início diria que sobram seis, e o sócio abriria a conversa
    // de conversão depois de a pessoa ter perdido o acesso.
    const p = pessoa({
      futebol_trial_started_at: '2026-09-11T12:00:00Z',
      futebol_trial_ends_at: '2026-09-13T12:00:00Z',
    });
    expect(estadoDoTeste(p, AGORA)).toEqual({
      tipo: 'correndo',
      terminaEm: '2026-09-13',
      diasRestantes: 1,
    });
  });

  it('quem começou antes da troca continua com os sete dias', () => {
    const p = pessoa({
      futebol_trial_started_at: '2026-09-08T12:00:00Z',
      futebol_trial_ends_at: '2026-09-15T12:00:00Z',
    });
    expect(estadoDoTeste(p, AGORA)).toMatchObject({ tipo: 'correndo', terminaEm: '2026-09-15' });
  });

  it('teste vencido é estado próprio, e não "desligado"', () => {
    // Juntar vencido com nunca esconderia justamente o que o sócio precisa
    // saber antes de dar outro teste: que esta pessoa já usou o dela.
    const p = pessoa({
      futebol_trial_started_at: '2026-08-01T12:00:00Z',
      futebol_trial_ends_at: '2026-08-08T12:00:00Z',
    });
    expect(estadoDoTeste(p, AGORA)).toEqual({ tipo: 'vencido', terminouEm: '2026-08-08' });
  });

  it('o último instante antes do fim ainda conta como correndo', () => {
    const p = pessoa({ futebol_trial_ends_at: '2026-09-12T12:00:01Z' });
    expect(estadoDoTeste(p, AGORA).tipo).toBe('correndo');
  });

  it('no instante do fim, já venceu', () => {
    const p = pessoa({ futebol_trial_ends_at: '2026-09-12T12:00:00Z' });
    expect(estadoDoTeste(p, AGORA).tipo).toBe('vencido');
  });

  it('fim à meia-noite daqui não promete aquele dia', () => {
    // 03:00Z do dia 20 é meia-noite do dia 20 em Brasília: o acesso acabou no
    // fim do dia 19. Pelo dia do carimbo, a tela prometeria o dia 20 inteiro.
    const p = pessoa({ futebol_trial_ends_at: '2026-09-20T03:00:00Z' });
    expect(estadoDoTeste(p, AGORA)).toMatchObject({ terminaEm: '2026-09-19' });
  });

  it('carimbo ilegível não vira teste eterno', () => {
    const p = pessoa({ futebol_trial_ends_at: 'sei lá' });
    expect(estadoDoTeste(p, AGORA)).toEqual({ tipo: 'nunca' });
  });
});

describe('a lista de produtos', () => {
  it('só o Betinho e as Análises têm prazo', () => {
    // Os outros dois não têm coluna de data no banco. A tela precisa avisar
    // ONDE o sócio escolhe, e não depois de ele já ter digitado uma data que
    // seria descartada.
    expect(PRODUTOS_EDITAVEIS.filter((p) => !p.semPrazoPorque).map((p) => p.id)).toEqual([
      'betinho',
      'analises',
    ]);
  });

  it('cada um sem prazo explica o SEU motivo', () => {
    // Com um booleano, os dois dividiam a mesma frase, e ela falava do
    // futebol: a linha dos relatórios dizia que o banco não guarda o prazo do
    // futebol, que é verdade e não é sobre ela.
    const semPrazo = PRODUTOS_EDITAVEIS.filter((p) => p.semPrazoPorque);
    expect(semPrazo).toHaveLength(2);
    expect(new Set(semPrazo.map((p) => p.semPrazoPorque)).size).toBe(2);
    expect(PRODUTOS_EDITAVEIS.find((p) => p.id === 'relatorios')?.semPrazoPorque).not.toMatch(
      /futebol/i,
    );
  });
});
