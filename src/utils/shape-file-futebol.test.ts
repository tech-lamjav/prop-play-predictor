import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================================================
// A guarda que impede o shape file de divergir de novo (issue #250)
// ============================================================================
// `docs/futebol-prod-deploy.sql` é o DDL aplicado à mão para provisionar um
// ambiente novo. Ele divergiu do banco ONZE vezes seguidas (migrations 091 a
// 103) e nenhuma vez apareceu sozinha:
//
//   · o `check_schema_parity` do sync confere TABELA, nunca FUNÇÃO
//   · as RPCs respondem 200 em produção, porque lá elas existem
//   · só quebra quando alguém provisiona ambiente novo, que é raro
//
// Em 18/08 o buraco era de oito funções inteiras (agenda, catálogo, premissas,
// números e histórico do jogo), todas chamadas pelo front. Foi achado por code
// review, e review não é processo: da próxima vez ninguém olha.
//
// Este teste é a comparação que faltava, e roda em ARQUIVO contra ARQUIVO, sem
// precisar de banco: toda função que alguma migration cria tem que existir no
// shape file, e toda função declarada lá tem que ter grant. É exatamente o par
// de erros que já aconteceu.
//
// Não substitui conferir contra o banco vivo (a seção 8 do .sql tem as
// consultas para isso). Pega o caso comum, que é esquecer no PR.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');
const SHAPE = resolve(RAIZ, 'docs/futebol-prod-deploy.sql');
const MIGRACOES = resolve(RAIZ, 'supabase/migrations');

/** Nomes de função criados por um SQL qualquer (migration ou shape file). */
function funcoesCriadas(sql: string): Set<string> {
  const nomes = new Set<string>();
  // Pega `create function`, `create or replace function` e o que aparece
  // dentro de bloco DO como string ('...create or replace function public.x').
  const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)/gi;
  for (const m of sql.matchAll(re)) nomes.add(m[1]);
  return nomes;
}

/** Nomes de função que aparecem num `grant execute on function`. */
function funcoesComGrant(sql: string): Set<string> {
  const nomes = new Set<string>();
  const re = /grant\s+execute\s+on\s+function\s+(?:public\.)?(\w+)/gi;
  for (const m of sql.matchAll(re)) nomes.add(m[1]);
  return nomes;
}

const shape = readFileSync(SHAPE, 'utf8');

describe('shape file de futebol (docs/futebol-prod-deploy.sql)', () => {
  // O BOM já quebrou este arquivo uma vez: ele é colado no psql, e um BOM na
  // frente vira `syntax error at or near "ï"`. Entrou por `Set-Content -Encoding
  // UTF8` do PowerShell, que escreve BOM por padrão.
  it('não tem BOM, que quebraria o psql na primeira linha', () => {
    const bruto = readFileSync(SHAPE);
    expect(bruto[0]).not.toBe(0xef);
  });

  it('toda função declarada tem grant de execução', () => {
    const criadas = funcoesCriadas(shape);
    const comGrant = funcoesComGrant(shape);
    const semGrant = [...criadas].filter((f) => !comGrant.has(f)).sort();
    expect(semGrant, `sem grant: ${semGrant.join(', ')}`).toEqual([]);
  });

  it('não tem grant para função que ele não declara', () => {
    const criadas = funcoesCriadas(shape);
    const comGrant = funcoesComGrant(shape);
    const orfaos = [...comGrant].filter((f) => !criadas.has(f)).sort();
    expect(orfaos, `grant sem função: ${orfaos.join(', ')}`).toEqual([]);
  });

  // O coração da #250: migration cria função, ninguém traz pro shape file, e a
  // provisão nova sobe sem ela.
  it('tem toda função de futebol que alguma migration cria', () => {
    const arquivos = readdirSync(MIGRACOES).filter((f) => f.endsWith('.sql'));
    const doBanco = new Map<string, string>(); // função -> migration que criou

    for (const arq of arquivos) {
      const sql = readFileSync(resolve(MIGRACOES, arq), 'utf8');
      for (const nome of funcoesCriadas(sql)) {
        // Só as de futebol: este shape file não cobre NBA, bolão nem auth.
        if (!/futebol/i.test(nome)) continue;
        if (!doBanco.has(nome)) doBanco.set(nome, arq);
      }
    }

    const noShape = funcoesCriadas(shape);
    const faltando = [...doBanco.entries()]
      .filter(([nome]) => !noShape.has(nome))
      .map(([nome, arq]) => `${nome} (criada em ${arq})`)
      .sort();

    expect(
      faltando,
      `Estas funções existem em migration e NÃO estão no shape file:\n  ${faltando.join('\n  ')}\n` +
        `Traga-as para docs/futebol-prod-deploy.sql (com grant) no mesmo PR da migration.`
    ).toEqual([]);
  });
});
