import { describe, expect, it } from 'vitest';
import { MOEDAS, casaBusca, nomeDaMoeda, textoDeBusca } from './moedas';
import { nomeDoPais } from './paises';

// ============================================================================
// A busca do seletor de moeda acha o que a pessoa sabe digitar
// ============================================================================
// O seletor era um <select> com "R$ · BRL" em cada linha e 22 opções para
// rolar. A busca é a promessa da versão nova, e quem procura uma moeda nem
// sempre sabe o nome dela: sabe o PAÍS. Quem é de Portugal digita "portugal",
// não "euro"; quem está no Equador digita "ecuador" e precisa achar o dólar.
// ============================================================================

function achar(busca: string, locale: string): string[] {
  return MOEDAS.filter((m) => casaBusca(textoDeBusca(m, locale, (p) => nomeDoPais(p, locale)), busca)).map(
    (m) => m.codigo,
  );
}

describe('a busca de moeda', () => {
  it('acha pelo nome da moeda, no idioma da tela', () => {
    expect(achar('sol', 'es-419')).toContain('PEN');
    expect(achar('peso chileno', 'es-419')).toEqual(['CLP']);
  });

  it('acha pelo PAÍS, que é o que a pessoa sabe', () => {
    expect(achar('peru', 'es-419')).toContain('PEN');
    expect(achar('argentina', 'es-419')).toContain('ARS');
  });

  it('acha o euro por qualquer país que o usa', () => {
    for (const pais of ['portugal', 'españa', 'alemania', 'francia', 'italia']) {
      expect(achar(pais, 'es-419'), pais).toContain('EUR');
    }
  });

  it('acha o dólar pelo Equador, que usa dólar', () => {
    expect(achar('ecuador', 'es-419')).toContain('USD');
  });

  it('ignora acento', () => {
    expect(achar('dolar', 'es-419')).toContain('USD');
    expect(achar('mexico', 'es-419')).toContain('MXN');
  });

  it('acha pelo código e pelo símbolo', () => {
    expect(achar('BRL', 'pt-BR')).toEqual(['BRL']);
    expect(achar('S/', 'es-419')).toContain('PEN');
  });

  it('funciona em português também', () => {
    expect(achar('real', 'pt-BR')).toContain('BRL');
    expect(achar('alemanha', 'pt-BR')).toContain('EUR');
  });
});

describe('o que a lista mostra', () => {
  it('o nome sai no idioma da tela e com maiúscula', () => {
    // O CLDR escreve "sol peruano" em minúscula no espanhol, e numa lista um
    // item começando em minúscula parece erro.
    expect(nomeDaMoeda('PEN', 'es-419')).toBe('Sol peruano');
    expect(nomeDaMoeda('BRL', 'pt-BR')).toBe('Real brasileiro');
  });

  it('o dólar tem a bandeira dos EUA, e não a do Equador', () => {
    // A lista deriva dos países na ordem do cadastro, e o Equador vem antes.
    expect(MOEDAS.find((m) => m.codigo === 'USD')?.bandeira).toBe('US');
    expect(MOEDAS.find((m) => m.codigo === 'EUR')?.bandeira).toBe('EU');
  });

  it('a moeda de um país só tem a bandeira dele', () => {
    expect(MOEDAS.find((m) => m.codigo === 'PEN')?.bandeira).toBe('PE');
  });
});
