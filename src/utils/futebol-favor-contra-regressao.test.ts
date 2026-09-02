import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { separarMotivosDoContrato } from './futebol-motivos';

// ============================================================================
// Juventude × CRB, Mais de 1,5 — o caso que abriu a issue #275
// ============================================================================
// A tela mostrava Score 46 com "A favor 1" e "Contra 3". O backend tinha
// acendido xg_combinado_alto, ritmo_alto e linha_subindo; o catálogo do front
// contou uma. E a RPC devolvia como Contra as negações do lado OPOSTO: "as
// defesas não são firmes" e "os dois criam bastante chance de gol" sustentam
// Over, não pesam contra ele.
//
// A correção é estrutural: o backend só considera os slugs aplicáveis à saída
// analisada, e as duas listas de gols são disjuntas. Este teste existe para que
// a negação do lado oposto não volte por uma edição distraída de qualquer uma
// das pontas — o SQL que escolhe, ou a separação que apresenta.
// ============================================================================

const CONTRATO = readFileSync(
  resolve(__dirname, '../../supabase/migrations/20260829120000_112_futebol_score_contexto_contrato.sql'),
  'utf8',
);

/** Os slugs de um `when '<saida>' then array[...]` dentro do contrato. */
function aplicaveis(saida: 'Over' | 'Under'): string[] {
  const marca = new RegExp(`when '${saida}' then array\\[([\\s\\S]*?)\\]`);
  const bloco = CONTRATO.match(marca);
  expect(bloco, `não achei o array de ${saida}`).not.toBeNull();
  return [...bloco![1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
}

describe('Juventude × CRB · Mais de 1,5', () => {
  it('as premissas de Over e de Under não se cruzam', () => {
    // É isto que impede "as defesas não são firmes" de virar Contra do Over:
    // defesas_firmes é premissa de Under, e Over nunca a consulta.
    const over = aplicaveis('Over');
    const under = aplicaveis('Under');

    expect(over.filter((slug) => under.includes(slug))).toEqual([]);
    expect(under).toContain('defesas_firmes');
    expect(under).toContain('xg_baixo_combinado');
    expect(over).not.toContain('defesas_firmes');
    expect(over).not.toContain('xg_baixo_combinado');
  });

  it('nenhuma das duas listas contém premissa de preço', () => {
    // linha_subindo era a terceira acesa do caso original e é movimento de
    // mercado, não cenário de jogo. O mart deixou de publicá-la (AE #103) e o
    // contrato deixou de listá-la (spec #301).
    for (const saida of ['Over', 'Under'] as const) {
      for (const slug of ['linha_subindo', 'linha_descendo', 'corroboracao_ambos', 'modelo_api_concorda']) {
        expect(aplicaveis(saida), `${saida} · ${slug}`).not.toContain(slug);
      }
    }
  });

  it('com sinais dos dois lados acesos, só os de Over chegam às abas', () => {
    // O jogo real tinha premissa de Over e de Under acesa ao mesmo tempo. O
    // backend manda só as aplicáveis à saída publicada; a tela não escolhe.
    const contratoDaSaidaOver = {
      favor: [
        { id: 'xg_combinado_alto', tipo: 'premissa' as const },
        { id: 'ritmo_alto', tipo: 'premissa' as const },
      ],
      contra: [
        { id: 'ambos_vazam', tipo: 'premissa' as const },
        { id: 'historico_over', tipo: 'premissa' as const },
      ],
    };

    const favor = separarMotivosDoContrato(contratoDaSaidaOver.favor);
    const contra = separarMotivosDoContrato(contratoDaSaidaOver.contra);
    const noContrato = [...favor.slugsDePremissas, ...contra.slugsDePremissas];

    for (const slug of aplicaveis('Under')) {
      expect(noContrato, `Under vazou para a saída Over: ${slug}`).not.toContain(slug);
    }
    expect(favor.slugsDePremissas).toEqual(['xg_combinado_alto', 'ritmo_alto']);
    expect(contra.slugsDePremissas).toEqual(['ambos_vazam', 'historico_over']);
  });

  it('a contagem de A favor é a das premissas que o backend mandou', () => {
    // "A favor 1" com três acesas era o front recontando por catálogo próprio.
    const favor = separarMotivosDoContrato([
      { id: 'xg_combinado_alto', tipo: 'premissa' },
      { id: 'ritmo_alto', tipo: 'premissa' },
      { id: 'defesas_vazaveis', tipo: 'premissa' },
    ]);

    expect(favor.slugsDePremissas).toHaveLength(3);
  });

  it('penalidade de contexto continua em Contra', () => {
    const contra = separarMotivosDoContrato([
      { id: 'ambos_vazam', tipo: 'premissa' },
      { id: 'desfalque_proprio', tipo: 'penalidade', texto: 'Time apostado desfalcado' },
    ]);

    expect(contra.slugsDePremissas).toEqual(['ambos_vazam']);
    expect(contra.motivosSemDrilldown).toEqual([
      { t: 'Time apostado desfalcado', pontos: undefined },
    ]);
  });
});
