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
  const tabelaCompleta = [
    linha({ insumo: 's_rank', valor: 2 }),
    linha({ insumo: 's_ppg', valor: 2.24 }),
    linha({ insumo: 'o_rank', valor: 20 }),
    linha({ insumo: 'o_ppg', valor: 1.42 }),
  ];

  it('lê a superioridade na tabela com a grandeza que o modelo compara', () => {
    // PONTOS POR JOGO, e não o total da temporada. A frase antiga mostrava "76
    // pontos", que é outra grandeza — verdadeira, e não era o insumo.
    expect(fraseDoInsumoMedido('match_winner', 'superioridade_tabela', 'home', tabelaCompleta))
      .toBe('2º com 2,24 pontos por jogo, contra 20º e 1,42 do adversário');
  });

  it('lê o confronto direto em vitórias sobre total', () => {
    const frase = fraseDoInsumoMedido('match_winner', 'h2h_favoravel', 'home', [
      linha({ premissa: 'h2h_favoravel', insumo: 's_wins', valor: 6 }),
      linha({ premissa: 'h2h_favoravel', insumo: 'h2h_total', valor: 10 }),
    ]);

    expect(frase).toBe('6 vitórias em 10 confrontos');
  });

  it('concorda em número quando é um só', () => {
    const frase = fraseDoInsumoMedido('match_winner', 'h2h_favoravel', 'home', [
      linha({ premissa: 'h2h_favoravel', insumo: 's_wins', valor: 1 }),
      linha({ premissa: 'h2h_favoravel', insumo: 'h2h_total', valor: 1 }),
    ]);

    expect(frase).toBe('1 vitória em 1 confronto');
  });

  it('faltando um insumo da forma, cai no par cru em vez de inventar', () => {
    // Meia frase seria pior que frase nenhuma: ela afirmaria uma comparação
    // com um dos lados ausente.
    expect(fraseDoInsumoMedido('match_winner', 'superioridade_tabela', 'home', [linha()]))
      .toBe('s_rank 2');
  });

  it('premissa sem forma conhecida continua agnóstica', () => {
    const frase = fraseDoInsumoMedido('match_winner', 'forma', 'home', [
      linha({ premissa: 'forma', insumo: 's_form_pts', valor: 11 }),
    ]);

    expect(frase).toBe('s_form_pts 11');
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
