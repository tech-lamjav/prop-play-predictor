import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evidenciaDaPremissa } from './futebol-evidencia-da-premissa';
import type { FutebolFixtureNumeros } from '@/services/futebol-data.service';

// ============================================================================
// O confronto direto para de olhar o futuro (#464)
// ============================================================================
// A CTE de h2h da RPC 094 juntava `fact_h2h` sem filtro de data nenhum, então um
// jogo encerrado contava confrontos que aconteceram DEPOIS dele: Fluminense x
// Vasco de 11/08/2024 tinha 1 confronto anterior e a tela dizia 10.
//
// Dois lados para testar, e eles moram em lugares diferentes:
//   - a ÂNCORA é SQL, e quem a prova de verdade é a medição contra produção;
//     aqui ela é fixada por texto, no mesmo padrão de `futebol-teste-migration`,
//     para não sumir em silêncio num `create or replace` futuro;
//   - a POLÍTICA é do front: sem confronto anterior, a tela OMITE em vez de
//     mostrar o número de hoje. Isso se prova na porta única.
// ============================================================================

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MIGRACAO = readFileSync(
  resolve(RAIZ, 'supabase/migrations/20260918120000_156_futebol_h2h_ancorado_no_apito.sql'),
  'utf8',
);
const SHAPE = readFileSync(resolve(RAIZ, 'docs/futebol-prod-deploy.sql'), 'utf8');

const numeros = (over: Partial<FutebolFixtureNumeros> = {}): FutebolFixtureNumeros[] => {
  const base = (side: 'home' | 'away', id: number, nome: string): FutebolFixtureNumeros => ({
    side,
    team_id: id,
    team_name: nome,
    posicao: 1,
    pontos: 10,
    zona: null,
    jogos: 10,
    jogos_casa: 5,
    jogos_fora: 5,
    gf_casa: 1,
    ga_casa: 1,
    gf_fora: 1,
    ga_fora: 1,
    gf_total: 1,
    ga_total: 1,
    clean_sheets: 2,
    sem_marcar: 2,
    forma: 'VVEDD',
    ...over,
  }) as FutebolFixtureNumeros;
  return [base('home', 1, 'Casa'), base('away', 2, 'Fora')];
};

const evidenciaDoH2h = (over: Partial<FutebolFixtureNumeros> = {}) =>
  evidenciaDaPremissa({
    mercado: 'match_winner',
    slug: 'h2h_favoravel',
    numeros: numeros(over),
    historico: undefined,
    lado: 'home',
    linha: null,
    acesa: true,
  });

describe('a âncora do confronto direto, no SQL', () => {
  it('a migration corta pelo apito da partida analisada', () => {
    expect(MIGRACAO).toMatch(/hh\.kickoff_utc\s*<\s*j\.kickoff_utc/i);
  });

  it('o corte é estrito: um confronto do mesmo instante é o próprio jogo', () => {
    expect(MIGRACAO).not.toMatch(/hh\.kickoff_utc\s*<=\s*j\.kickoff_utc/i);
  });

  it('a CTE do jogo traz o apito, senão não há com o que comparar', () => {
    expect(MIGRACAO).toMatch(/with jogo as \([\s\S]*?f\.kickoff_utc[\s\S]*?\),/i);
  });

  it('o arquivo de forma recebeu a mesma âncora', () => {
    // O espelho diverge do banco quando alguém altera a migration e esquece o
    // shape file — já aconteceu onze vezes seguidas (migrations 091 a 103).
    expect(SHAPE).toMatch(/hh\.kickoff_utc\s*<\s*j\.kickoff_utc/i);
  });
});

describe('a política do front quando não há confronto anterior', () => {
  it('sem confronto anterior, a tela não mostra número nenhum', () => {
    // `h2h_jogos` ausente é o que a RPC ancorada devolve para um jogo sem
    // confronto anterior: a linha do h2h não existe e o left join deixa nulo.
    //
    // Nulo aqui é frase E barra sumindo juntas: o construtor devolve as duas no
    // mesmo objeto, então a omissão é tudo ou nada por construção. Não existe
    // estado em que a barra sobreviva mostrando posição e pontos de hoje
    // embaixo de uma premissa sem frase.
    expect(evidenciaDoH2h()).toBeNull();
  });

  it('com confrontos anteriores, a frase e a barra voltam', () => {
    const ev = evidenciaDoH2h({ h2h_jogos: 3, h2h_vitorias: 2, h2h_empates: 1 });

    expect(ev).not.toBeNull();
    expect(ev!.texto).toContain('3 confrontos');
  });
});
