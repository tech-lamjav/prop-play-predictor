import { describe, expect, it } from 'vitest';
import { fraseDoInsumoMedido, insumosDaPremissa, type InsumoMedido } from './futebol-insumo-medido';
import { evidenciaDaPremissa } from './futebol-evidencia-da-premissa';
import type { FutebolFixtureNumeros } from '@/services/futebol-data.service';

// ============================================================================
// O valor medido entra na porta única, e em que posição (#464)
// ============================================================================
// A ordem das rotas é por proximidade do critério. O insumo medido É o número
// que o modelo comparou — publicado pelo mart, não reconstruído por nós —, mas
// não traz o corte junto. Por isso ele fica ATRÁS da prestação de contas e À
// FRENTE das duas rotas que recalculam.
//
// O que estes testes protegem é justamente a posição: trocar a ordem faz a tela
// mostrar outro número para a mesma afirmação, que é o defeito original da
// #464 reaparecendo por outra porta.
// ============================================================================

const linha = (over: Partial<InsumoMedido> = {}): InsumoMedido => ({
  outcome: 'Home',
  market: 'match_winner',
  premissa: 'superioridade_tabela',
  insumo: 's_rank',
  valor: 2,
  ...over,
});

const numeros = (): FutebolFixtureNumeros[] =>
  (['home', 'away'] as const).map((side, i) => ({
    side,
    team_id: i + 1,
    team_name: side === 'home' ? 'Casa' : 'Fora',
    posicao: side === 'home' ? 2 : 20,
    pontos: side === 'home' ? 76 : 17,
    zona: null,
    jogos: 10,
    forma: 'VVEDD',
  })) as unknown as FutebolFixtureNumeros[];

describe('escolher o insumo de uma premissa', () => {
  it('casa a saída sem depender da caixa', () => {
    // O mercado de Resultado grava 'Home'; o lado da tela é 'home'. Comparar
    // direto devolveria vazio sem erro — foi assim que a medição desta issue
    // saiu zerada na primeira execução contra produção.
    expect(insumosDaPremissa('match_winner', 'superioridade_tabela', 'home', [linha()])).toHaveLength(1);
  });

  it('não mistura lados', () => {
    expect(insumosDaPremissa('match_winner', 'superioridade_tabela', 'away', [linha()])).toHaveLength(0);
  });

  it('não mistura mercados', () => {
    // `defesas_vazaveis` existe em dois mercados com critérios de famílias
    // diferentes: casar só pelo slug juntaria os dois.
    expect(insumosDaPremissa('btts', 'superioridade_tabela', 'home', [linha()])).toHaveLength(0);
  });

  it('descarta linha sem valor em vez de imprimir vazio', () => {
    expect(insumosDaPremissa('match_winner', 'superioridade_tabela', 'home', [linha({ valor: null })]))
      .toHaveLength(0);
  });

  it('sem lado, não escolhe nada', () => {
    expect(insumosDaPremissa('match_winner', 'superioridade_tabela', null, [linha()])).toHaveLength(0);
  });
});

describe('a frase do valor medido', () => {
  it('mostra nome e valor, sem traduzir o vocabulário do dbt', () => {
    expect(fraseDoInsumoMedido('match_winner', 'superioridade_tabela', 'home', [linha()]))
      .toBe('s_rank 2');
  });

  it('junta os insumos da mesma premissa', () => {
    const frase = fraseDoInsumoMedido('match_winner', 'superioridade_tabela', 'home', [
      linha({ insumo: 's_rank', valor: 2 }),
      linha({ insumo: 'o_rank', valor: 20 }),
    ]);

    expect(frase).toBe('s_rank 2 · o_rank 20');
  });

  it('usa vírgula decimal, como o resto do produto', () => {
    expect(fraseDoInsumoMedido('match_winner', 'superioridade_tabela', 'home', [linha({ valor: 1.485 })]))
      .toBe('s_rank 1,49');
  });

  it('sem insumo, devolve nulo para a próxima rota assumir', () => {
    expect(fraseDoInsumoMedido('match_winner', 'superioridade_tabela', 'home', [])).toBeNull();
    expect(fraseDoInsumoMedido('match_winner', 'superioridade_tabela', 'home', undefined)).toBeNull();
  });
});

describe('a posição do valor medido na porta única', () => {
  const chamar = (insumos?: InsumoMedido[]) =>
    evidenciaDaPremissa({
      mercado: 'match_winner',
      slug: 'superioridade_tabela',
      numeros: numeros(),
      historico: undefined,
      insumos,
      lado: 'home',
      linha: null,
      acesa: true,
    });

  it('o valor medido vence o perfil de temporada', () => {
    // Sem ele, a frase seria a do perfil: "Casa em 2º com 76 pontos contra...".
    expect(chamar([linha()])?.texto).toBe('s_rank 2');
  });

  it('sem valor medido, o perfil de temporada continua respondendo', () => {
    const ev = chamar();

    expect(ev).not.toBeNull();
    expect(ev!.texto).toContain('2º');
  });

  it('linha antiga sem valor medido não apaga a evidência', () => {
    // O funil é append-only: jogo gravado antes do deploy não tem insumo. Isso
    // é normal, e não pode virar tela vazia.
    expect(chamar([])?.texto).toContain('2º');
  });
});
