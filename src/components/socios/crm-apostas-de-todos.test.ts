import { describe, expect, it } from 'vitest';
import { comando, lerMigration } from './crm-migration-de-teste';

// ============================================================================
// A versão em lote não pode ser mais frouxa que a de uma pessoa
// ============================================================================
// A função da migration 124 é cuidadosa: portão por dentro, e só o agregado.
// Uma segunda função com o mesmo propósito é onde o cuidado costuma se perder,
// porque quem escreve já "sabe" que a primeira estava certa.
// ============================================================================

const MIGRATION = lerMigration('20260911180000_127_crm_apostas_de_todos.sql');
const FUNCAO = comando(
  MIGRATION,
  /create or replace function public\.crm_apostas_de_todos/,
  '$function$;',
);

describe('crm_apostas_de_todos', () => {
  it('existe e roda como dono do banco, com search_path travado', () => {
    expect(FUNCAO).not.toBeNull();
    expect(FUNCAO).toMatch(/security definer/);
    expect(FUNCAO).toMatch(/set search_path to ''/);
  });

  it('confere o portão por dentro', () => {
    expect(FUNCAO).toMatch(/if not public\.eh_socio\(\)/);
    expect(FUNCAO).toMatch(/raise exception/);
  });

  it('não é executável por quem não está logado', () => {
    expect(MIGRATION).toMatch(/revoke execute on function public\.crm_apostas_de_todos/);
  });

  it('o corpo não toca em nenhuma coluna de aposta', () => {
    const corpo = FUNCAO ?? '';
    for (const proibida of [
      'stake_amount',
      'odds',
      'bet_description',
      'match_description',
      'potential_return',
      'raw_input',
      'processed_data',
    ]) {
      expect(corpo).not.toContain(proibida);
    }
    // Conjunto, e não lista: a mesma coluna aparece no select, no where e no
    // group by, e contar ocorrência tornaria o guarda frágil sem ganhar nada.
    // A lista de proibidos sozinha envelhece — coluna nova em `bets` nasce
    // fora dela —, então o que vale é dizer o que PODE ser tocado.
    const tocadas = new Set(corpo.match(/\bb\.[a-z_]+/g) ?? []);
    expect([...tocadas].sort()).toEqual(['b.bet_date', 'b.user_id']);
  });
});
