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
});
