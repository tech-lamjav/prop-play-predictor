import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WHATSAPP_DO_TIME, WHATSAPP_FALAR_COM_O_TIME, whatsappDoTime } from './contato';

// ============================================================================
// O WhatsApp do time é um número só, escrito num lugar só
// ============================================================================
// O pedido do produto não foi "coloque o WhatsApp no menu" — foi "o mesmo link
// que tem no rodapé". Isso é uma exigência de IGUALDADE entre arquivos, e
// igualdade é justamente o que uma string copiada não sustenta: basta alguém
// trocar o número num lugar para metade do app passar a mandar a pessoa para um
// telefone que não atende.
//
// A igualdade entre os DOIS MENUS mora em menu-da-conta.test.ts, porque desde
// que eles passaram a ler o mesmo catálogo o assunto é de lá. Aqui fica o
// rodapé, que tem lista própria por ser outro componente.
// ============================================================================

const FOOTER = readFileSync(resolve(__dirname, '../components/Footer.tsx'), 'utf8').replace(
  /\r\n/g,
  '\n',
);

/** O número, escrito por extenso só aqui — para poder proibi-lo lá. */
const NUMERO_CRU = '5511952136845';

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

  it('o rodapé lê a constante, e não repete o número na mão', () => {
    expect(FOOTER).toContain("from '@/config/contato'");
    expect(FOOTER).not.toContain(NUMERO_CRU);
  });

  it('"Falar com o time" no rodapé não é mais e-mail', () => {
    const linha = FOOTER.split('\n').find((l) => l.includes("label: 'Falar com o time'"));
    expect(linha).toBeDefined();
    expect(linha).toContain('WHATSAPP_FALAR_COM_O_TIME');
    expect(linha).not.toContain('mailto:');
  });
});
