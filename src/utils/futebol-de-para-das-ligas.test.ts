import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================================================
// O de-para slug → id da liga não pode divergir entre os dois donos (#505)
// ============================================================================
// O mesmo fato — qual id da API-Football corresponde a qual slug do mart — mora
// em DOIS arquivos, e o cabeçalho da edge function diz isso em prosa: "O de-para
// mora aqui e em COMPETITION_API_IDS; liga nova entra nos dois". Prosa não
// segura ninguém: entrar num e esquecer o outro faz o espelho subir o brasão com
// um nome de arquivo que a tela nunca vai pedir, e o defeito aparece como
// "ícone de troféu no lugar do escudo", longe da causa.
//
// ⚠️ OS DOIS MAPAS NÃO SÃO IGUAIS, E NÃO DEVEM SER. A Copa do Mundo (id 1) está
// no do front e FORA do espelho de propósito: o CDN responde 200 e entrega um
// escudo cinza de "sem imagem", que em tela fica pior que o troféu. Exigir
// igualdade reprovaria essa decisão deliberada.
//
// O que se afirma aqui é o que realmente precisa valer: exclusão é permitida,
// CONTRADIÇÃO não. Onde os dois citam o mesmo slug, o id tem que ser o mesmo; e
// o espelho não pode mirar liga que o front desconhece, porque aí ele grava um
// arquivo que ninguém busca.
//
// É teste de ARQUIVO, no espírito do shape-file-futebol.test.ts: o mapa do
// espelho vive numa edge function Deno, que a suíte do app não importa.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');
const DO_FRONT = resolve(RAIZ, 'src/utils/futebol-competitions.ts');
const DO_ESPELHO = resolve(
  RAIZ,
  'supabase/functions/mirror-futebol-league-logos/index.ts',
);

/** Lê `slug: numero` de dentro de um literal de objeto nomeado. */
function mapaDe(caminho: string, declaracao: string): Record<string, number> {
  // CRLF: o repositório é CRLF e as âncoras abaixo são escritas em LF.
  const fonte = readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n');
  const inicio = fonte.indexOf(declaracao);
  if (inicio < 0) throw new Error(`não achei "${declaracao}" em ${caminho}`);
  const fim = fonte.indexOf('\n};', inicio);
  if (fim < 0) throw new Error(`o literal de "${declaracao}" não fecha`);

  const corpo = fonte.slice(inicio + declaracao.length, fim);
  const mapa: Record<string, number> = {};
  for (const linha of corpo.split('\n')) {
    const achado = /^\s*([a-z_0-9]+)\s*:\s*(\d+)\s*,/.exec(linha);
    if (achado) mapa[achado[1]] = Number(achado[2]);
  }
  return mapa;
}

const doFront = mapaDe(DO_FRONT, 'export const COMPETITION_API_IDS: Record<string, number> = {');
const doEspelho = mapaDe(DO_ESPELHO, 'const LIGAS: Record<string, number> = {');

describe('de-para de ligas entre o front e o espelho de brasões', () => {
  it('a varredura enxerga os dois mapas — a guarda não é vazia', () => {
    // Sem isto, um erro de âncora devolveria dois objetos vazios e os testes
    // abaixo passariam sem comparar nada.
    expect(Object.keys(doFront).length).toBeGreaterThan(5);
    expect(Object.keys(doEspelho).length).toBeGreaterThan(5);
  });

  it('nenhum slug tem id diferente nos dois', () => {
    const divergentes = Object.entries(doEspelho)
      .filter(([slug, id]) => doFront[slug] !== undefined && doFront[slug] !== id)
      .map(([slug, id]) => `${slug}: espelho=${id} front=${doFront[slug]}`);

    expect(divergentes).toEqual([]);
  });

  it('o espelho não mira liga que o front desconhece', () => {
    const orfas = Object.keys(doEspelho).filter((slug) => doFront[slug] === undefined);

    expect(orfas).toEqual([]);
  });

  it('a Nations League entrou nos dois, com o id 5', () => {
    // O caso concreto da #505, e a razão de esta guarda existir: ela precisava
    // entrar em dois lugares, e só a prosa pedia isso.
    expect(doFront.nations_league).toBe(5);
    expect(doEspelho.nations_league).toBe(5);
  });
});
