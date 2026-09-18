import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evidenciaDaPremissa } from './futebol-evidencia-da-premissa';
import type { FutebolFixtureNumeros } from '@/services/futebol-data.service';

// ============================================================================
// A classificação para de ser a de hoje (#464)
// ============================================================================
// A CTE `tabela` da RPC 094 chamava `get_futebol_standings_official`, que pega
// `max(snapshot_date)` — a foto de hoje, qualquer que seja a data do jogo. Em
// Palmeiras x Sport de 06/04/2025 os dois eram 14º e 15º e a premissa NÃO
// acendeu; a tela mostra 2º com 76 contra 20º com 17, dizendo o oposto.
//
// A âncora é SQL e quem a prova de verdade é a medição contra produção. Aqui
// ela é fixada por texto, no padrão de `futebol-teste-migration`, para não
// sumir em silêncio num `create or replace` futuro.
//
// A política é do front e se prova na porta única: sem foto da época não há
// posição, e a tela OMITE em vez de mostrar a tabela atual. Vale para os três
// slugs, porque `supremacia` e `lado_coberto_forte` delegam ao construtor da
// `superioridade_tabela`.
// ============================================================================

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MIGRACAO = readFileSync(
  resolve(RAIZ, 'supabase/migrations/20260918140000_157_futebol_classificacao_na_data_do_jogo.sql'),
  'utf8',
);
const SHAPE = readFileSync(resolve(RAIZ, 'docs/futebol-prod-deploy.sql'), 'utf8');

const numeros = (over: Partial<FutebolFixtureNumeros> = {}): FutebolFixtureNumeros[] => {
  const base = (side: 'home' | 'away', id: number, nome: string): FutebolFixtureNumeros => ({
    side,
    team_id: id,
    team_name: nome,
    posicao: null,
    pontos: null,
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

const comTabela = (over: Partial<FutebolFixtureNumeros> = {}) => {
  const [casa, fora] = numeros(over);
  return [
    { ...casa, posicao: 2, pontos: 76 },
    { ...fora, posicao: 20, pontos: 17 },
  ] as FutebolFixtureNumeros[];
};

const evidenciaDe = (slug: string, linhas: FutebolFixtureNumeros[], mercado = 'match_winner') =>
  evidenciaDaPremissa({
    mercado,
    slug,
    numeros: linhas,
    historico: undefined,
    lado: 'home',
    linha: null,
    acesa: true,
  });

describe('a âncora da classificação, no SQL', () => {
  it('a migration corta pela data do jogo', () => {
    expect(MIGRACAO).toMatch(/st\.snapshot_date\s*<\s*j\.date_utc/i);
  });

  it('o corte é estrito: foto do dia do jogo pode já ter o resultado dele', () => {
    expect(MIGRACAO).not.toMatch(/st\.snapshot_date\s*<=\s*j\.date_utc/i);
  });

  it('lê a tabela de fotos direto, sem a função oficial', () => {
    // A oficial é compartilhada com a tela de campeonato e a de time, que
    // PRECISAM continuar mostrando a tabela atual (#464, critério de aceite).
    //
    // A negativa vale para o CORPO, não para o arquivo: o cabeçalho explica em
    // prosa por que não chamamos mais a oficial, e citar o nome ali é o ponto.
    const corpo = MIGRACAO.split('AS $function$')[1] ?? '';

    expect(corpo).toMatch(/join futebol\.fact_standings_snapshot/i);
    expect(corpo).not.toMatch(/get_futebol_standings_official/i);
  });

  it('a função oficial continua existindo para quem mostra a tabela de hoje', () => {
    expect(SHAPE).toMatch(/function public\.get_futebol_standings_official/i);
  });

  it('o arquivo de forma recebeu a mesma âncora', () => {
    expect(SHAPE).toMatch(/st\.snapshot_date\s*<\s*j\.date_utc/i);
  });
});

describe('a política do front sem foto da época', () => {
  it('sem posição, a superioridade na tabela não mostra número', () => {
    expect(evidenciaDe('superioridade_tabela', numeros())).toBeNull();
  });

  it('sem posição, a supremacia do handicap também não', () => {
    expect(evidenciaDe('supremacia', numeros(), 'asian_handicap')).toBeNull();
  });

  it('sem posição, o lado coberto forte da dupla chance também não', () => {
    expect(evidenciaDe('lado_coberto_forte', numeros(), 'double_chance')).toBeNull();
  });

  it('basta um lado sem posição para omitir: meia tabela não é comparação', () => {
    const soUmLado = comTabela();
    soUmLado[1] = { ...soUmLado[1], posicao: null, pontos: null };

    expect(evidenciaDe('superioridade_tabela', soUmLado)).toBeNull();
  });

  it('com foto da época, a frase volta com os números daquela data', () => {
    const ev = evidenciaDe('superioridade_tabela', comTabela());

    expect(ev).not.toBeNull();
    expect(ev!.texto).toContain('2º');
    expect(ev!.texto).toContain('20º');
  });
});
