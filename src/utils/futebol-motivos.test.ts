import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { separarMotivosDoContrato } from './futebol-motivos';

describe('separarMotivosDoContrato', () => {
  it('mantém na migration a seleção direta das premissas de Over, sem usar a cópia genérica de contra', () => {
    const migration = readFileSync(resolve(__dirname, '../../supabase/migrations/20260826103000_108_futebol_motivos_gols.sql'), 'utf8');

    expect(migration).toMatch(/when 'Over' then array\[[\s\S]*'xg_combinado_alto'[\s\S]*'ritmo_alto'[\s\S]*'linha_subindo'/);
    expect(migration).toContain('from unnest(b.acesas) slug');
    expect(migration).toContain('from unnest(b.apagadas) slug');
    expect(migration).not.toContain("futebol_copy('contra'");
  });

  it('mantém Juventude × CRB · Mais de 1,5 no agrupamento devolvido pelo backend', () => {
    const contratoJuventudeCrbOver15 = {
      score: 46,
      componentes_score: [
        { id: 'premissas', texto: 'Premissas', pontos: 22 },
        { id: 'valor_de_mercado', texto: 'Valor de mercado', pontos: 16 },
        { id: 'corroboracao', texto: 'Corroboração', pontos: 8 },
      ],
      favor: [
      { id: 'xg_combinado_alto', tipo: 'premissa' },
      { id: 'ritmo_alto', tipo: 'premissa' },
      { id: 'linha_subindo', tipo: 'premissa' },
        { id: 'valor_de_mercado', tipo: 'componente_score', texto: 'A cotação oferece valor', pontos: 16 },
        { id: 'corroboracao', tipo: 'componente_score', texto: 'Movimento de mercado confirma a leitura', pontos: 8 },
      ],
      contra: [
      { id: 'defesas_vazaveis', tipo: 'premissa' },
      { id: 'ataque_combinado', tipo: 'premissa' },
        { id: 'ambos_vazam', tipo: 'premissa' },
        { id: 'historico_over', tipo: 'premissa' },
      ],
    } as const;
    const favor = separarMotivosDoContrato(contratoJuventudeCrbOver15.favor);
    const contra = separarMotivosDoContrato(contratoJuventudeCrbOver15.contra);

    expect(favor.slugsDePremissas).toEqual(['xg_combinado_alto', 'ritmo_alto', 'linha_subindo']);
    expect(favor.motivosSemDrilldown).toEqual([
      { t: 'A cotação oferece valor', pontos: 16 },
      { t: 'Movimento de mercado confirma a leitura', pontos: 8 },
    ]);
    expect(contra.slugsDePremissas).toEqual(['defesas_vazaveis', 'ataque_combinado', 'ambos_vazam', 'historico_over']);
    expect(contra.slugsDePremissas).not.toContain('defesas_firmes');
    expect(contra.slugsDePremissas).not.toContain('xg_baixo_combinado');
    expect(contratoJuventudeCrbOver15.componentes_score.reduce((total, componente) => total + componente.pontos, 0))
      .toBe(contratoJuventudeCrbOver15.score);
  });

  it('declara o lado aplicável dos outros quatro mercados no contrato do backend', () => {
    const migration = readFileSync(resolve(__dirname, '../../supabase/migrations/20260826113000_109_futebol_motivos_outros_mercados.sql'), 'utf8');

    expect(migration).toMatch(/when 'match_winner' then case v\.outcome[\s\S]*when 'Home' then array\[[\s\S]*when 'Away' then array\[[\s\S]*else array\[\]::text\[\]/);
    expect(migration).toMatch(/when 'asian_handicap' then case[\s\S]*v\.outcome = 'Home' and v\.line_value < 0[\s\S]*v\.outcome = 'Away' and v\.line_value > 0[\s\S]*when v\.line_value <> 0 then array\[/);
    expect(migration).toMatch(/when 'btts' then case v\.outcome[\s\S]*when 'Yes' then array\[[\s\S]*when 'No' then array\[/);
    expect(migration).toContain("when 'double_chance' then array[");
    expect(migration).toContain("where slug <> 'favorito_irregular'");
    expect(migration).not.toContain("where v.market = 'goals_over_under'");
  });

  it.each([
    {
      mercado: 'Resultado',
      favor: [{ id: 'mando', tipo: 'premissa' }],
      contra: [
        { id: 'forma', tipo: 'premissa' },
        { id: 'aviso_1', tipo: 'penalidade', texto: 'A escalação reduz a confiança' },
      ],
    },
    {
      mercado: 'Handicap asiático',
      favor: [{ id: 'mando_forte', tipo: 'premissa' }],
      contra: [
        { id: 'supremacia', tipo: 'premissa' },
        { id: 'handicap_alto', tipo: 'penalidade' },
      ],
    },
    {
      mercado: 'Ambos marcam',
      favor: [{ id: 'defesa_forte', tipo: 'premissa' }],
      contra: [
        { id: 'ataque_trava', tipo: 'premissa' },
        { id: 'aviso_1', tipo: 'penalidade', texto: 'Dado de mercado pede cautela' },
      ],
    },
    {
      mercado: 'Dupla chance',
      favor: [{ id: 'equilibrio_defensivo', tipo: 'premissa' }],
      contra: [
        { id: 'lado_coberto_forte', tipo: 'premissa' },
        { id: 'aviso_1', tipo: 'penalidade', texto: 'Mercado com liquidez reduzida' },
      ],
    },
  ] as const)('$mercado mantém favor, contra e alerta separados', ({ favor, contra }) => {
    const motivosFavor = separarMotivosDoContrato(favor);
    const motivosContra = separarMotivosDoContrato(contra);

    expect(motivosFavor.slugsDePremissas).toEqual([favor[0].id]);
    expect(motivosContra.slugsDePremissas).toContain(contra[0].id);
    expect(motivosContra.slugsDePremissas.length + motivosContra.motivosSemDrilldown.length)
      .toBe(contra.length);
  });
});
