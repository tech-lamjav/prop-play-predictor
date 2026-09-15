import { describe, expect, it } from 'vitest';
import { mensagemDeCobranca, mensagemDeConversao, prazoDe, type Prazo } from './crm-cobranca';

const HOJE = '2026-09-12';

describe('prazoDe', () => {
  it('conta os dias que faltam', () => {
    expect(prazoDe('2026-09-20', HOJE)).toEqual({ tipo: 'a_vencer', dias: 8 });
  });

  it('vencer hoje é estado próprio', () => {
    // "Vence em 0 dias" é frase de máquina, e a conversa muda: hoje é o último
    // dia de acesso, e não uma data futura nem um acesso que já caiu.
    expect(prazoDe('2026-09-12', HOJE)).toEqual({ tipo: 'hoje' });
  });

  it('já vencida conta há quantos dias', () => {
    expect(prazoDe('2026-09-05', HOJE)).toEqual({ tipo: 'vencida', dias: 7 });
  });

  it('o dia seguinte já é vencida por um dia', () => {
    expect(prazoDe('2026-09-11', HOJE)).toEqual({ tipo: 'vencida', dias: 1 });
  });

  it('amanhã ainda é a vencer, com um dia', () => {
    expect(prazoDe('2026-09-13', HOJE)).toEqual({ tipo: 'a_vencer', dias: 1 });
  });
});

describe('mensagemDeCobranca', () => {
  const aVencer: Prazo = { tipo: 'a_vencer', dias: 8 };

  it('usa o primeiro nome de quem tem nome', () => {
    expect(mensagemDeCobranca('Maria Silva', 'Essencial', '2026-09-20', aVencer)).toContain(
      'Maria',
    );
  });

  it('sem nome, não sobra vírgula solta', () => {
    const texto = mensagemDeCobranca(null, 'Essencial', '2026-09-20', aVencer);
    expect(texto).not.toMatch(/,\s*[!?.]/);
    expect(texto.trim()).toBe(texto);
  });

  it('diz o plano e a data, porque é disso que a cobrança trata', () => {
    const texto = mensagemDeCobranca('Maria', 'Essencial', '2026-09-20', aVencer);
    expect(texto).toContain('Essencial');
    expect(texto).toContain('20/09/2026');
  });

  it('a mensagem de quem já venceu fala no passado', () => {
    // Mandar "vai até" para quem já perdeu o acesso é a mensagem chegando
    // depois do fato, e quem lê percebe que ninguém olhou antes de escrever.
    const texto = mensagemDeCobranca('Maria', 'Essencial', '2026-09-05', {
      tipo: 'vencida',
      dias: 7,
    });
    expect(texto).toMatch(/venceu|encerrou|acabou/i);
    expect(texto).not.toMatch(/vai até/i);
  });

  it('a de hoje avisa que é hoje', () => {
    const texto = mensagemDeCobranca('Maria', 'Essencial', HOJE, { tipo: 'hoje' });
    expect(texto).toMatch(/hoje/i);
  });

  it('nenhuma delas usa travessão', () => {
    // Mesma regra das mensagens de abordagem: elas são coladas no WhatsApp, e
    // ninguém escreve com travessão lá.
    const prazos: Prazo[] = [
      { tipo: 'a_vencer', dias: 8 },
      { tipo: 'a_vencer', dias: 1 },
      { tipo: 'hoje' },
      { tipo: 'vencida', dias: 1 },
      { tipo: 'vencida', dias: 30 },
    ];
    for (const prazo of prazos) {
      for (const nome of ['Maria', null]) {
        for (const plano of ['Entrada', 'Essencial', 'Completo']) {
          const texto = mensagemDeCobranca(nome, plano, '2026-09-20', prazo);
          expect(texto, `${plano} · ${prazo.tipo}`).not.toMatch(/[–—]/);
        }
      }
    }
  });

  it('um dia no singular, e não "1 dias"', () => {
    expect(
      mensagemDeCobranca('Maria', 'Essencial', '2026-09-13', { tipo: 'a_vencer', dias: 1 }),
    ).not.toMatch(/1 dias/);
  });
});

describe('mensagemDeConversao', () => {
  it('usa o primeiro nome, e sem nome não sobra vírgula', () => {
    expect(mensagemDeConversao('Maria Silva', 3)).toContain('Maria');
    const anonimo = mensagemDeConversao(null, 3);
    expect(anonimo).not.toMatch(/,\s*[!?.]/);
    expect(anonimo.trim()).toBe(anonimo);
  });

  it('a véspera diz "amanhã", e não "em 1 dias"', () => {
    const texto = mensagemDeConversao('Maria', 1);
    expect(texto).toContain('amanhã');
    expect(texto).not.toMatch(/1 dias|em 1 dia/);
  });

  it('o último dia diz que é hoje', () => {
    // "Acaba amanhã" para quem perde o acesso hoje à noite é a mensagem
    // chegando com um dia de atraso, no dia que menos podia.
    const texto = mensagemDeConversao('Maria', 0);
    expect(texto).toMatch(/hoje/i);
    // A palavra "amanhã" pode aparecer, e aparece: "você não fica sem nada
    // amanhã". O que ela não pode dizer é que o teste ACABA amanhã.
    expect(texto).not.toMatch(/acaba amanhã/);
  });

  it('depois de vencer, fala no passado e oferece retomada', () => {
    const texto = mensagemDeConversao('Maria', -3);
    expect(texto).toMatch(/acabou/i);
    expect(texto).not.toMatch(/acaba amanhã|último dia/);
    expect(texto).toMatch(/de volta|retomar/i);
  });

  it('nunca promete preço nem link', () => {
    // Quem sabe o que foi combinado é o sócio. Um valor errado numa proposta é
    // pior que nenhum, e um link inventado é pior ainda.
    for (const dias of [-5, 0, 1, 5]) {
      const texto = mensagemDeConversao('Maria', dias);
      expect(texto, String(dias)).not.toMatch(/R\$|http|link/i);
    }
  });

  it('nenhuma delas usa travessão', () => {
    for (const dias of [-30, -1, 0, 1, 2, 6]) {
      for (const nome of ['Maria', null]) {
        expect(mensagemDeConversao(nome, dias), String(dias)).not.toMatch(/[–—]/);
      }
    }
  });
});
