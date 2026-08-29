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

  it('descarta a decomposição da nota antiga, que o contrato antigo ainda manda', () => {
    // Durante a janela da virada, a RPC antiga continua devolvendo os
    // componentes de preço. Eles não são premissa nem penalidade de contexto, e
    // exibi-los seria mostrar a fórmula antiga que a spec #301 tirou da tela.
    const separados = separarMotivosDoContrato([
      { id: 'xg_combinado_alto', tipo: 'premissa' },
      { id: 'valor_de_mercado', tipo: 'componente_score', texto: 'A cotação oferece valor', pontos: 16 },
      { id: 'corroboracao', tipo: 'componente_score', texto: 'Movimento de mercado confirma a leitura', pontos: 8 },
    ]);

    expect(separados.slugsDePremissas).toEqual(['xg_combinado_alto']);
    expect(separados.motivosSemDrilldown).toEqual([]);
  });

  it('descarta os avisos de odd que o contrato antigo despeja em Contra', () => {
    // Eles chegam como penalidade, não como componente do Score, então o
    // primeiro filtro não os pegava: a aba Contra continuaria mostrando "odd
    // alta de zebra" logo abaixo de um título que promete só cenário de jogo.
    // Eles seguem visíveis no rodapé do painel, como leitura da cotação.
    const separados = separarMotivosDoContrato([
      { id: 'defesas_vazaveis', tipo: 'premissa' },
      { id: 'desfalque_proprio', tipo: 'penalidade', texto: 'Time apostado desfalcado' },
      { id: 'aviso_1', tipo: 'penalidade', texto: 'Odd alta de zebra, entra com cautela' },
      { id: 'aviso_2', tipo: 'penalidade', texto: 'Poucas casas cotando esse mercado' },
    ]);

    expect(separados.slugsDePremissas).toEqual(['defesas_vazaveis']);
    expect(separados.motivosSemDrilldown).toEqual([
      { t: 'Time apostado desfalcado', pontos: undefined },
    ]);
  });

  it('descarta as premissas de preço que o contrato antigo lista como aplicáveis', () => {
    const separados = separarMotivosDoContrato([
      { id: 'xg_combinado_alto', tipo: 'premissa' },
      { id: 'linha_subindo', tipo: 'premissa' },
      { id: 'modelo_api_concorda', tipo: 'premissa' },
    ]);

    expect(separados.slugsDePremissas).toEqual(['xg_combinado_alto']);
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
