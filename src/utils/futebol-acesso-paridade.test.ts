import { describe, expect, it } from 'vitest';
import { temAcessoAoFutebolPeloFim } from './futebol-acesso';
import { temAcessoAoFutebol as noTelegram } from '../../supabase/functions/shared/acesso-ao-futebol';

// ============================================================================
// A guarda que impede as duas cópias do acesso ao futebol de divergirem
// ============================================================================
// "O acesso está de pé?" existe DUAS vezes, e tem de existir: o site roda no
// browser e o bot roda em Deno, que não alcança o `src/`. É a mesma fronteira
// da vitrine de mercados ocultos.
//
// A diferença é que ali a divergência esconde um mercado, e aqui ela decide se
// a pessoa recebe ou não o alerta que ela pediu. O site diria "alertas ativos"
// e o Telegram pararia de mandar, ou o contrário — e ninguém veria, porque as
// duas superfícies são lidas em momentos diferentes.
//
// Foi exatamente esse par que divergiu na migration 136: o site media sete dias
// a partir do início do teste enquanto o servidor já cortava em 48 horas pelo
// fim gravado.
//
// Esta guarda compara COMPORTAMENTO, caso a caso, e não texto.
// ============================================================================

const AGORA = Date.parse('2026-09-12T12:00:00Z');
const emHoras = (h: number) => new Date(AGORA + h * 3600000).toISOString();

const CASOS: { nome: string; status: string | null; fim: string | null }[] = [
  { nome: 'assinante sem teste', status: 'premium', fim: null },
  { nome: 'assinante com teste vencido', status: 'premium', fim: emHoras(-100) },
  { nome: 'teste correndo, coorte de 48 horas', status: 'free', fim: emHoras(31) },
  { nome: 'teste correndo, coorte de 7 dias', status: 'free', fim: emHoras(24 * 6) },
  { nome: 'última hora do teste', status: 'free', fim: emHoras(1) },
  { nome: 'teste vencido por uma hora', status: 'free', fim: emHoras(-1) },
  { nome: 'instante exato do fim', status: 'free', fim: emHoras(0) },
  { nome: 'nunca abriu o módulo', status: 'free', fim: null },
  { nome: 'status nulo e sem teste', status: null, fim: null },
  { nome: 'status nulo com teste correndo', status: null, fim: emHoras(5) },
  { nome: 'data de fim ilegível', status: 'free', fim: 'sei lá' },
];

describe('site e Telegram respondem igual sobre o acesso ao futebol', () => {
  it.each(CASOS)('$nome', ({ status, fim }) => {
    const site = temAcessoAoFutebolPeloFim(status, fim, AGORA);
    const telegram = noTelegram(
      { futebol_subscription_status: status, futebol_trial_ends_at: fim },
      AGORA,
    );
    expect(site).toBe(telegram);
  });

  it('e a resposta não é a mesma para todos os casos, senão a guarda não guarda nada', () => {
    // Sem isto, duas funções que devolvessem sempre `false` passariam na
    // comparação acima e a suíte ficaria verde sobre um produto quebrado.
    const respostas = new Set(
      CASOS.map(({ status, fim }) => temAcessoAoFutebolPeloFim(status, fim, AGORA)),
    );
    expect(respostas).toEqual(new Set([true, false]));
  });
});
