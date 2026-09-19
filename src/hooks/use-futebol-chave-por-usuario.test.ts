import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================================================
// Toda consulta fechada por acesso leva QUEM PERGUNTOU na chave de cache
// ============================================================================
// A guarda `futebol_acesso_do_chamador` devolve a linha com as colunas nulas
// para quem não tem acesso. O React Query não sabe disso: para ele a resposta é
// função da chave, e só. Sem o usuário na chave, a cópia buscada deslogado
// segue servindo depois do login, até o cache vencer.
//
// Foi o que aconteceu em homologação em 19/09/2026, e apareceu de duas formas
// que pareciam defeitos diferentes:
//
//   · a lista continuava cadeada com o chip dizendo "Teste · 48h", porque
//     `get_futebol_access` ERA keyed por usuário e o board não era;
//   · o destaque do dia trocava os motivos ("A favor", com a lista de razões)
//     pela frase de preço, porque `get_futebol_fixture_reason_contract` também
//     é fechada e também não era keyed — e sem motivos a tela cai no texto
//     alternativo, que parece "copy antiga" e não é.
//
// O modo de falha que sobra é o PRÓXIMO: alguém fecha mais uma RPC por acesso,
// escreve o gancho dela, e esquece a chave. O sintoma não é erro — é dado velho
// servido com cara de novo, que é a pior espécie.
//
// Este teste liga as duas listas em arquivo contra arquivo, sem banco: o que o
// `futebol-guarda-acesso.test.ts` classifica como DE VALOR tem que aparecer com
// `quem` na `queryKey` do gancho correspondente. É o mesmo formato, e de
// propósito — mexer na classificação lá obriga a passar por aqui.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');
const GUARDA = readFileSync(resolve(RAIZ, 'src/utils/futebol-guarda-acesso.test.ts'), 'utf8');
const GANCHOS = readFileSync(resolve(RAIZ, 'src/hooks/use-futebol-data.ts'), 'utf8');

/** A lista `DE_VALOR` do teste da guarda, lida de lá para não virar segunda cópia. */
function rpcsDeValor(): string[] {
  const bloco = GUARDA.match(/const DE_VALOR = \[([\s\S]*?)\n\];/);
  if (!bloco) throw new Error('não achei o DE_VALOR em futebol-guarda-acesso.test.ts');
  return [...bloco[1].matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
}

/**
 * De que RPC cada gancho vive, e qual `queryKey` ele usa.
 *
 * Lido do arquivo em vez de declarado aqui: uma tabela escrita à mão seria a
 * terceira cópia da mesma verdade, e a que ninguém lembraria de atualizar.
 */
function chaveDoGancho(rpc: string): { achou: boolean; temUsuario: boolean } {
  // O serviço nomeia o método logo acima da chamada da RPC; o gancho usa o
  // mesmo nome de chave. Procuramos a RPC no serviço, pegamos o método, e o
  // ligamos ao gancho pela chamada `futebolDataService.<metodo>`.
  const servico = readFileSync(resolve(RAIZ, 'src/services/futebol-data.service.ts'), 'utf8');
  const m = servico.match(new RegExp(`async (\\w+)\\([^)]*\\)[\\s\\S]{0,400}?rpc\\('${rpc}'`));
  if (!m) return { achou: false, temUsuario: false };
  const metodo = m[1];
  const uso = GANCHOS.match(
    new RegExp(`queryKey: (\\[[^\\]]*\\])[\\s\\S]{0,200}?futebolDataService\\.${metodo}\\b`),
  );
  if (!uso) return { achou: false, temUsuario: false };
  return { achou: true, temUsuario: /\bquem\b/.test(uso[1]) };
}

describe('as consultas fechadas por acesso', () => {
  const deValor = rpcsDeValor();

  it('a lista canônica foi encontrada e não está vazia', () => {
    expect(deValor.length).toBeGreaterThan(5);
    expect(deValor).toContain('get_futebol_value_board');
    expect(deValor).toContain('get_futebol_fixture_reason_contract');
  });

  it.each(deValor)('%s leva o usuário na chave, se tiver gancho no front', (rpc) => {
    const { achou, temUsuario } = chaveDoGancho(rpc);
    // Nem toda RPC fechada tem gancho: `get_futebol_fixture_quotes` responde 500
    // hoje e ninguém a consome. Não ter gancho não é defeito; ter gancho sem o
    // usuário na chave é.
    if (!achou) return;
    expect(temUsuario, `${rpc}: a queryKey do gancho não inclui \`quem\``).toBe(true);
  });
});
