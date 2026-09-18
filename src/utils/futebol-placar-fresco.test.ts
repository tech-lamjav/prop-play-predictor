import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================================
// O placar fresco (migration 152)
// ============================================================================
// Existem DUAS fontes para o mesmo fato: `public.fixtures`, do coletor, que
// pergunta o placar de 2 em 2 minutos enquanto o jogo rola; e
// `futebol.fact_fixtures`, o espelho, que recarrega no ritmo do pipeline de
// analytics. Todas as RPCs do painel leem o espelho.
//
// Medido em 18/09/2026: o painel dizia "10 de 19 sem resultado" no dia anterior,
// e as 19 vinham de dois jogos presos em `2H` onze horas depois do apito final.
// Um deles já estava `FT` com 1×1 na tabela do coletor.
//
// ⚠️ ESTE TESTE LÊ TEXTO. O repositório não tem harness de SQL — sem pgtap, sem
// supabase/tests, e o CI não sobe banco. O COMPORTAMENTO foi conferido à mão num
// Postgres 16 descartável, com quatro jogos montados: encerrado com placar,
// em andamento, adiado e encerrado sem placar. Só o primeiro voltou.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');
const SQL = readFileSync(
  resolve(RAIZ, 'supabase/migrations/20260918120000_152_futebol_placar_fresco.sql'),
  'utf8',
);
// O espelho em `docs/futebol-prod-deploy.sql` NÃO é conferido aqui:
// `shape-file-futebol.test.ts` já exige que toda função criada por migration
// exista lá, e repetir a asserção daria a impressão de duas redes onde há uma.

/** Sem comentários: nenhuma guarda pode passar por causa de prosa. */
const semComentario = SQL.split(/\r?\n/)
  .filter((l) => !l.trimStart().startsWith('--'))
  .join('\n');

describe('a consulta do placar fresco', () => {
  it('só devolve jogo ENCERRADO', () => {
    // Jogo em andamento não pode entrar: o painel não liquida com placar
    // parcial, e devolver 2H com 1×0 convidaria exatamente isso.
    expect(semComentario).toContain("f.status_short in ('FT', 'AET', 'PEN')");
  });

  it('e só com placar nos dois lados', () => {
    // Encerrado sem placar existe — jogo anulado, dado que não chegou — e
    // liquidar com nulo viraria green ou red inventado.
    expect(semComentario).toContain('f.goals_home is not null');
    expect(semComentario).toContain('f.goals_away is not null');
  });

  it('lê a tabela do coletor, e não o espelho', () => {
    // O ponto inteiro da função. Se alguém trocar a fonte para
    // `futebol.fact_fixtures`, ela deixa de resolver o que foi criada para
    // resolver e ninguém percebe, porque o resultado continua "certo".
    expect(semComentario).toContain('from public.fixtures f');
    expect(semComentario).not.toContain('futebol.fact_fixtures');
  });

  it('nasce fechada para anon e authenticated, e depois recebe o grant', () => {
    // Função nova nasce executável por PUBLIC no Postgres (issue #408). Esta é
    // chamada pelo navegador do assinante, então o grant é explícito e vem
    // DEPOIS do revoke — na ordem inversa, o revoke apagaria o grant.
    //
    // `funcao-sem-revoke.test.ts` já exige que exista revoke; o que ele não olha
    // é a ORDEM, e é a ordem que decide se a função fica aberta ou fechada.
    const revoke = semComentario.indexOf(
      'revoke execute on function public.get_futebol_placar_fresco(bigint[]) from anon, authenticated',
    );
    const grant = semComentario.indexOf(
      'grant execute on function public.get_futebol_placar_fresco(bigint[]) to anon, authenticated, service_role',
    );
    expect(revoke).toBeGreaterThan(-1);
    expect(grant).toBeGreaterThan(revoke);
  });
});
