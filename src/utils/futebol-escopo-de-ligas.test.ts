import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================================================
// A lista fixa de ligas é fallback, nunca escopo (issue #323)
// ============================================================================
// `ALL_COMPETITIONS` são oito slugs escritos à mão. Usá-la para pedir o
// calendário deixa pick publicado em liga de fora sem fixture — e sem fixture
// não há horário, placar nem liquidação: a linha aparece na tela e é incapaz de
// fechar. Medido em produção em 02/09/2026: 5 dos 23 picks dos últimos 90 dias
// estavam em ligas de fora (Primeira Liga, Ligue 1, Champions, Bundesliga).
//
// Quem sabe montar escopo é `fixtureScopesFor`, que lê o catálogo do mart e
// resolve a temporada pela janela. A lista fixa sobrevive lá dentro, como
// fallback enquanto a consulta não chegou.
//
// Este teste é de ARQUIVO, no mesmo espírito do shape-file-futebol.test.ts,
// porque o defeito não é comportamento de função — é fiação. A Oportunidades
// foi corrigida e a home ficou para trás com o padrão idêntico, e nenhum teste
// de unidade pegou isso. A guarda vale para a próxima tela também.
// ============================================================================

const PAGINAS = resolve(__dirname, '../pages');

/** `ALL_COMPETITIONS.map(...)`, em qualquer espaçamento ou quebra de linha. */
const USADA_COMO_ESCOPO = /ALL_COMPETITIONS\s*\.\s*map\s*\(/;

function paginasDoFutebol(): { nome: string; fonte: string }[] {
  return readdirSync(PAGINAS)
    .filter((f) => f.startsWith('Futebol') && f.endsWith('.tsx'))
    .map((nome) => ({ nome, fonte: readFileSync(resolve(PAGINAS, nome), 'utf8') }));
}

describe('escopo de calendário das telas de futebol', () => {
  it('nenhuma página monta escopo a partir da lista fixa', () => {
    const infratoras = paginasDoFutebol()
      .filter((p) => USADA_COMO_ESCOPO.test(p.fonte))
      .map((p) => p.nome);

    expect(infratoras).toEqual([]);
  });

  it('toda página que pede calendário multi-liga passa pelo catálogo', () => {
    // `useFutebolFixturesMulti` é o consumo de escopo. Quem chama precisa ter
    // derivado esse escopo de `fixtureScopesFor`, não de uma lista própria.
    //
    // Exige a CHAMADA, com o parêntese: a FutebolJogos cita o nome do hook num
    // comentário, explicando o que ela deixou de usar, e casar com a prosa
    // acusaria uma página que não pede calendário nenhum.
    const CHAMA_O_HOOK = /useFutebolFixturesMulti\s*\(/;
    const semCatalogo = paginasDoFutebol()
      .filter((p) => CHAMA_O_HOOK.test(p.fonte))
      .filter((p) => !p.fonte.includes('fixtureScopesFor'))
      .map((p) => p.nome);

    expect(semCatalogo).toEqual([]);
  });
});
