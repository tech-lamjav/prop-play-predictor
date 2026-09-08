import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WHATSAPP_DO_TIME } from './contato';

// ============================================================================
// "Falar com o time" leva ao mesmo lugar nos dois menus
// ============================================================================
// O pedido do produto não foi "coloque o WhatsApp no menu da conta" — foi "o
// mesmo link que tem no rodapé". Isso é uma exigência de IGUALDADE entre dois
// arquivos, e igualdade é justamente o que uma string copiada não sustenta:
// basta alguém trocar o número num lugar para metade do app passar a mandar a
// pessoa para um telefone que não atende.
//
// Por isso o teste não olha o valor do link. Ele olha se os dois consumidores
// leem da MESMA constante, que é a única forma de a igualdade sobreviver à
// próxima edição.
// ============================================================================

const fonte = (caminho: string) =>
  readFileSync(resolve(__dirname, '..', caminho), 'utf8').replace(/\r\n/g, '\n');

const FOOTER = fonte('components/Footer.tsx');
const USER_NAV = fonte('components/UserNav.tsx');

/** O número, escrito por extenso só aqui — para poder proibi-lo lá. */
const NUMERO_CRU = '5511952136845';

describe('contato do time', () => {
  it('o WhatsApp é um link wa.me', () => {
    expect(WHATSAPP_DO_TIME).toMatch(/^https:\/\/wa\.me\/\d+$/);
  });

  it('o rodapé e o menu da conta leem a mesma constante', () => {
    for (const arquivo of [FOOTER, USER_NAV]) {
      expect(arquivo).toContain("from '@/config/contato'");
      expect(arquivo).toContain('WHATSAPP_DO_TIME');
    }
  });

  it('nenhum dos dois repete o número na mão', () => {
    expect(FOOTER).not.toContain(NUMERO_CRU);
    expect(USER_NAV).not.toContain(NUMERO_CRU);
  });

  it('"Falar com o time" não é mais e-mail em nenhum dos dois', () => {
    for (const arquivo of [FOOTER, USER_NAV]) {
      const linha = arquivo
        .split('\n')
        .find((l) => l.includes("label: 'Falar com o time'"));
      expect(linha).toBeDefined();
      expect(linha).toContain('WHATSAPP_DO_TIME');
      expect(linha).not.toContain('mailto:');
    }
  });

  it('o menu da conta abre link externo em aba nova, e não pelo router', () => {
    // `navigate` trataria a URL inteira como rota interna e cairia no 404. O
    // ramo do http tem de vir antes dele.
    const go = USER_NAV.slice(USER_NAV.indexOf('const go = (item: MenuItem)'));
    const corpo = go.slice(0, go.indexOf('};'));
    expect(corpo).toContain("item.href?.startsWith('http')");
    expect(corpo).toContain('window.open');
    expect(corpo.indexOf("startsWith('http')")).toBeLessThan(corpo.indexOf('navigate('));
  });
});
