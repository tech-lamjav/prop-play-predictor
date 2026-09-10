import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ETAPAS, TIPOS_DE_ANOTACAO } from './crm-vocabulario';

// ============================================================================
// A fundação do CRM: o portão é o banco, não a tela
// ============================================================================
// A rota escondida é conveniência. O que separa o sócio de todo mundo é a
// política de linha da tabela de usuários, e é ela que estes testes guardam —
// nenhum deles roda SQL, todos leem a migration como texto.
//
// Guardar texto de migration parece frágil, e é: renomear a função quebra o
// teste. Mas o que está do outro lado é pior. Uma política mal escrita aqui
// vaza o telefone de toda a base para qualquer visitante logado, e isso não
// aparece em nenhuma tela — o painel continua bonito enquanto a fuga acontece.
// ============================================================================

const ARQUIVO = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260910120000_123_crm_fundacao.sql'),
  'utf8',
).replace(/\r\n/g, '\n');

/**
 * A migration sem os comentários.
 *
 * O bloco de aviso do topo escreve de propósito a política ERRADA, a que
 * recursa, para explicar por que ela não pode ser usada. Um guarda que lê o
 * arquivo inteiro acusa esse exemplo e fica vermelho com a migration certa —
 * foi o que aconteceu na primeira execução.
 */
const MIGRATION = ARQUIVO.replace(/--.*$/gm, '');

/**
 * Um comando isolado, do começo até o `;` que o fecha.
 *
 * Ler o arquivo inteiro é o erro que quase passou aqui: `toMatch(/security
 * definer/)` sobre a migration toda fica verde se QUALQUER outra função tiver
 * a palavra, mesmo com a `eh_socio` já sem ela. A asserção precisa cair dentro
 * da declaração que ela diz guardar.
 */
const comando = (inicio: RegExp, fim = ';') => {
  const i = MIGRATION.search(inicio);
  if (i < 0) return null;
  const f = MIGRATION.indexOf(fim, i);
  return f < 0 ? null : MIGRATION.slice(i, f + fim.length);
};

describe('a função que responde quem é sócio', () => {
  // O corpo termina no fechamento do `$function$`, não no primeiro `;` — há
  // ponto e vírgula dentro do SQL da função.
  const FUNCAO = comando(/create or replace function public\.eh_socio\(\)/, '$function$;');

  it('existe', () => {
    expect(FUNCAO).not.toBeNull();
  });

  it('é security definer, para ler a coluna por fora da própria política', () => {
    // Sem isto a política sobre `users` consultaria `users` e recursaria: o
    // Postgres derruba a leitura da tabela INTEIRA, inclusive a de quem não é
    // sócio, e o site todo para de saber quem está logado.
    expect(FUNCAO).toMatch(/security definer/);
  });

  it('é stable e tem search_path travado', () => {
    // `stable` porque o planejador chama a função uma vez por consulta em vez
    // de uma vez por linha — numa varredura da base inteira isso é a diferença
    // entre uma consulta e milhares.
    expect(FUNCAO).toMatch(/\bstable\b/);
    // search_path vazio é o padrão das outras funções definer do repositório:
    // sem ele, um schema plantado no caminho sequestra a função que roda como
    // dono do banco.
    expect(FUNCAO).toMatch(/set search_path to ''/);
  });

  it('nunca deixa a resposta ser nula', () => {
    // Um usuário sem linha na tabela devolveria null, e `using (null)` não
    // libera nada — o sócio simplesmente não veria o painel, sem erro nenhum
    // para explicar por quê.
    expect(FUNCAO).toMatch(/coalesce\(/);
  });
});

describe('a política que abre a base para o sócio', () => {
  const POLITICA = comando(/create policy [^;]*?on public\.users\b/i);

  it('existe e pergunta pela função', () => {
    expect(POLITICA).not.toBeNull();
    expect(POLITICA).toMatch(/public\.eh_socio\(\)/);
  });

  it('não consulta a tabela de usuários por dentro', () => {
    // A recursão de novo, agora do lado da política. As três formas abaixo
    // recursam igual, e a primeira versão deste guarda só pegava a terceira:
    // `FROM users` em maiúsculas, `from users` sem schema — que é justamente o
    // estilo da migration 005 — e `from public.users`.
    expect(POLITICA).not.toMatch(/\bfrom\s+(public\.)?users\b/i);
  });

  it('é só de leitura: o painel não escreve na tabela de usuários', () => {
    expect(POLITICA).toMatch(/for select/);
    expect(POLITICA).not.toMatch(/for (all|update|insert|delete)/);
  });

  it('não mexe na política que já existia', () => {
    // A regra "cada um enxerga a própria linha", da migration 005, é o que
    // segura a base para quem NÃO é sócio. Políticas somam, então a nova
    // convive com ela — mas um `drop` ou `alter` aqui derrubaria a antiga sem
    // nenhum sintoma visível, e todo mundo passaria a enxergar tudo.
    expect(MIGRATION).not.toMatch(/drop policy[^;]*own data/i);
    expect(MIGRATION).not.toMatch(/alter policy[^;]*on public\.users/i);
  });
});

describe('as três tabelas do CRM', () => {
  const TABELAS = ['crm_etapa', 'crm_etapa_evento', 'crm_anotacao'];

  // String.raw porque a contrabarra tem de chegar inteira à regex: num template
  // comum, `\.` é escape desconhecido e vira ponto solto, que casa com
  // QUALQUER caractere. O teste passaria igual, guardando outra coisa.
  const regexDaTabela = (padrao: string, tabela: string, flags = '') =>
    new RegExp(padrao.replace('§', tabela), flags);

  it.each(TABELAS)('%s tem RLS ligada', (tabela) => {
    expect(MIGRATION).toMatch(
      regexDaTabela(String.raw`alter table public\.§ enable row level security`, tabela),
    );
  });

  it.each(TABELAS)('%s só é acessível por sócio', (tabela) => {
    // Ligar RLS sem policy tranca todo mundo, inclusive o sócio; ligar com
    // policy frouxa abre para o assinante comum. Os dois erros são silenciosos.
    //
    // O limite de palavra no fim do nome não é detalhe: sem ele, `crm_etapa`
    // casaria também com a política de `crm_etapa_evento`, e essa tabela
    // ficaria sem guarda nenhuma com o teste verde.
    const politicas =
      MIGRATION.match(
        regexDaTabela(String.raw`create policy [^;]*?on public\.§\b[^;]*;`, tabela, 'g'),
      ) ?? [];
    expect(politicas.length).toBeGreaterThan(0);
    for (const politica of politicas) expect(politica).toMatch(/public\.eh_socio\(\)/);
  });

  it('o histórico de etapa é append-only na política, não só no comentário', () => {
    // Este era o buraco: a tabela dizia "nunca sofre update nem delete" num
    // comentário, e a política era `for all`. Qualquer sócio podia reescrever o
    // passado, e o histórico deixava de ser histórico — vira um campo com data.
    const politicas =
      MIGRATION.match(
        regexDaTabela(String.raw`create policy [^;]*?on public\.§\b[^;]*;`, 'crm_etapa_evento', 'g'),
      ) ?? [];
    expect(politicas.length).toBeGreaterThan(0);
    for (const politica of politicas) {
      expect(politica).toMatch(/for (select|insert)\b/);
      expect(politica).not.toMatch(/for (all|update|delete)\b/);
    }
  });
});

describe('o vocabulário não pode divergir entre o banco e a tela', () => {
  it('a restrição de etapa lista exatamente as seis etapas do glossário', () => {
    const restricao = MIGRATION.match(/etapa text not null check \(etapa in \(([^)]*)\)\)/);
    expect(restricao).not.toBeNull();
    const noBanco = [...restricao![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(noBanco).toEqual([...ETAPAS]);
  });

  it('a restrição de tipo lista exatamente os três tipos de anotação', () => {
    const restricao = MIGRATION.match(/tipo text not null check \(tipo in \(([^)]*)\)\)/);
    expect(restricao).not.toBeNull();
    const noBanco = [...restricao![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(noBanco).toEqual([...TIPOS_DE_ANOTACAO]);
  });
});
