import { describe, expect, it } from 'vitest';
import { separarMotivosDoContrato } from './futebol-motivos';

// O contrato SQL em si (quais premissas são aplicáveis a cada saída, e o que
// não pode virar razão) é guardado por futebol-contrato-score.test.ts. Aqui só
// entra a repartição visual: o que vai para o catálogo com drilldown jogo a
// jogo e o que é texto pronto do backend.

describe('separarMotivosDoContrato', () => {
  it('manda slug para o catálogo e texto pronto para a lista sem drilldown', () => {
    const separados = separarMotivosDoContrato([
      { id: 'xg_combinado_alto', tipo: 'premissa' },
      { id: 'ritmo_alto', tipo: 'premissa' },
      { id: 'desfalque_proprio', tipo: 'penalidade', texto: 'Time apostado com desfalque de titular importante' },
    ]);

    expect(separados.slugsDePremissas).toEqual(['xg_combinado_alto', 'ritmo_alto']);
    expect(separados.motivosSemDrilldown).toEqual([
      { t: 'Time apostado com desfalque de titular importante', pontos: undefined },
    ]);
  });

  it('não inventa lado: o contrário de uma premissa a favor não aparece em contra', () => {
    // O backend é a autoridade sobre o grupo. A função não deriva nada do slug,
    // então uma premissa do lado oposto só apareceria se o backend a mandasse.
    const favor = separarMotivosDoContrato([
      { id: 'xg_combinado_alto', tipo: 'premissa' },
      { id: 'ritmo_alto', tipo: 'premissa' },
    ]);
    const contra = separarMotivosDoContrato([
      { id: 'ambos_vazam', tipo: 'premissa' },
      { id: 'historico_over', tipo: 'premissa' },
    ]);

    expect(favor.slugsDePremissas).toEqual(['xg_combinado_alto', 'ritmo_alto']);
    expect(contra.slugsDePremissas).toEqual(['ambos_vazam', 'historico_over']);
    expect(contra.slugsDePremissas).not.toContain('defesas_firmes');
    expect(contra.slugsDePremissas).not.toContain('xg_baixo_combinado');
  });

  it.each([
    {
      mercado: 'Resultado',
      favor: [{ id: 'mando', tipo: 'premissa' }],
      contra: [
        { id: 'forma', tipo: 'premissa' },
        { id: 'desfalque_proprio', tipo: 'penalidade', texto: 'A escalação reduz a confiança' },
      ],
    },
    {
      mercado: 'Handicap asiático',
      favor: [{ id: 'mando_forte', tipo: 'premissa' }],
      contra: [
        { id: 'supremacia', tipo: 'premissa' },
        { id: 'desfalque_proprio', tipo: 'penalidade' },
      ],
    },
    {
      mercado: 'Ambos marcam',
      favor: [{ id: 'defesa_forte', tipo: 'premissa' }],
      contra: [
        { id: 'ataque_trava', tipo: 'premissa' },
        { id: 'desfalque_adversario', tipo: 'penalidade', texto: 'Desfalque relevante do outro lado' },
      ],
    },
    {
      mercado: 'Dupla chance',
      favor: [{ id: 'equilibrio_defensivo', tipo: 'premissa' }],
      contra: [
        { id: 'lado_coberto_forte', tipo: 'premissa' },
        { id: 'desfalque_proprio', tipo: 'penalidade', texto: 'Time apostado desfalcado' },
      ],
    },
  ] as const)('$mercado mantém favor, contra e penalidade separados', ({ favor, contra }) => {
    const motivosFavor = separarMotivosDoContrato(favor);
    const motivosContra = separarMotivosDoContrato(contra);

    expect(motivosFavor.slugsDePremissas).toEqual([favor[0].id]);
    expect(motivosContra.slugsDePremissas).toContain(contra[0].id);
    expect(motivosContra.slugsDePremissas.length + motivosContra.motivosSemDrilldown.length)
      .toBe(contra.length);
  });
});
