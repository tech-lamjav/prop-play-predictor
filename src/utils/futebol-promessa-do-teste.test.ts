import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================================================
// A guarda que impede a promessa do teste de divergir do produto
// ============================================================================
// A duração do teste grátis é uma PROMESSA, e ela estava escrita em 26 lugares
// de copy espalhados por cinco arquivos: landing do futebol, as quatro
// variações de landing, o bloco de oferta, a tabela de planos, o FAQ, o gate.
// Nenhum deles sabia da existência dos outros.
//
// Enquanto o produto entregou 7 dias isso passou, porque as 26 cópias diziam a
// mesma coisa por sorte. No dia em que o produto passou para 48 horas, cada
// cópia esquecida virou uma página prometendo o que o produto não entrega — e
// promessa de teste na landing não é detalhe de texto, é o que a pessoa viu
// antes de criar a conta.
//
// Esta guarda não confere texto igual: confere UNIDADE. Se alguém voltar a
// medir o teste em dias em qualquer uma dessas telas, quebra aqui.
//
// Mesmo modo de falha das guardas do shape file (#250) e da copy de premissa
// (#272): divergência silenciosa que só aparece quando alguém lê.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');

/** Toda tela que fala da duração do teste grátis para o usuário. */
const TELAS = [
  'src/components/lp/LpOferta.tsx',
  'src/components/futebol/FutebolGate.tsx',
  'src/pages/FutebolLP.tsx',
  'src/pages/FutebolAssinar.tsx',
  'src/pages/Planos.tsx',
  'src/pages/lp/LpVariant.tsx',
  'src/pages/lp/variants.ts',
];

/**
 * Jeitos de prometer o teste em DIAS.
 *
 * Cada padrão exige um número antes de "dia", porque "picks do dia" e "3
 * apostas por dia" são outra coisa e continuam válidos nessas mesmas telas.
 */
const PROMESSA_EM_DIAS = [
  /\d+\s+dias?\s+grátis/i,
  /grátis\s+de\s+\d+\s+dias?/i,
  /(?:por|testa|teste)\s+\d+\s+dias?/i,
  /\d+\s+dias?\s+de\s+(?:premium|acesso|teste)/i,
];

describe('a promessa do teste grátis', () => {
  it.each(TELAS)('%s não mede o teste em dias', (tela) => {
    const conteudo = readFileSync(resolve(RAIZ, tela), 'utf8');
    const achados = PROMESSA_EM_DIAS.flatMap((re) => conteudo.match(re) ?? []);
    expect(
      achados,
      `${tela} promete o teste em dias: ${achados.join(' | ')}. O produto entrega 48 horas.`,
    ).toEqual([]);
  });

  it('as telas de venda continuam dizendo quanto o teste dura', () => {
    // Sem isto, apagar a promessa passaria pela guarda de cima: a tela ficaria
    // silenciosa sobre a duração, que é pior que dizê-la errada.
    const vendem = [
      'src/components/lp/LpOferta.tsx',
      'src/pages/FutebolLP.tsx',
      'src/pages/Planos.tsx',
      'src/pages/lp/variants.ts',
    ];
    for (const tela of vendem) {
      const conteudo = readFileSync(resolve(RAIZ, tela), 'utf8');
      expect(conteudo, `${tela} não diz quanto dura o teste`).toMatch(/48\s+horas/i);
    }
  });
});
