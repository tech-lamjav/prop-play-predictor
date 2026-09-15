import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================================
// O placar chega numa resposta só
// ============================================================================
// Em 14/09/2026 o placar subiu para produção e não mostrou dado nenhum. A RPC
// devolvia uma linha por oportunidade, a API corta resposta de várias linhas em
// 1.000, e o período padrão tinha 3.302. Cortada, a lista trazia só os jogos
// mais distantes — todos por jogar —, e a tela dizia que nada tinha liquidado.
// Em staging passou, porque lá o limite é 5.000.
//
// Nenhum teste de tela pega isso: eles montam a lista na mão. Este guarda o
// contrato — o front chama a função que devolve UM jsonb, e essa função existe
// numa migration devolvendo jsonb.
// ============================================================================

const RAIZ = resolve(__dirname, '../../..');
const FUNCAO = 'get_futebol_placar_da_metodologia';

describe('o contrato da RPC do placar', () => {
  it('o front busca o placar pela função que devolve uma resposta só', () => {
    const servico = readFileSync(resolve(RAIZ, 'src/services/futebol-data.service.ts'), 'utf8');

    expect(servico).toContain(`rpc('${FUNCAO}'`);
    // A de linhas continua no banco, e é justamente por isso que voltar a
    // chamá-la seria fácil — e voltaria a trazer só mil linhas.
    expect(servico).not.toContain("rpc('get_futebol_oportunidades_publicadas'");
  });

  it('e essa função devolve jsonb, que não passa pelo corte de linhas da API', () => {
    const pasta = resolve(RAIZ, 'supabase/migrations');
    const definicoes = readdirSync(pasta)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => readFileSync(resolve(pasta, f), 'utf8'))
      .filter((sql) => new RegExp(`function\\s+public\\.${FUNCAO}\\s*\\(`, 'i').test(sql));

    expect(definicoes.length).toBeGreaterThan(0);
    // A última definição é a que vale no banco.
    expect(definicoes[definicoes.length - 1]).toMatch(
      new RegExp(`${FUNCAO}\\s*\\([^)]*\\)\\s*returns\\s+jsonb`, 'i'),
    );
  });
});
