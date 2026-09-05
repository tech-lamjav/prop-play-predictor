import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { copyDeServing, premissaDe, rotuloPremissa, type LinhaCopy } from './futebol-premissas';

// ============================================================================
// A guarda que impede a copy da premissa de divergir de novo (issue #272)
// ============================================================================
// O texto de cada premissa existia em DUAS fontes independentes: o catálogo deste
// diretório, que serve a tela, e uma cascata de `case when` dentro de três RPCs,
// que serve a DM do Telegram. Medido em 20/08/2026: de 36 premissas presentes nas
// duas, 27 tinham TEXTO DIFERENTE, e ninguém tinha visto, porque:
//
//   · a tela e a DM são lidas por pessoas diferentes, em momentos diferentes
//   · o SQL não é lido por ninguém depois do PR que o escreveu
//   · a cascata era a TERCEIRA cópia verbatim de si mesma, então divergir era o
//     comportamento esperado do sistema, não um acidente
//
// Agora o catálogo é a fonte e a migration semeia uma tabela de apoio a partir
// dele. Esta guarda compara os dois em ARQUIVO contra ARQUIVO, sem banco, e roda
// no mesmo `vitest` do resto. Mesmo padrão da guarda do shape file, que nasceu do
// mesmo modo de falha: divergência silenciosa que só aparece quando alguém lê.
//
// O que ela cobra vem dos três defeitos medidos:
//   1. TEXTO   -> as 27 divergências
//   2. ORDEM   -> a DM mostrava a evidência mais fraca (12.736 linhas)
//   3. AUSÊNCIA-> a `favorito_irregular` aparecia na DM e não na tela (4.268)
//   4. TRAVESSÃO -> seis frases visíveis violavam a régua de copy
// ============================================================================

const RAIZ = resolve(__dirname, '../..');
// A migration que SEMEIA a tabela hoje. A 106 criou a mecânica e semeou a
// primeira vez; a 112 regerou no Score de contexto; a 120 renomeou
// `ataques_fracos` e a 121 tirou "mando" dos rótulos. É sempre a ÚLTIMA que
// precisa bater com o
// catálogo — apontar para uma anterior cobraria dela uma decisão que não
// existia quando foi escrita.
const MIGRATION = resolve(
  RAIZ,
  'supabase/migrations/20260905220000_121_futebol_rotulo_do_mando.sql',
);
const SHAPE = resolve(RAIZ, 'docs/futebol-prod-deploy.sql');
const RPCS = ['get_futebol_fixture_value', 'get_futebol_value_board', 'get_futebol_value_history'];

/** As linhas do `insert` da semente, na ordem em que aparecem no arquivo. */
function semente(sql: string): LinhaCopy[] {
  const i = sql.indexOf('insert into public.futebol_premissa_copy');
  expect(i, 'não achei o insert da semente').toBeGreaterThan(-1);
  const fim = sql.indexOf(';', i);
  const corpo = sql.slice(i, fim);
  const re = /\('(\w+)',\s*'(\w+)',\s*'(\w+)',\s*'(\w+)',\s*(\d+),\s*'((?:[^']|'')*)'\)/g;
  return [...corpo.matchAll(re)].map((m) => ({
    tipo: m[1] as LinhaCopy['tipo'],
    market: m[2],
    slug: m[3],
    mando: m[4] as LinhaCopy['mando'],
    ordem: Number(m[5]),
    texto: m[6].replace(/''/g, "'"),
  }));
}

/** O corpo de uma função dentro de um .sql, do `create` ao `$function$` final. */
function corpoDaFuncao(sql: string, nome: string): string {
  // A migration da virada usa `create` puro, porque as RPCs são derrubadas
  // antes: o retorno tabular mudou e `create or replace` recusaria.
  const re = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${nome}\\(`, 'i');
  const m = sql.match(re);
  expect(m, `não achei ${nome}`).not.toBeNull();
  const i = m!.index!;
  const j = sql.indexOf('\n$function$', i);
  return sql.slice(i, j);
}

const chave = (l: LinhaCopy) => `${l.tipo}/${l.market}/${l.slug}/${l.mando}`;

describe('a copy da serving é a copy do catálogo', () => {
  const esperado = copyDeServing();

  for (const [nome, arquivo] of [
    ['migration da semente', MIGRATION],
    ['shape file', SHAPE],
  ] as const) {
    describe(nome, () => {
      const sql = readFileSync(arquivo, 'utf8');
      const semeado = semente(sql);

      it('semeia exatamente as linhas do catálogo, na mesma ordem', () => {
        // Comparar a lista inteira de uma vez faz o vitest mostrar o diff completo,
        // que é o que torna o conserto óbvio sem investigação.
        expect(semeado).toEqual(esperado);
      });

      it('não semeia premissa que a tela esconde', () => {
        // Redundante com o teste acima e proposital: era ESTE o defeito que chegou ao
        // usuário, então ele merece falhar com nome próprio.
        const ocultas = semeado.filter((l) => l.slug === 'favorito_irregular');
        expect(ocultas.map(chave)).toEqual([]);
      });

      it('não usa travessão em copy visível', () => {
        const comTravessao = semeado.filter((l) => l.texto.includes('—') || l.texto.includes('–'));
        expect(comTravessao.map((l) => `${chave(l)} :: ${l.texto}`)).toEqual([]);
      });

    });
  }

  // ⚠️ Esta checagem NÃO roda sobre a migration da semente, e a distinção é o
  // que permite as duas coisas evoluírem separadas.
  //
  // Semear a copy e definir as RPCs são movimentos independentes: a 112 fez os
  // dois no mesmo arquivo, a 120 só ressemeia. Exigir as RPCs de toda migration
  // que ressemeia obrigaria a recopiá-las sem motivo, e recopiar função é como a
  // cascata voltaria.
  //
  // O shape file é o lugar certo para cobrar: ele carrega a definição VIVA de
  // toda função, e a guarda do shape file (`shape-file-futebol.test.ts`) já
  // garante que nenhuma fique de fora dele.
  it('não deixa cascata de rótulo voltar para dentro das RPCs', () => {
    // A cascata é o defeito de origem: enquanto ela existir, alguém vai editar o
    // texto lá e a tabela de apoio fica para trás.
    const sql = readFileSync(SHAPE, 'utf8');
    for (const rpc of RPCS) {
      const corpo = corpoDaFuncao(sql, rpc);
      expect(corpo, `${rpc} voltou a montar array de rótulo à mão`).not.toContain('array_remove(array[');
      expect(corpo, `${rpc} não traduz pela tabela de apoio`).toContain('public.futebol_copy(');
    }
  });

  it('a ordem da evidência é decrescente por peso, e o handicap prova o caso', () => {
    // O caso concreto que abriu a issue: no azarão, a premissa de 10 pontos tem que
    // vir ANTES da de 3, porque a DM mostra só o primeiro item.
    const ah = esperado
      .filter((l) => l.tipo === 'evidencia' && l.market === 'asian_handicap' && l.mando === 'any')
      .sort((a, b) => a.ordem - b.ordem)
      .map((l) => l.slug);
    expect(ah.indexOf('defesa_fora_solida')).toBeLessThan(ah.indexOf('raramente_perde_por_2'));
  });

  it('a frase do azarão não promete mais uma condição da aposta', () => {
    // "Raramente perde por 2 gols ou mais" só responde a pergunta em +1 e +1,5. Num
    // +0,5 a aposta morre em qualquer derrota. A frase nova descreve o time.
    const linha = esperado.find(
      (l) => l.tipo === 'evidencia' && l.market === 'asian_handicap' && l.slug === 'raramente_perde_por_2',
    );
    expect(linha?.texto).toBe('Quando perde, perde apertado');
  });

  it('descreve premissa apagada como ausência de sinal, sem afirmar o oposto', () => {
    const casos = [
      ['match_winner', 'forma', null],
      ['goals_over_under', 'ataque_combinado', null],
      ['asian_handicap', 'defesa_fora_solida', 'home'],
      ['btts', 'ambos_marcam', null],
      ['double_chance', 'lado_coberto_forte', null],
    ] as const;

    for (const [mercado, slug, lado] of casos) {
      const premissa = premissaDe(mercado, slug);
      expect(premissa, `${mercado}:${slug} existe no catálogo`).not.toBeNull();
      expect(rotuloPremissa(premissa!, lado, true)).toMatch(/não entr(?:ou|aram) como sinal a favor/i);
    }

    const forma = premissaDe('match_winner', 'forma')!;
    const mando = premissaDe('match_winner', 'mando')!;
    expect(rotuloPremissa(forma, 'home', true)).not.toBe('Não vem em boa fase');
    expect(rotuloPremissa(mando, 'home', true)).not.toBe('Não manda bem em casa');
  });
});
