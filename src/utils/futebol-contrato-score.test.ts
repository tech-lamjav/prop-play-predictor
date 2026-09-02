import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================================================
// Contrato das RPCs no Score de contexto (issue #304, spec #301)
// ============================================================================
// A virada troca as três RPCs de uma vez e o contrato de motivos junto. O risco
// que este teste cobre é o da virada PARCIAL: uma das quatro ficar para trás e
// o painel continuar recebendo componente de preço, ou o histórico deixar de
// espelhar o board e quebrar o tipo que as duas telas compartilham.
//
// Roda em ARQUIVO contra ARQUIVO, sem banco, no mesmo espírito do
// shape-file-futebol.test.ts: compara a migration da janela com o shape file de
// provisionamento, que precisam declarar exatamente as mesmas assinaturas.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');
const SHAPE = readFileSync(resolve(RAIZ, 'docs/futebol-prod-deploy.sql'), 'utf8');
const MIGRATION = readFileSync(
  resolve(RAIZ, 'supabase/migrations/20260829120000_112_futebol_score_contexto_contrato.sql'),
  'utf8',
);

/**
 * Colunas do `returns table(...)` da ÚLTIMA definição de uma função no SQL.
 * A última é a que vale: o shape file e as migrations empilham redefinições, e
 * o banco fica com a de baixo.
 */
function colunasDoRetorno(sql: string, funcao: string): string[] {
  const assinatura = new RegExp(
    `function\\s+(?:public\\.)?${funcao}\\s*\\([^)]*\\)\\s*\\r?\\n?\\s*returns\\s+table\\s*\\(`,
    'gi',
  );
  let inicio = -1;
  for (const m of sql.matchAll(assinatura)) inicio = m.index! + m[0].length;
  if (inicio < 0) throw new Error(`returns table de ${funcao} não encontrado`);

  let profundidade = 1;
  let fim = inicio;
  while (fim < sql.length && profundidade > 0) {
    if (sql[fim] === '(') profundidade++;
    else if (sql[fim] === ')') profundidade--;
    if (profundidade > 0) fim++;
  }

  return sql
    .slice(inicio, fim)
    .split(',')
    .map((coluna) => coluna.trim().split(/\s+/)[0])
    .filter(Boolean);
}

const FUNCOES_DO_SCORE = [
  'get_futebol_value_board',
  'get_futebol_value_history',
  'get_futebol_fixture_value',
  'get_futebol_fixture_reason_contract',
] as const;

describe('contrato das RPCs no Score de contexto', () => {
  describe.each([
    ['migration da janela', MIGRATION],
    ['shape file de produção', SHAPE],
  ])('%s', (_nome, sql) => {
    it('board e histórico expõem exatamente a mesma forma', () => {
      // As duas telas compartilham FutebolValueBoardRow. Uma coluna a mais de um
      // lado quebra a outra tela sem erro de compilação.
      expect(colunasDoRetorno(sql, 'get_futebol_value_history')).toEqual(
        colunasDoRetorno(sql, 'get_futebol_value_board'),
      );
    });

    it('board e histórico não expõem os componentes de preço', () => {
      for (const funcao of ['get_futebol_value_board', 'get_futebol_value_history']) {
        const colunas = colunasDoRetorno(sql, funcao);
        expect(colunas, funcao).not.toContain('pts_valor');
        expect(colunas, funcao).not.toContain('pts_corroboracao');
      }
    });

    it('o detalhe não expõe componentes de preço nem a penalidade global de odd', () => {
      const colunas = colunasDoRetorno(sql, 'get_futebol_fixture_value');
      expect(colunas).not.toContain('pts_valor');
      expect(colunas).not.toContain('pts_corroboracao');
      expect(colunas).not.toContain('penalidades_globais_pts');
    });

    it('board, histórico e detalhe expõem score_versao', () => {
      for (const funcao of [
        'get_futebol_value_board',
        'get_futebol_value_history',
        'get_futebol_fixture_value',
      ]) {
        expect(colunasDoRetorno(sql, funcao), funcao).toContain('score_versao');
      }
    });

    it('board e histórico preservam as premissas e a penalidade de contexto', () => {
      // O que sai é preço; o contexto continua sendo publicado.
      for (const funcao of ['get_futebol_value_board', 'get_futebol_value_history']) {
        const colunas = colunasDoRetorno(sql, funcao);
        expect(colunas, funcao).toContain('pts_premissas');
        expect(colunas, funcao).toContain('penalidades');
        expect(colunas, funcao).toContain('score');
        expect(colunas, funcao).toContain('faixa');
        expect(colunas, funcao).toContain('edge');
      }
    });

    it('o contrato de motivos não devolve a soma de componentes do Score', () => {
      expect(colunasDoRetorno(sql, 'get_futebol_fixture_reason_contract')).not.toContain(
        'componentes_score',
      );
    });
  });

  it('migration e shape file declaram a mesma assinatura nas quatro funções', () => {
    for (const funcao of FUNCOES_DO_SCORE) {
      expect(colunasDoRetorno(SHAPE, funcao), funcao).toEqual(colunasDoRetorno(MIGRATION, funcao));
    }
  });

  it('a migration remove e recria as três RPCs juntas, em vez de substituir', () => {
    // O retorno tabular muda, então `create or replace` falharia com
    // "cannot change return type of existing function".
    for (const funcao of FUNCOES_DO_SCORE) {
      expect(MIGRATION, funcao).toMatch(
        new RegExp(`drop\\s+function\\s+if\\s+exists\\s+public\\.${funcao}\\s*\\(`, 'i'),
      );
    }
  });

  it('o shape file também derruba antes de recriar, senão não reaplica', () => {
    // O shape file é colado num ambiente que JÁ tem as funções antigas. Como as
    // quatro assinaturas mudaram, `create or replace` sozinho aborta com
    // "cannot change return type of existing function".
    for (const funcao of FUNCOES_DO_SCORE) {
      expect(SHAPE, funcao).toMatch(
        new RegExp(`drop\\s+function\\s+if\\s+exists\\s+public\\.${funcao}\\s*\\(`, 'i'),
      );
    }
  });

  it('a migration dá grant de execução nas quatro funções', () => {
    for (const funcao of FUNCOES_DO_SCORE) {
      expect(MIGRATION, funcao).toMatch(
        new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${funcao}\\s*\\(`, 'i'),
      );
    }
  });

  it('score_versao entra nas duas tabelas do mart sem admitir nulo', () => {
    for (const tabela of ['fact_value_opportunities', 'fact_value_opportunities_hist']) {
      expect(MIGRATION, tabela).toMatch(
        new RegExp(
          `alter\\s+table\\s+futebol\\.${tabela}[\\s\\S]{0,200}?score_versao[\\s\\S]{0,120}?not\\s+null`,
          'i',
        ),
      );
    }
  });
});

describe('motivos sem preço, corroboração e penalidade de odd', () => {
  /** Corpo da última definição do contrato de motivos. */
  function corpoDoContratoDeMotivos(sql: string): string {
    // Ancorado em `create`: sem isso o `grant execute on function ...` do fim do
    // arquivo virava a última ocorrência, o recorte saía vazio e toda asserção
    // de negativa passava à toa.
    const marca =
      /create\s+(?:or\s+replace\s+)?function\s+public\.get_futebol_fixture_reason_contract\s*\(/gi;
    let inicio = -1;
    for (const m of sql.matchAll(marca)) inicio = m.index!;
    expect(inicio, 'não achei a criação do contrato de motivos').toBeGreaterThan(-1);
    const abre = sql.indexOf('$function$', inicio);
    const fim = sql.indexOf('$function$', abre + '$function$'.length);
    expect(fim, 'o corpo do contrato de motivos não fecha').toBeGreaterThan(abre);
    // Sem os comentários: as asserções abaixo são sobre o SQL que roda, e um
    // comentário explicando o que FOI removido citaria justamente o termo
    // proibido e derrubaria o teste.
    return sql.slice(inicio, fim).replace(/--[^\n]*/g, '');
  }

  it.each([
    ['migration da janela', MIGRATION],
    ['shape file de produção', SHAPE],
  ])('%s: nem valor de mercado, nem corroboração, nem aviso de odd viram razão', (_nome, sql) => {
    const corpo = corpoDoContratoDeMotivos(sql);
    expect(corpo).not.toMatch(/valor_de_mercado/i);
    expect(corpo).not.toMatch(/corroboracao/i);
    expect(corpo).not.toMatch(/pts_valor/i);
    // Os avisos de odd continuam disponíveis no detalhe como informação; o que
    // acaba é entrarem na lista de Contra como se fossem premissa.
    expect(corpo).not.toMatch(/aviso_/i);
  });

  it.each([
    ['migration da janela', MIGRATION],
    ['shape file de produção', SHAPE],
  ])('%s: movimento de linha sai das premissas aplicáveis de gols', (_nome, sql) => {
    const corpo = corpoDoContratoDeMotivos(sql);
    expect(corpo).not.toMatch(/linha_subindo/i);
    expect(corpo).not.toMatch(/linha_descendo/i);
  });

  it.each([
    ['migration da janela', MIGRATION],
    ['shape file de produção', SHAPE],
  ])('%s: os cinco mercados declaram o lado aplicável, sem cópia genérica', (_nome, sql) => {
    const corpo = corpoDoContratoDeMotivos(sql);

    expect(corpo).toMatch(
      /when 'goals_over_under' then case v\.outcome[\s\S]*when 'Over' then array\[[\s\S]*'xg_combinado_alto'[\s\S]*'ritmo_alto'/,
    );
    expect(corpo).toMatch(
      /when 'match_winner' then case v\.outcome[\s\S]*when 'Home' then array\[[\s\S]*when 'Away' then array\[/,
    );
    expect(corpo).toMatch(
      /when 'asian_handicap' then case[\s\S]*v\.outcome = 'Home' and v\.line_value < 0[\s\S]*v\.outcome = 'Away' and v\.line_value > 0/,
    );
    expect(corpo).toMatch(/when 'btts' then case v\.outcome[\s\S]*when 'Yes' then array\[[\s\S]*when 'No' then array\[/);
    expect(corpo).toContain("when 'double_chance' then array[");

    // A seleção é direta das acesas e apagadas do lado analisado. A cópia
    // genérica de contra derivaria o lado do slug, que é justo o que não pode.
    expect(corpo).toContain('from unnest(b.acesas) slug');
    expect(corpo).toContain('from unnest(b.apagadas) slug');
    expect(corpo).not.toContain("futebol_copy('contra'");
    expect(corpo).toContain("where slug <> 'favorito_irregular'");
  });

  it.each([
    ['migration da janela', MIGRATION],
    ['shape file de produção', SHAPE],
  ])('%s: A favor não depende mais de o preço ter somado pontos', (_nome, sql) => {
    // O gate `pts_premissas > 0` era herança da nota antiga. Mantê-lo deixaria
    // A favor vazio numa linha legacy publicada pelo preço, entre esta
    // migration e a troca do mart.
    expect(corpoDoContratoDeMotivos(sql)).not.toMatch(/pts_premissas\s*>\s*0/);
  });

  const SLUGS_DE_PRECO = [
    'corroboracao_ambos',
    'modelo_api_concorda',
    'linha_sharp_confirma',
    'linha_subindo',
    'linha_descendo',
  ];

  it('a migration regera a tabela de copy inteira, em vez de deixar buracos na ordem', () => {
    // Apagar só as cinco linhas deixaria a numeração com furos, e é a ordem que
    // decide qual evidência a DM do Telegram mostra.
    expect(MIGRATION).toMatch(/delete\s+from\s+public\.futebol_premissa_copy\s*;/i);
    expect(MIGRATION).toMatch(/insert\s+into\s+public\.futebol_premissa_copy/i);
  });

  it.each([
    ['migration da janela', () => MIGRATION],
    ['shape file de produção', () => SHAPE],
  ])('%s: não semeia preço, movimento nem concordância de modelo como evidência', (_nome, sql) => {
    for (const slug of SLUGS_DE_PRECO) {
      expect(sql(), slug).not.toMatch(new RegExp(`\\('evidencia',\\s*'\\w+',\\s*'${slug}'`, 'i'));
    }
  });

  it('o shape file não descreve as premissas de movimento de linha, que o mart não publica mais', () => {
    // O AE #103 removeu linha_subindo e linha_descendo do modelo de gols, e as
    // colunas caíram no Postgres. O shape file continuou declarando as duas, e
    // esse tipo de divergência não aparece sozinha: o parity check do sync
    // aborta quando existe coluna no Postgres que não existe no BigQuery, e foi
    // o que derrubou o sync por três dias, cerca de 72 execuções (issue #302).
    for (const slug of ['linha_subindo', 'linha_descendo']) {
      expect(SHAPE, slug).not.toContain(slug);
    }
  });
});
