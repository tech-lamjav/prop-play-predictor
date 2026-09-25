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

// ============================================================================
// Handicap asiático (AE#202) — 4 das 8 premissas
// ============================================================================
// O mart passou a publicar `asian_handicap` em `fact_insumos_medidos`. A rota
// já era agnóstica de mercado (a chave do mapa é `mercado:slug`), então isto é
// só o mapa aprendendo quatro formas novas.
//
// As regras estão em `int_futebol_premissas_ah.sql`, e são elas que decidem
// cada frase — não o rótulo do catálogo:
//
//   supremacia             is_favorito AND (o_rank - s_rank >= 8
//                                           OR s_ppg >= 1.5 * o_ppg)
//   sem_rodizio            is_favorito AND <liga de pontos corridos>
//                                       AND (s_rank <= 6 OR s_rank >= n_teams - 3)
//   adversario_fragil_fora is_favorito AND o_ga_venue >= 1.6
//   defesa_fora_solida     is_azarao   AND s_ga_venue <= 1.1
// ============================================================================

describe('o handicap asiático lê o valor medido', () => {
  const ah = (over: Partial<InsumoMedido> = {}): InsumoMedido =>
    linha({ market: 'asian_handicap', ...over });

  const tabela = (over: Partial<InsumoMedido> = {}) => [
    ah({ premissa: 'supremacia', insumo: 's_rank', valor: 2, ...over }),
    ah({ premissa: 'supremacia', insumo: 's_ppg', valor: 2.24, ...over }),
    ah({ premissa: 'supremacia', insumo: 'o_rank', valor: 20, ...over }),
    ah({ premissa: 'supremacia', insumo: 'o_ppg', valor: 1.42, ...over }),
  ];

  it('a supremacia mostra os quatro números que o critério olhou', () => {
    // O critério é um OU: oito posições de distância OU 50% mais pontos por
    // jogo. A frase mostra os quatro números e NÃO afirma qual ramo acendeu —
    // dizer "está 18 posições à frente" esconderia que o outro ramo existe.
    expect(evidenciaDoInsumoMedido('asian_handicap', 'supremacia', 'home', tabela())?.texto)
      .toBe('2º com 2,24 pontos por jogo, contra 20º e 1,42 do adversário');
  });

  it('e a barra dela compara pontos por jogo, com a posição no rótulo', () => {
    expect(
      evidenciaDoInsumoMedido('asian_handicap', 'supremacia', 'home', tabela(), {
        time: 'Casa',
        adversario: 'Fora',
      })?.comparacao,
    ).toEqual({
      esqLabel: 'Casa, 2º',
      esqValor: 2.24,
      dirLabel: 'Fora, 20º',
      dirValor: 1.42,
      destaque: 'esq',
    });
  });

  it('faltando um dos quatro, devolve nulo em vez de meia frase', () => {
    expect(
      evidenciaDoInsumoMedido('asian_handicap', 'supremacia', 'home', [
        ah({ premissa: 'supremacia', insumo: 's_rank', valor: 2 }),
        ah({ premissa: 'supremacia', insumo: 's_ppg', valor: 2.24 }),
      ]),
    ).toBeNull();
  });

  it('linha repetida em cada handicap não vira frase repetida', () => {
    // ⚠️ Grão da AE#202: o valor é gravado em TODA linha de handicap do jogo
    // (~850 mil linhas a mais), porque quais premissas se aplicam depende da
    // linha, mas o valor não. Medido no banco: zero divergência entre linhas.
    //
    // Por isso `InsumoMedido` NÃO carrega `line_value`, embora a RPC devolva, e
    // `insumosDaPremissa` case só por mercado, premissa e saída. Isto é uma
    // dependência declarada do invariante lá de cima, não descuido: se algum
    // dia o valor passar a variar por linha, o mapa passaria a pegar um
    // arbitrário, e é aqui que a suposição está escrita para ser reconsiderada.
    // Quem já filtra por lado antes desta rota é o `premissasDaSaida`.
    expect(evidenciaDoInsumoMedido('asian_handicap', 'supremacia', 'home', [...tabela(), ...tabela()])?.texto)
      .toBe('2º com 2,24 pontos por jogo, contra 20º e 1,42 do adversário');
  });

  it('o sem rodízio mostra a posição contra o tamanho da liga', () => {
    // `s_rank <= 6 OR s_rank >= n_teams - 3`: topo brigando por algo, ou parte
    // de baixo brigando contra o rebaixamento. Nos dois o time não poupa. Os
    // dois números do corte são a posição e o tamanho da liga, e é isso que sai.
    expect(
      evidenciaDoInsumoMedido('asian_handicap', 'sem_rodizio', 'home', [
        ah({ premissa: 'sem_rodizio', insumo: 's_rank', valor: 3 }),
        ah({ premissa: 'sem_rodizio', insumo: 'n_teams', valor: 20 }),
      ])?.texto,
    ).toBe('3º entre 20 times');
  });

  it('e não ganha barra: é a posição do time contra o tamanho da liga', () => {
    // Não existe segundo lado. Uma barra aqui compararia o time com o número de
    // times da liga, que não é comparação nenhuma.
    expect(
      evidenciaDoInsumoMedido('asian_handicap', 'sem_rodizio', 'home', [
        ah({ premissa: 'sem_rodizio', insumo: 's_rank', valor: 18 }),
        ah({ premissa: 'sem_rodizio', insumo: 'n_teams', valor: 20 }),
      ])?.comparacao,
    ).toBeUndefined();
  });

  it('faltando o tamanho da liga, devolve nulo', () => {
    expect(
      evidenciaDoInsumoMedido('asian_handicap', 'sem_rodizio', 'home', [
        ah({ premissa: 'sem_rodizio', insumo: 's_rank', valor: 3 }),
      ]),
    ).toBeNull();
  });

  it('o adversário frágil mostra o gol sofrido NO MANDO DELE', () => {
    // `o_ga_venue >= 1.6` — `venue` está no nome da coluna. Apostando no
    // mandante, o adversário é quem joga fora, e é o dado de fora que o modelo
    // comparou. Dizer "por jogo" declararia janela mais larga que a medida.
    expect(
      evidenciaDoInsumoMedido(
        'asian_handicap',
        'adversario_fragil_fora',
        'home',
        [ah({ premissa: 'adversario_fragil_fora', insumo: 'o_ga_venue', valor: 1.8 })],
        { time: 'Casa', adversario: 'Fora' },
      )?.texto,
    ).toBe('Fora sofre 1,80 fora');
  });

  it('e o mando dele inverte quando a aposta é no visitante', () => {
    expect(
      evidenciaDoInsumoMedido(
        'asian_handicap',
        'adversario_fragil_fora',
        'away',
        [ah({ outcome: 'Away', premissa: 'adversario_fragil_fora', insumo: 'o_ga_venue', valor: 1.8 })],
        { time: 'Fora', adversario: 'Casa' },
      )?.texto,
    ).toBe('Casa sofre 1,80 em casa');
  });

  it('a defesa sólida mostra o gol sofrido no mando do PRÓPRIO time', () => {
    // `s_ga_venue <= 1.1`, premissa de azarão. Apostando no visitante, o número
    // que acendeu é o dele jogando fora.
    expect(
      evidenciaDoInsumoMedido(
        'asian_handicap',
        'defesa_fora_solida',
        'away',
        [ah({ outcome: 'Away', premissa: 'defesa_fora_solida', insumo: 's_ga_venue', valor: 0.9 })],
        { time: 'Fora', adversario: 'Casa' },
      )?.texto,
    ).toBe('Fora sofre 0,90 fora');
  });

  it('e é em casa quando o azarão é o mandante', () => {
    expect(
      evidenciaDoInsumoMedido(
        'asian_handicap',
        'defesa_fora_solida',
        'home',
        [ah({ premissa: 'defesa_fora_solida', insumo: 's_ga_venue', valor: 0.9 })],
        { time: 'Casa', adversario: 'Fora' },
      )?.texto,
    ).toBe('Casa sofre 0,90 em casa');
  });

  it('sem nome de time, as quatro ainda saem, sem inventar nome', () => {
    expect(
      evidenciaDoInsumoMedido('asian_handicap', 'adversario_fragil_fora', 'home', [
        ah({ premissa: 'adversario_fragil_fora', insumo: 'o_ga_venue', valor: 1.8 }),
      ])?.texto,
    ).toBe('Adversário sofre 1,80 fora');
  });

  // ── As três que NÃO entram, pela regra que excluiu a `mando` do Resultado ──
  // Em todas, o gráfico ao lado não sabe desenhar a grandeza do critério. Hoje
  // frase e gráfico estão errados e CONCORDAM; consertar metade é pior, porque
  // põe o número certo a se desmentir com o desenho logo abaixo.

  it('o mando_forte NÃO entra: o critério é percentual de pontos', () => {
    // `pct_pts_home` contra um corte percentual, enquanto `SPECS.mando_forte`
    // desenha `metrica: 'resultado'` — grade de vitória, empate e derrota. É o
    // mesmo defeito da `mando` no Resultado, e o tipo `Metrica` não tem ponto.
    //
    // ⚠️ E ela carrega uma segunda pendência: a analytics-engineering#200
    // mostrou que o recorte de mando é inválido em jogo de seleção, podendo
    // estar INVERTIDO na Copa (4 dos 15 jogos com anfitrião).
    expect(
      evidenciaDoInsumoMedido('asian_handicap', 'mando_forte', 'home', [
        ah({ premissa: 'mando_forte', insumo: 'pct_pts_home', valor: 62 }),
      ]),
    ).toBeNull();
  });

  it('a raramente_perde_por_2 NÃO entra: hoje frase e gráfico saem da MESMA amostra', () => {
    // ⚠️ O motivo aqui NÃO é "a frase está errada" — e dizer isso mandaria a
    // próxima fatia copiar um motivo falso.
    //
    // `evidenciaDoHistorico` tem um ramo dedicado a ela (futebol-historico.ts,
    // `slug === 'raramente_perde_por_2'`) que já diz "perdeu por dois ou mais
    // em k dos N jogos": a grandeza exata do critério, sobre a janela do
    // modelo. A frase de hoje está CERTA.
    //
    // E é por isso que ela fica de fora: essa frase é contada das MESMAS linhas
    // que o gráfico desenha, então as duas não têm como divergir. Trocar a
    // fonte para o mart entregaria o número que de fato acendeu, mas abriria
    // mão dessa garantia num card cujo gráfico (`metrica: 'resultado'`) não
    // sabe mostrar margem de derrota. É o princípio de uma origem só que o
    // `futebol-criterio.ts` documenta: duas derivações do mesmo número
    // divergem, e uma origem só é a única forma que não depende de vigilância.
    expect(
      evidenciaDoInsumoMedido('asian_handicap', 'raramente_perde_por_2', 'away', [
        ah({ outcome: 'Away', premissa: 'raramente_perde_por_2', insumo: 's_lost2', valor: 1 }),
        ah({ outcome: 'Away', premissa: 'raramente_perde_por_2', insumo: 's_n_games', valor: 10 }),
      ]),
    ).toBeNull();
  });

  it('a tende_golear NÃO entra: o gráfico desenha o adversário, e o mart o time', () => {
    // O mart publica `s_gf_venue` e `s_ga_venue` — os DOIS do time, que juntos
    // são saldo. `SPECS.tende_golear` desenha gf do time e ga do ADVERSÁRIO:
    // assunto diferente no segundo traço. Arrumar isso muda o que o gráfico
    // desenha hoje, e isso é mudança de comportamento com teste próprio.
    expect(
      evidenciaDoInsumoMedido('asian_handicap', 'tende_golear', 'home', [
        ah({ premissa: 'tende_golear', insumo: 's_gf_venue', valor: 2.1 }),
        ah({ premissa: 'tende_golear', insumo: 's_ga_venue', valor: 0.7 }),
      ]),
    ).toBeNull();
  });

  it('a favorito_irregular NÃO entra: a tela a esconde de propósito', () => {
    // Ela não é lacuna de catálogo: está na lista de premissas suprimidas do
    // `futebol-premissas.ts`, com o motivo ao lado — acende em 43% das linhas e
    // vale 0 ponto. Há teste de contrato garantindo que ela não entra no Score.
    //
    // Sem este teste, o comentário do mapa afirmaria que as QUATRO excluídas
    // têm guarda quando só três teriam.
    expect(
      evidenciaDoInsumoMedido('asian_handicap', 'favorito_irregular', 'away', [
        ah({ outcome: 'Away', premissa: 'favorito_irregular', insumo: 'o_n_games', valor: 10 }),
        ah({ outcome: 'Away', premissa: 'favorito_irregular', insumo: 'o_won2', valor: 3 }),
      ]),
    ).toBeNull();
  });

  it('a supremacia do handicap não responde pelo mercado de Resultado', () => {
    // A chave é mercado+slug. `supremacia` só existe no handicap; pedir ela no
    // 1X2 tem que devolver nulo, e não a forma da `superioridade_tabela`.
    expect(evidenciaDoInsumoMedido('match_winner', 'supremacia', 'home', tabela())).toBeNull();
  });
});
