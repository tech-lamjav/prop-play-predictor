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

const RAIZ_SRC = resolve(__dirname, '..');

/**
 * A lista fixa sendo percorrida para virar escopo. Não é só `.map`: qualquer
 * iteração serve para montar a lista de pares liga/temporada, e prender a
 * guarda a um método deixaria `flatMap`, `forEach` e spread passarem.
 *
 * `fixtureScopesFor` usa `ALL_COMPETITIONS.map` por dentro, e é o único lugar
 * onde isso é legítimo — por isso a varredura pula o próprio módulo.
 */
const USADA_COMO_ESCOPO = /ALL_COMPETITIONS\s*(\.\s*(map|flatMap|forEach|reduce|filter)\s*\(|\])|\.\.\.\s*ALL_COMPETITIONS|of\s+ALL_COMPETITIONS/;

/** A CHAMADA de `fixtureScopesFor`, não a menção do nome num comentário. */
const CHAMA_O_CATALOGO = /fixtureScopesFor\s*\(/;

/** A CHAMADA do hook de calendário multi-liga. */
const PEDE_CALENDARIO = /useFutebolFixturesMulti\s*\(/;

/** Onde `fixtureScopesFor` mora — o único lugar que pode usar a lista fixa. */
const DONO_DA_LISTA = 'futebol-competitions.ts';

/**
 * O código sem os comentários.
 *
 * Sem isto a guarda lê prosa: o serviço documenta "useFutebolFixturesMulti (uma
 * por liga, temporada inteira)" e o parêntese da explicação vira uma chamada aos
 * olhos do regex. Guarda que acusa comentário ensina a apagar comentário, que é
 * o oposto do que este repositório quer.
 */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/**
 * Todo `.ts`/`.tsx` de `src`, não só as páginas que começam com "Futebol".
 * Restringir a guarda ao nome do arquivo era prometer mais do que ela cobria:
 * um componente, ou uma página chamada `PainelFutebol.tsx`, escapava.
 *
 * Fora ficam os dois donos: o módulo que exporta a lista fixa e o que exporta o
 * hook. Neles as duas coisas são definição, não uso.
 */
function fontesDoApp(dir = RAIZ_SRC): { nome: string; fonte: string }[] {
  const saida: { nome: string; fonte: string }[] = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = resolve(dir, entrada.name);
    if (entrada.isDirectory()) {
      saida.push(...fontesDoApp(caminho));
      continue;
    }
    if (!/\.tsx?$/.test(entrada.name) || /\.test\.tsx?$/.test(entrada.name)) continue;
    if (entrada.name === DONO_DA_LISTA) continue;
    const fonte = semComentarios(readFileSync(caminho, 'utf8'));
    if (/export\s+function\s+useFutebolFixturesMulti/.test(fonte)) continue;
    saida.push({ nome: entrada.name, fonte });
  }
  return saida;
}

describe('escopo de calendário das telas de futebol', () => {
  it('ninguém fora do módulo dono percorre a lista fixa', () => {
    const infratoras = fontesDoApp()
      .filter((p) => USADA_COMO_ESCOPO.test(p.fonte))
      .map((p) => p.nome);

    expect(infratoras).toEqual([]);
  });

  it('quem pede calendário multi-liga passa pelo catálogo', () => {
    // `useFutebolFixturesMulti` é o consumo de escopo. Quem chama precisa ter
    // CHAMADO `fixtureScopesFor` — as duas checagens exigem o parêntese, e não
    // a presença do nome: a FutebolJogos cita `useFutebolFixturesMulti` num
    // comentário explicando o que deixou de usar, e casar com a prosa acusaria
    // uma página que não pede calendário nenhum. A assimetria inversa era pior:
    // bastaria citar `fixtureScopesFor` num comentário para a guarda calar.
    const semCatalogo = fontesDoApp()
      .filter((p) => PEDE_CALENDARIO.test(p.fonte))
      .filter((p) => !CHAMA_O_CATALOGO.test(p.fonte))
      .map((p) => p.nome);

    expect(semCatalogo).toEqual([]);
  });

  it('a varredura enxerga as páginas que deveria — a guarda não é vazia', () => {
    // Sem isto, um erro de caminho ou de filtro deixaria a lista de arquivos
    // vazia e os dois testes acima passariam sem olhar nada.
    const nomes = fontesDoApp().map((p) => p.nome);
    expect(nomes).toContain('FutebolHoje.tsx');
    expect(nomes).toContain('FutebolOportunidades.tsx');
    expect(nomes.length).toBeGreaterThan(50);
  });
});
