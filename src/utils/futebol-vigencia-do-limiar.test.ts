import { readdirSync, readFileSync } from 'node:fs';
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
// e o banco não sobe no CI. É a mesma natureza das outras guardas de SQL daqui
// (`shape-file-futebol`, `funcao-sem-revoke`, `placar-contrato-rpc`): elas leem
// o texto das migrations.
//
// A prova de comportamento está no cabeçalho da migration, como consulta para
// rodar depois de aplicar — foi assim que a 144 e a 145 fizeram.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');
const MIGRACOES = resolve(RAIZ, 'supabase/migrations');

/** Todas as migrations concatenadas, sem `\r`. */
const TODAS = readdirSync(MIGRACOES)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(resolve(MIGRACOES, f), 'utf8').replace(/\r\n/g, '\n'))
  .join('\n');

const SHAPE = readFileSync(resolve(RAIZ, 'docs/futebol-prod-deploy.sql'), 'utf8').replace(
  /\r\n/g,
  '\n',
);

/** O corpo da função de gatilho, sem comentários, em um dos dois arquivos. */
function corpoDoGatilho(sql: string): string {
  const inicio = sql.indexOf('create or replace function public.futebol_limiar_valor_vigencia()');
  expect(inicio, 'a função do gatilho não existe neste arquivo').toBeGreaterThan(-1);
  const fim = sql.indexOf('$function$;', inicio);
  return sql.slice(inicio, fim).replace(/--.*$/gm, '');
}

describe('o gatilho da vigência do limiar', () => {
  // O aceite 1 da issue: `update ... set limiar = x` sozinho atualiza a data.
  it('dispara no update do limiar, e carimba a vigência', () => {
    const corpo = corpoDoGatilho(TODAS);

    expect(corpo).toContain('new.vigente_desde := now()');
    expect(TODAS).toContain(
      'before update of limiar on public.futebol_limiar_valor',
    );
  });

  // O aceite 2: `update ... set limiar = x, vigente_desde = y` respeita o `y`.
  //
  // O `is not distinct from` é o que distingue "não veio na instrução" de "veio
  // com valor". Sem ele o gatilho atropelaria a data explícita, e datar uma
  // mudança de propósito — uma correção retroativa combinada — deixaria de ser
  // possível.
  it('respeita a vigência quando ela vem explícita', () => {
    const corpo = corpoDoGatilho(TODAS);

    expect(corpo).toContain('new.vigente_desde is not distinct from old.vigente_desde');
  });

  // Reescrever o MESMO limiar não é mudança de régua. Se carimbasse, empurraria
  // a data de corte para frente e esconderia linhas passadas — o próprio defeito
  // entrando por outra porta. Reaplicar a semente da 144 é exatamente o comando
  // que alguém roda duas vezes.
  it('não carimba quando o valor do limiar não muda', () => {
    const corpo = corpoDoGatilho(TODAS);

    expect(corpo).toContain('new.limiar is not distinct from old.limiar');
  });

  // A guarda do shape file cobra a FUNÇÃO; o gatilho em si ela não vê. E um
  // ambiente provisionado com a função e sem o gatilho tem a regra instalada e
  // desligada, que é pior do que não ter — parece protegido.
  it('o shape file traz a função E o gatilho', () => {
    expect(corpoDoGatilho(SHAPE)).toContain('new.vigente_desde := now()');
    expect(SHAPE).toContain('create trigger futebol_limiar_valor_vigencia');
    expect(SHAPE).toContain('before update of limiar on public.futebol_limiar_valor');
  });

  // O aceite 4: o aviso sobre o fallback no cabeçalho da migration. O limiar
  // mora no banco, mas as duas cópias compiladas carregam o valor embutido para
  // quando ele não responde — mudar um sem os outros faz o escuro aplicar o
  // corte velho, e isso é release, não UPDATE.
  it('o cabeçalho avisa que o fallback do código não vem junto', () => {
    const migration = readFileSync(
      resolve(MIGRACOES, '20260917140000_147_futebol_vigencia_do_limiar.sql'),
      'utf8',
    );
    const cabecalho = migration.slice(0, migration.indexOf('create or replace function'));

    expect(cabecalho).toContain('CORTE_FALLBACK');
    expect(cabecalho).toContain('src/utils/futebol-corte-de-valor.ts');
    expect(cabecalho).toContain('supabase/functions/shared/corte-de-valor.ts');
  });
});
