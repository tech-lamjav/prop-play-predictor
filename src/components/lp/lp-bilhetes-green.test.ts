import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BILHETES_GREEN, VALIDADE_EM_DIAS } from './lp-bilhetes-green';

// ============================================================================
// Os bilhetes ganhos da landing
// ============================================================================
// Esta seção é imagem em página de venda de produto de aposta, e imagem mente
// devagar: o arquivo some e ninguém vê, a altura declarada erra e a página
// pula, a data passa e a prova vira histórica sem nenhum aviso. Nada disso
// aparece em code review — só no ar, e tarde.
//
// O último teste é o mais importante dos quatro. A verificação no banco em
// 08/09/2026 mostrou que NENHUM destes três bilhetes veio de uma oportunidade
// publicada pela plataforma, e por isso a seção não pode citar o Score nem a
// metodologia. Isso é uma promessa que só o código sustenta.
// ============================================================================

const RAIZ = resolve(__dirname, '../../..');

/**
 * O componente sem os comentários.
 *
 * A docstring dele fala de Score e de metodologia justamente pra explicar por
 * que a seção não pode citar nenhum dos dois. Sem tirar os comentários, o
 * teste lá embaixo se acusaria por causa da explicação de si mesmo.
 */
const FONTE_VISIVEL = readFileSync(resolve(__dirname, 'LpBilhetesGreen.tsx'), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

/** Largura e altura de um PNG, lidas do cabeçalho (bytes 16 a 23, big-endian). */
function dimensoesDoPng(caminho: string): { largura: number; altura: number } {
  const buf = readFileSync(caminho);
  return { largura: buf.readUInt32BE(16), altura: buf.readUInt32BE(20) };
}

describe('bilhetes ganhos da landing', () => {
  it('cada arquivo existe em public/, com as dimensões que o dado declara', () => {
    // Dimensão errada não quebra nada visivelmente: só faz a página pular
    // quando a imagem carrega, que é o defeito que width/height existem pra
    // evitar. Um recorte novo com altura diferente passaria batido.
    for (const b of BILHETES_GREEN) {
      const caminho = resolve(RAIZ, 'public', b.src.replace(/^\//, ''));
      const real = dimensoesDoPng(caminho);
      expect({ src: b.src, ...real }).toEqual({
        src: b.src,
        largura: b.largura,
        altura: b.altura,
      });
    }
  });

  it('nenhum bilhete passou da validade', () => {
    // Quando este teste ficar vermelho, não tem bug pra caçar: a prova social
    // envelheceu. Troque o bilhete mais antigo por um green recente, no mesmo
    // enquadramento, e atualize `dataISO`.
    const hoje = Date.now();
    const vencidos = BILHETES_GREEN.filter((b) => {
      const dias = (hoje - Date.parse(b.dataISO)) / 86_400_000;
      return dias > VALIDADE_EM_DIAS;
    }).map((b) => `${b.jogo} (${b.data})`);

    expect(vencidos).toEqual([]);
  });

  it('toda imagem tem descrição para leitor de tela', () => {
    for (const b of BILHETES_GREEN) {
      expect(b.alt.length).toBeGreaterThan(20);
      expect(b.alt).not.toBe(b.jogo);
    }
  });

  it('a seção não atribui os bilhetes à metodologia', () => {
    // Nenhum destes bilhetes veio de oportunidade publicada — está conferido
    // jogo por jogo no cabeçalho de lp-bilhetes-green.ts. Enquanto for assim,
    // citar Score, metodologia ou taxa de acerto aqui seria dizer na página
    // uma coisa que o banco desmente.
    expect(FONTE_VISIVEL).not.toMatch(/\bScore\b/i);
    expect(FONTE_VISIVEL).not.toMatch(/\bmetodologia\b/i);
    expect(FONTE_VISIVEL).not.toMatch(/taxa de acerto/i);
  });
});
