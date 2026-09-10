import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================================================
// O agregado de apostas não pode virar uma porta para a tabela `bets`
// ============================================================================
// A ficha precisa saber SE a pessoa registrou aposta, e quando foi a última.
// Nunca o que ela apostou: valor, odd, descrição e o texto cru que ela mandou
// no Telegram continuam fechados.
//
// A função roda como dono do banco, então o portão vai DENTRO dela. Sem essa
// linha, qualquer pessoa logada conta as apostas de qualquer outra só sabendo o
// identificador — e nada na tela denunciaria isso.
// ============================================================================

const ARQUIVO = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260910180000_124_crm_resumo_de_apostas.sql'),
  'utf8',
).replace(/\r\n/g, '\n');

/** Sem os comentários: o bloco de aviso do topo fala das colunas que a função não devolve. */
const MIGRATION = ARQUIVO.replace(/--.*$/gm, '');

describe('crm_resumo_de_apostas', () => {
  it('roda como dono do banco, com search_path travado', () => {
    expect(MIGRATION).toMatch(/create or replace function public\.crm_resumo_de_apostas/);
    expect(MIGRATION).toMatch(/security definer/);
    expect(MIGRATION).toMatch(/set search_path to ''/);
  });

  it('confere o portão por dentro', () => {
    // Definer sem esta linha é uma porta aberta com aparência de função interna.
    expect(MIGRATION).toMatch(/if not public\.eh_socio\(\)/);
    expect(MIGRATION).toMatch(/raise exception/);
  });

  it('a assinatura promete só o agregado', () => {
    const assinatura = MIGRATION.match(/returns table \(([^)]*)\)/);
    expect(assinatura).not.toBeNull();
    expect(assinatura![1]).toMatch(/total bigint/);
    expect(assinatura![1]).toMatch(/ultima timestamptz/);
  });

  it('e o CORPO não toca em nenhuma coluna de aposta', () => {
    // Olhar só a assinatura era guarda de papel: `max(stake_amount) as
    // maior_valor` passava batido, porque o nome proibido não aparece no
    // `returns table`. É no corpo que a coluna é lida, então é o corpo que
    // precisa ser lido.
    const corpo = MIGRATION.slice(MIGRATION.indexOf('return query'));
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
    // O que ele PODE ler: a contagem e a data. Uma lista de proibidos sozinha
    // envelhece — coluna nova em `bets` nasce fora dela.
    expect(corpo).toMatch(/count\(\*\)/);
    expect(corpo).toMatch(/max\(b\.bet_date\)/);
    expect(corpo.match(/\bb\.[a-z_]+/g)).toEqual(['b.bet_date', 'b.user_id']);
  });

  it('não é executável por quem não está logado', () => {
    // Função nova nasce executável por PUBLIC, e PUBLIC inclui o anon. O portão
    // interno barraria assim mesmo, mas um grant que sugere restrição sem ter é
    // pior que nenhum.
    expect(MIGRATION).toMatch(/revoke execute on function public\.crm_resumo_de_apostas\(uuid\) from public/);
  });

  it('não abre a tabela de apostas com política nenhuma', () => {
    // O caminho fácil e errado: uma policy de select em `bets` para o sócio.
    // Ela liberaria a aposta linha a linha, que é o que esta função evita.
    expect(MIGRATION).not.toMatch(/create policy[^;]*on public\.bets/i);
  });
});
