import { describe, expect, it } from 'vitest';
import { etapaDe, filtrarPorEtapa } from './crm-funil';
import { ETAPAS, ETAPA_PADRAO, ROTULO_DA_ETAPA } from './crm-vocabulario';
import { cadastroDeTeste as cadastro } from './crm-cadastro-de-teste';

describe('etapaDe', () => {
  it('quem não tem linha vale como novo', () => {
    // A ausência é o estado inicial de propósito: exigir uma escrita para o
    // lead existir faria todo cadastro novo depender de um gatilho, e um
    // gatilho que falha esconde o lead em vez de mostrá-lo errado.
    expect(etapaDe({}, 'u1')).toBe('novo');
    expect(ETAPA_PADRAO).toBe('novo');
  });

  it('devolve a etapa gravada quando existe', () => {
    expect(etapaDe({ u1: 'nutrindo' }, 'u1')).toBe('nutrindo');
  });

  it('etapa desconhecida no banco não vira etapa fantasma na tela', () => {
    // O banco tem restrição, mas ela pode ser afrouxada por migration futura
    // sem ninguém lembrar da tela. Cair no padrão é melhor que renderizar um
    // rótulo `undefined`.
    expect(etapaDe({ u1: 'inventada' }, 'u1')).toBe('novo');
  });
});

describe('ROTULO_DA_ETAPA', () => {
  it('toda etapa tem rótulo', () => {
    // Um rótulo faltando vira `undefined` no seletor, e o sócio escolhe um
    // item em branco sem saber o que escolheu.
    for (const etapa of ETAPAS) expect(ROTULO_DA_ETAPA[etapa]).toBeTruthy();
  });
});

describe('filtrarPorEtapa', () => {
  const base = [cadastro({ id: 'a' }), cadastro({ id: 'b' }), cadastro({ id: 'c' })];
  const etapas = { b: 'contatado', c: 'interesse' };

  it('sem filtro, devolve tudo', () => {
    expect(filtrarPorEtapa(base, etapas, null)).toHaveLength(3);
  });

  it('filtra pela etapa gravada', () => {
    expect(filtrarPorEtapa(base, etapas, 'contatado').map((c) => c.id)).toEqual(['b']);
  });

  it('o filtro de "novo" encontra quem nunca foi tocado', () => {
    // O caso que mais importa: lead novo não tem linha na tabela. Um filtro
    // que só olhasse o que está gravado devolveria zero justamente na etapa
    // onde está todo mundo que ainda falta abordar.
    expect(filtrarPorEtapa(base, etapas, 'novo').map((c) => c.id)).toEqual(['a']);
  });
});
