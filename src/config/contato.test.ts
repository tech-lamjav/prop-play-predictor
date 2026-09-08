import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WHATSAPP_DO_TIME, WHATSAPP_FALAR_COM_O_TIME, whatsappDoTime } from './contato';

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

const linhaDoItem = (arquivo: string) =>
  arquivo.split('\n').find((l) => l.includes("label: 'Falar com o time'"));

describe('contato do time', () => {
  it('o WhatsApp é um link wa.me', () => {
    expect(WHATSAPP_DO_TIME).toMatch(/^https:\/\/wa\.me\/\d+$/);
  });

  it('a mensagem pronta é codificada, e não escrita à mão', () => {
    // Acento e espaço quebram a URL. Um link do bolão foi escrito com o %C3%A1
    // digitado na mão, e é isso que este teste impede de virar hábito.
    expect(whatsappDoTime('Olá, tudo bem?')).toBe(
      `${WHATSAPP_DO_TIME}?text=Ol%C3%A1%2C%20tudo%20bem%3F`,
    );
  });

  it('o link de falar com o time leva mensagem pronta', () => {
    expect(WHATSAPP_FALAR_COM_O_TIME).toContain(`${WHATSAPP_DO_TIME}?text=`);
    expect(decodeURIComponent(WHATSAPP_FALAR_COM_O_TIME.split('?text=')[1])).toMatch(/\S/);
  });

  it('o rodapé e o menu da conta leem a mesma constante', () => {
    for (const arquivo of [FOOTER, USER_NAV]) {
      expect(arquivo).toContain("from '@/config/contato'");
      expect(linhaDoItem(arquivo)).toContain('WHATSAPP_FALAR_COM_O_TIME');
    }
  });

  it('nenhum dos dois repete o número na mão', () => {
    expect(FOOTER).not.toContain(NUMERO_CRU);
    expect(USER_NAV).not.toContain(NUMERO_CRU);
  });

  it('"Falar com o time" não é mais e-mail em nenhum dos dois', () => {
    for (const arquivo of [FOOTER, USER_NAV]) {
      const linha = linhaDoItem(arquivo);
      expect(linha).toBeDefined();
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
