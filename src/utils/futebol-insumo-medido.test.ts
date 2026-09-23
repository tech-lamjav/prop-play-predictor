import { describe, expect, it } from 'vitest';
import { evidenciaDoInsumoMedido, insumosDaPremissa, type InsumoMedido } from './futebol-insumo-medido';
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

describe('a evidência do valor medido', () => {
  const tabelaCompleta = [
    linha({ insumo: 's_rank', valor: 2 }),
    linha({ insumo: 's_ppg', valor: 2.24 }),
    linha({ insumo: 'o_rank', valor: 20 }),
    linha({ insumo: 'o_ppg', valor: 1.42 }),
  ];

  it('lê a superioridade na tabela com a grandeza que o modelo compara', () => {
    // PONTOS POR JOGO, e não o total da temporada. A frase antiga mostrava "76
    // pontos", que é outra grandeza — verdadeira, e não era o insumo.
    expect(evidenciaDoInsumoMedido('match_winner', 'superioridade_tabela', 'home', tabelaCompleta)?.texto)
      .toBe('2º com 2,24 pontos por jogo, contra 20º e 1,42 do adversário');
  });

  it('a barra volta, comparando a mesma grandeza da frase', () => {
    // Sem isto a frase ficava e a BARRA sumia — perda de uma coisa que já
    // existia e funcionava, em todo jogo do 1X2.
    const ev = evidenciaDoInsumoMedido('match_winner', 'superioridade_tabela', 'home', tabelaCompleta, {
      time: 'Casa',
      adversario: 'Fora',
    });

    expect(ev?.comparacao).toEqual({
      esqLabel: 'Casa, 2º',
      esqValor: 2.24,
      dirLabel: 'Fora, 20º',
      dirValor: 1.42,
      destaque: 'esq',
    });
  });

  it('sem nome de time, a barra ainda sai, sem inventar nome', () => {
    expect(evidenciaDoInsumoMedido('match_winner', 'superioridade_tabela', 'home', tabelaCompleta)?.comparacao)
      .toMatchObject({ esqLabel: 'O time, 2º', dirLabel: 'Adversário, 20º' });
  });

  it('lê o confronto direto em vitórias sobre total, e sem barra', () => {
    // Sem barra de propósito: o mart dá vitórias e total, e entre as duas estão
    // os empates. "Vitórias contra o resto" seria outra afirmação.
    const ev = evidenciaDoInsumoMedido('match_winner', 'h2h_favoravel', 'home', [
      linha({ premissa: 'h2h_favoravel', insumo: 's_wins', valor: 6 }),
      linha({ premissa: 'h2h_favoravel', insumo: 'h2h_total', valor: 10 }),
    ]);

    expect(ev?.texto).toBe('6 vitórias em 10 confrontos');
    expect(ev?.comparacao).toBeUndefined();
  });

  it('concorda em número quando é um só', () => {
    const ev = evidenciaDoInsumoMedido('match_winner', 'h2h_favoravel', 'home', [
      linha({ premissa: 'h2h_favoravel', insumo: 's_wins', valor: 1 }),
      linha({ premissa: 'h2h_favoravel', insumo: 'h2h_total', valor: 1 }),
    ]);

    expect(ev?.texto).toBe('1 vitória em 1 confronto');
  });

  it('faltando um insumo da forma, devolve nulo em vez de meia frase', () => {
    expect(evidenciaDoInsumoMedido('match_winner', 'superioridade_tabela', 'home', [linha()]))
      .toBeNull();
  });

  it('premissa sem forma conhecida devolve nulo, e NÃO o nome da coluna', () => {
    // `s_form_pts 11` na tela seria identificador de banco na cara do
    // assinante. Pior: a premissa falaria pela janela do mart enquanto o
    // gráfico logo abaixo desenha a nossa. Nulo aqui faz cair no histórico,
    // que sai da mesma série do gráfico.
    expect(evidenciaDoInsumoMedido('match_winner', 'forma', 'home', [
      linha({ premissa: 'forma', insumo: 's_form_pts', valor: 11 }),
    ])).toBeNull();
  });

  it('sem insumo, devolve nulo para a próxima rota assumir', () => {
    expect(evidenciaDoInsumoMedido('match_winner', 'superioridade_tabela', 'home', [])).toBeNull();
    expect(evidenciaDoInsumoMedido('match_winner', 'superioridade_tabela', 'home', undefined)).toBeNull();
  });

  // ── As quatro premissas que passaram a ler o valor medido ──────────────────
  // O mart publica 8 premissas de `match_winner` e o mapa consumia 2. Estas
  // quatro fecham a diferença menos a `superioridade_xg`, que precisa da família
  // de diferença (criado MENOS sofrido) e de uma métrica de xG sofrido que o
  // gráfico ainda não nomeia — escrever só a frase dela faria frase e gráfico
  // discordarem, que é o defeito que esta rota existe para fechar.

  it('a forma conta as vitórias do critério, e não o resumo de três números', () => {
    // A frase antiga saía do `form` da API: "3 vitórias, 1 empate e 1 derrota".
    // Verdadeira, e não era o insumo: o critério é `n_wins_last5 >= 3`, onde
    // empate e derrota não entram na conta que acende.
    expect(evidenciaDoInsumoMedido('match_winner', 'forma', 'home', [
      linha({ premissa: 'forma', insumo: 'n_wins_last5', valor: 3 }),
    ])?.texto).toBe('3 vitórias nos últimos 5 jogos');
  });

  it('e concorda em número quando a vitória é uma só', () => {
    expect(evidenciaDoInsumoMedido('match_winner', 'forma', 'home', [
      linha({ premissa: 'forma', insumo: 'n_wins_last5', valor: 1 }),
    ])?.texto).toBe('1 vitória nos últimos 5 jogos');
  });

  it('a forma não ganha barra: é um número contra um corte, sem segundo lado', () => {
    expect(evidenciaDoInsumoMedido('match_winner', 'forma', 'home', [
      linha({ premissa: 'forma', insumo: 'n_wins_last5', valor: 4 }),
    ])?.comparacao).toBeUndefined();
  });

  it('o mando NÃO entra, mesmo com o valor publicado pelo mart', () => {
    // ⚠️ EXCLUSÃO DELIBERADA, pela mesma regra da `superioridade_xg`.
    //
    // O mart publica `pct_pts_home` e `aprov_fora`, e a frase sairia fácil. Mas
    // `SPECS.mando` desenha `metrica: 'resultado'` — grade de vitórias, empates
    // e derrotas —, e o critério compara APROVEITAMENTO percentual contra 55 em
    // casa e 45 fora. Escrever só a frase deixaria o número certo com o gráfico
    // errado logo abaixo, se desmentindo na tela.
    //
    // Hoje os dois estão errados e CONCORDAM; consertar metade é pior. Entra
    // junto com a `superioridade_xg` quando o gráfico souber desenhar a
    // grandeza — o tipo `Metrica` não tem ponto nem xG sofrido.
    expect(evidenciaDoInsumoMedido('match_winner', 'mando', 'home', [
      linha({ premissa: 'mando', insumo: 'pct_pts_home', valor: 62 }),
    ])).toBeNull();
  });

  it('o mismatch de força mostra as duas grandezas do critério', () => {
    // `s_gf_venue >= 1.4 AND o_ga_venue >= 1.3`: gol MARCADO pelo time e gol
    // SOFRIDO pelo adversário, cada um no mando dele. São duas coisas
    // diferentes, e a frase precisa dizer qual é qual.
    const ev = evidenciaDoInsumoMedido('match_winner', 'forca_mismatch', 'home', [
      linha({ premissa: 'forca_mismatch', insumo: 's_gf_venue', valor: 1.6 }),
      linha({ premissa: 'forca_mismatch', insumo: 'o_ga_venue', valor: 1.4 }),
    ], { time: 'Casa', adversario: 'Fora' });

    expect(ev?.texto).toBe('Casa marca 1,60 em casa e Fora sofre 1,40 fora');
  });

  it('e o mando inverte quando a aposta é no visitante', () => {
    // `venue` está no nome das duas colunas: o insumo é recortado por mando.
    // Dizer "por jogo" declarava janela mais larga que a medida — pelo
    // glossário, recorte desencontrado do número é o gráfico desmentindo o
    // número que ele deveria explicar.
    const ev = evidenciaDoInsumoMedido('match_winner', 'forca_mismatch', 'away', [
      linha({ outcome: 'Away', premissa: 'forca_mismatch', insumo: 's_gf_venue', valor: 1.6 }),
      linha({ outcome: 'Away', premissa: 'forca_mismatch', insumo: 'o_ga_venue', valor: 1.4 }),
    ], { time: 'Fora', adversario: 'Casa' });

    expect(ev?.texto).toBe('Fora marca 1,60 fora e Casa sofre 1,40 em casa');
  });

  it('e a barra dele não destaca lado nenhum', () => {
    // Os dois números altos favorecem a aposta. Pintar o maior de verde diria
    // que a defesa vazada do adversário é o lado "bom" da comparação.
    const ev = evidenciaDoInsumoMedido('match_winner', 'forca_mismatch', 'home', [
      linha({ premissa: 'forca_mismatch', insumo: 's_gf_venue', valor: 1.6 }),
      linha({ premissa: 'forca_mismatch', insumo: 'o_ga_venue', valor: 1.4 }),
    ], { time: 'Casa', adversario: 'Fora' });

    expect(ev?.comparacao).toEqual({
      esqLabel: 'Casa marca em casa',
      esqValor: 1.6,
      dirLabel: 'Fora sofre fora',
      dirValor: 1.4,
      destaque: 'nenhum',
    });
  });

  it('faltando um lado do mismatch, devolve nulo em vez de meia frase', () => {
    expect(evidenciaDoInsumoMedido('match_winner', 'forca_mismatch', 'home', [
      linha({ premissa: 'forca_mismatch', insumo: 's_gf_venue', valor: 1.6 }),
    ])).toBeNull();
  });

  it('o desfalque mostra as DUAS condições do critério', () => {
    // `o_missing >= 1 AND s_missing = 0`. Mostrar só o desfalque do adversário
    // esconderia metade: um time com dois desfalques próprios não acende esta
    // premissa, e a tela diria o contrário.
    const ev = evidenciaDoInsumoMedido('match_winner', 'desfalque_adversario', 'home', [
      linha({ premissa: 'desfalque_adversario', insumo: 'o_missing', valor: 2 }),
      linha({ premissa: 'desfalque_adversario', insumo: 's_missing', valor: 0 }),
    ], { time: 'Casa', adversario: 'Fora' });

    expect(ev?.texto).toBe('Fora com 2 desfalques de titular, contra nenhum do Casa');
  });

  it('e escreve o número quando o próprio time também tem desfalque', () => {
    const ev = evidenciaDoInsumoMedido('match_winner', 'desfalque_adversario', 'home', [
      linha({ premissa: 'desfalque_adversario', insumo: 'o_missing', valor: 1 }),
      linha({ premissa: 'desfalque_adversario', insumo: 's_missing', valor: 1 }),
    ], { time: 'Casa', adversario: 'Fora' });

    expect(ev?.texto).toBe('Fora com 1 desfalque de titular, contra 1 do Casa');
  });

  it('sem nome de time, as quatro ainda saem, sem inventar nome', () => {
    const ev = evidenciaDoInsumoMedido('match_winner', 'forca_mismatch', 'home', [
      linha({ premissa: 'forca_mismatch', insumo: 's_gf_venue', valor: 1.6 }),
      linha({ premissa: 'forca_mismatch', insumo: 'o_ga_venue', valor: 1.4 }),
    ]);

    expect(ev?.texto).toBe('O time marca 1,60 em casa e o adversário sofre 1,40 fora');
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
    // Sem ele, a frase seria a do perfil: "Casa em 2º com 76 pontos contra...",
    // que usa o TOTAL de pontos — grandeza que o modelo não compara.
    const ev = chamar([
      linha({ insumo: 's_rank', valor: 2 }),
      linha({ insumo: 's_ppg', valor: 2.24 }),
      linha({ insumo: 'o_rank', valor: 20 }),
      linha({ insumo: 'o_ppg', valor: 1.42 }),
    ]);

    expect(ev?.texto).toBe('2º com 2,24 pontos por jogo, contra 20º e 1,42 do adversário');
  });

  it('a barra vem com o nome dos times, tirado da 094', () => {
    const ev = chamar([
      linha({ insumo: 's_rank', valor: 2 }),
      linha({ insumo: 's_ppg', valor: 2.24 }),
      linha({ insumo: 'o_rank', valor: 20 }),
      linha({ insumo: 'o_ppg', valor: 1.42 }),
    ]);

    expect(ev?.comparacao).toMatchObject({ esqLabel: 'Casa, 2º', dirLabel: 'Fora, 20º' });
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

  it('insumo incompleto não sequestra a premissa: cai na rota seguinte', () => {
    // Era o defeito do escopo: a rota alcançava as 8 premissas do 1X2, não as
    // 4 da issue, e preemptava o histórico nas que já estavam certas.
    expect(chamar([linha()])?.texto).toContain('2º');
  });
});
