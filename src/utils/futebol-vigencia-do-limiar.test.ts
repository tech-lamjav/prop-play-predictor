import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================================
// Mudar o limiar do corte não reescreve o passado (#435)
// ============================================================================
// `futebol_limiar_valor` tem duas colunas que precisam andar juntas: `limiar` e
// `vigente_desde`. A segunda faz o corte valer de uma data em diante, e é ela
// que impede o histórico de esconder linha que o assinante já viu.
//
// Nada obrigava as duas a mudarem juntas: um `update` só no limiar passava, e
// reescrevia o passado nos dois sentidos — apertar o corte some com linha que
// foi exibida, afrouxar traz de volta linha que nunca esteve na tela. A regra
// estava escrita num comentário da migration 144, e comentário não segura
// UPDATE.
//
// ⚠️ O QUE ESTE TESTE PROVA, E O QUE NÃO PROVA.
// Ele prova que o SQL DIZ a coisa certa. Não prova que o Postgres FAZ, porque
// este repositório não tem harness de SQL — não há `supabase/tests`, nem pgtap,
// e o CI não sobe banco. É a mesma natureza das outras guardas de SQL daqui:
// `shape-file-futebol.test.ts`, `funcao-sem-revoke.test.ts` e
// `src/components/placar/placar-contrato-rpc.test.ts` também leem texto.
//
// A prova de comportamento está no cabeçalho da migration, como consulta para
// rodar depois de aplicar — foi assim que a 144 e a 145 fizeram.
//
// ⚠️ POR QUE O CORPO INTEIRO, E NÃO TRECHOS.
// A primeira versão deste arquivo afirmava três substrings soltas. Uma
// implementação INVERTIDA — carimbar quando a vigência veio explícita e sair
// quando não veio — contém exatamente as mesmas três strings e passava verde.
// Trocar a ordem dos dois `if`, ou devolver `old` no primeiro, também passava.
// Substring não vê direção nem ordem; o corpo inteiro vê.
//
// O preço é o teste quebrar se alguém só reformatar o SQL. Para um gatilho de
// dez linhas cuja função é impedir que o passado seja reescrito em silêncio, o
// preço é barato: quem reformatar atualiza a expectativa de propósito. O espaço
// é normalizado e os comentários saem, então indentação e explicação ficam
// livres.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');
const MIGRATION = resolve(
  RAIZ,
  'supabase/migrations/20260917140000_147_futebol_vigencia_do_limiar.sql',
);
const SHAPE = resolve(RAIZ, 'docs/futebol-prod-deploy.sql');

const ABRE = 'create or replace function public.futebol_limiar_valor_vigencia()';

/**
 * O corpo da função de gatilho: sem comentários, com espaço normalizado.
 *
 * Lê o arquivo NOMEADO, e não todas as migrations concatenadas: com a
 * concatenação, uma migration futura que substituísse esta função deixaria o
 * teste verde sobre a versão velha, que é o contrário de uma guarda.
 */
function corpoDoGatilho(sql: string, onde: string): string {
  const inicio = sql.indexOf(ABRE);
  expect(inicio, `a função do gatilho não existe em ${onde}`).toBeGreaterThan(-1);
  const fim = sql.indexOf('$function$;', inicio);
  expect(fim, `a função do gatilho não termina em ${onde}`).toBeGreaterThan(inicio);
  return sql
    .slice(inicio, fim)
    .replace(/--.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// A regra inteira, em uma linha. Quem mudar o gatilho muda isto junto — e é
// exatamente essa a intenção.
//
//   1. limiar igual  -> sai sem carimbar (`update of` dispara por MENÇÃO, e
//      reescrever o mesmo número não é mudança de régua);
//   2. vigência não veio explícita -> carimba `now()`;
//   3. veio explícita -> o valor dado vence.
const CORPO_ESPERADO = [
  `${ABRE} returns trigger`,
  "language plpgsql set search_path to '' as $function$ begin",
  'if new.limiar is not distinct from old.limiar then return new; end if;',
  'if new.vigente_desde is not distinct from old.vigente_desde then',
  'new.vigente_desde := now(); end if;',
  'return new; end;',
].join(' ');

describe('o gatilho da vigência do limiar', () => {
  // Cobre os aceites 1 e 2 da issue de uma vez: a direção dos dois `if` É o
  // comportamento. Um corpo diferente reprova, inclusive o invertido.
  it('o corpo da função é exatamente a regra combinada', () => {
    expect(corpoDoGatilho(readFileSync(MIGRATION, 'utf8'), 'na migration 147')).toBe(
      CORPO_ESPERADO,
    );
  });

  it('dispara no update do limiar, e só nele', () => {
    const migration = readFileSync(MIGRATION, 'utf8');

    expect(migration).toMatch(
      /create\s+trigger\s+futebol_limiar_valor_vigencia\s+before\s+update\s+of\s+limiar\s+on\s+public\.futebol_limiar_valor/i,
    );
  });

  // A guarda do shape file cobra a função e o gatilho por NOME. O corpo, não:
  // um ambiente novo podia nascer com a versão errada da regra.
  it('o shape file traz a MESMA regra, e não outra', () => {
    expect(corpoDoGatilho(readFileSync(SHAPE, 'utf8'), 'no shape file')).toBe(CORPO_ESPERADO);
  });

  // O aceite 4: o aviso sobre o fallback no cabeçalho da migration. O limiar
  // mora no banco, mas as duas cópias compiladas carregam o valor embutido para
  // quando ele não responde — mudar um sem os outros faz o escuro aplicar o
  // corte velho, e isso é release, não UPDATE.
  it('o cabeçalho avisa que o fallback do código não vem junto', () => {
    const migration = readFileSync(MIGRATION, 'utf8');
    const cabecalho = migration.slice(0, migration.indexOf(ABRE));

    expect(cabecalho).toContain('CORTE_FALLBACK');
    expect(cabecalho).toContain('src/utils/futebol-corte-de-valor.ts');
    expect(cabecalho).toContain('supabase/functions/shared/corte-de-valor.ts');
  });

  // O limite que não tem conserto em gatilho de linha: o plpgsql não distingue
  // coluna ausente do SET de coluna presente com o mesmo valor. Quem não souber
  // disso vai datar uma mudança repetindo a data gravada, e ela será
  // sobrescrita. Está declarado, e o teste garante que continue declarado.
  it('o cabeçalho declara o limite da vigência repetida', () => {
    const cabecalho = readFileSync(MIGRATION, 'utf8');

    expect(cabecalho).toContain('LIMITE CONHECIDO');
    expect(cabecalho).toContain('vigência DIFERENTE da que está gravada');
  });
});
