import { describe, expect, it } from 'vitest';
import { acessoAtual, entraNoFutebol, estadoDoTeste, PRODUTOS_EDITAVEIS } from './crm-acesso';
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
    telegram_username: null,
    betinho_subscription_period_end: null,
    analytics_subscription_period_end: null,
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
    });
    expect(acessoAtual(p, 'futebol').ativo).toBe(false);
  });

  it('cada produto da tela tem leitura própria', () => {
    const p = pessoa({ analytics_subscription_status: 'premium' });
    expect(acessoAtual(p, 'analises').ativo).toBe(true);
    expect(acessoAtual(p, 'betinho').ativo).toBe(false);
    expect(acessoAtual(p, 'futebol').ativo).toBe(false);
  });
});

describe('estadoDoTeste', () => {
  it('quem nunca testou', () => {
    expect(estadoDoTeste(pessoa(), AGORA)).toEqual({ tipo: 'nunca' });
  });

  it('teste correndo diz quando termina e quanto falta', () => {
    const p = pessoa({ futebol_trial_started_at: '2026-09-10T12:00:00Z' });
    expect(estadoDoTeste(p, AGORA)).toEqual({
      tipo: 'correndo',
      terminaEm: '2026-09-17',
      diasRestantes: 5,
    });
  });

  it('teste vencido é estado próprio, e não "desligado"', () => {
    // Juntar vencido com nunca esconderia justamente o que o sócio precisa
    // saber antes de dar outro teste: que esta pessoa já usou o dela.
    const p = pessoa({ futebol_trial_started_at: '2026-08-01T12:00:00Z' });
    expect(estadoDoTeste(p, AGORA)).toEqual({ tipo: 'vencido', terminouEm: '2026-08-08' });
  });

  it('o último instante ainda conta como correndo', () => {
    const p = pessoa({ futebol_trial_started_at: '2026-09-05T12:00:01Z' });
    expect(estadoDoTeste(p, AGORA).tipo).toBe('correndo');
  });

  it('o instante seguinte já venceu', () => {
    const p = pessoa({ futebol_trial_started_at: '2026-09-05T11:59:59Z' });
    expect(estadoDoTeste(p, AGORA).tipo).toBe('vencido');
  });

  it('carimbo ilegível não vira teste eterno', () => {
    const p = pessoa({ futebol_trial_started_at: 'sei lá' });
    expect(estadoDoTeste(p, AGORA)).toEqual({ tipo: 'nunca' });
  });
});

describe('entraNoFutebol', () => {
  it('vale pelo teste, mesmo sem assinatura', () => {
    const p = pessoa({ futebol_trial_started_at: '2026-09-10T12:00:00Z' });
    expect(entraNoFutebol(p, AGORA)).toBe(true);
  });

  it('vale pela assinatura, mesmo com o teste vencido', () => {
    const p = pessoa({
      futebol_subscription_status: 'premium',
      futebol_trial_started_at: '2026-01-01T12:00:00Z',
    });
    expect(entraNoFutebol(p, AGORA)).toBe(true);
  });

  it('sem nenhum dos dois, não entra', () => {
    expect(entraNoFutebol(pessoa(), AGORA)).toBe(false);
  });
});

describe('a lista de produtos', () => {
  it('diz qual deles o banco não sabe datar', () => {
    // O futebol não tem coluna de prazo, e está documentado em
    // `shared/concessoes.ts`. A tela precisa avisar ONDE o sócio escolhe, e
    // não depois de ele já ter digitado uma data que seria descartada.
    const futebol = PRODUTOS_EDITAVEIS.find((p) => p.id === 'futebol');
    expect(futebol?.temPrazo).toBe(false);
    expect(PRODUTOS_EDITAVEIS.filter((p) => p.temPrazo).map((p) => p.id)).toEqual([
      'betinho',
      'analises',
    ]);
  });
});
