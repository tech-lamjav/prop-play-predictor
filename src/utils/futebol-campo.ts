// ============================================================
// futebol-campo.ts — onde cada jogador cai no campo compartilhado
// ============================================================
// A tela mostrava DOIS campinhos, um por time, lado a lado. Cada um lia como um
// diagrama isolado, e a partida não aparecia em lugar nenhum: dois 4-2-3-1
// apontando para o mesmo lado não são um jogo, são duas fichas.
//
// Aqui é um campo só, na referência do Sofascore: o mandante ocupa uma metade e
// ataca para a metade do visitante, que vem espelhado. Os dois se olham.
//
// Isto é geometria, e não desenho: o módulo devolve AVANÇO e LARGURA, dois eixos
// do campo, e não sabe qual deles vai virar horizontal na tela. Quem gira é o
// `paraTela`, aqui do lado — e ele está aqui, e não no JSX, porque girar é a
// outra metade do espelho. Um eixo trocado ao contrário põe o mandante atacando
// o próprio gol, e isso não quebra teste nenhum se a regra morar no componente.
// ============================================================

/**
 * O que a geometria precisa saber de um jogador. Estrutural de propósito: o
 * payload da RPC serve, e o teste não precisa montar um jogador inteiro.
 */
export interface JogadorPosicionavel {
  /** "linha:coluna" da API, com a linha 1 no gol e crescendo para o ataque. */
  grid: string | null;
  team_side: 'home' | 'away';
  is_starter: boolean | null;
}

export interface PosicaoEmCampo<T extends JogadorPosicionavel> {
  jogador: T;
  /** 0 = fundo do mandante, 100 = fundo do visitante. */
  avanco: number;
  /** 0 a 100 de uma lateral à outra. */
  largura: number;
  /** A linha da formação, contada do gol para o ataque. */
  linha: number;
}

/** Como o campo está desenhado na tela. */
export type OrientacaoDoCampo = 'deitado' | 'em-pe';

/** Recuo do goleiro em relação à sua linha de fundo, em % do campo inteiro. */
const FUNDO = 4;
/** Até onde a linha mais adiantada avança. Para antes do meio: 50 é a divisa. */
const FRENTE = 45;

/**
 * Os titulares de um lado, já posicionados no campo inteiro.
 *
 * Reserva precisa falhar nas DUAS checagens para entrar, e não numa só. Hoje as
 * duas concordam: no jogo que medimos, os 22 com posição são exatamente os 22
 * titulares, e todo reserva vem com `grid` nulo. Mas exigir só a posição deixa a
 * fonte decidir sozinha quantos jogadores cabem em campo — bastaria um reserva
 * com `grid` preenchido para desenhar o décimo segundo homem, e ninguém contaria
 * onze bolinhas numa revisão para descobrir.
 */
export function posicoesNoCampo<T extends JogadorPosicionavel>(
  jogadores: T[],
  lado: 'home' | 'away',
): PosicaoEmCampo<T>[] {
  const emCampo = jogadores.filter((p) => p.team_side === lado && p.is_starter && p.grid);
  if (!emCampo.length) return [];

  const lidos = emCampo.map((jogador) => {
    const [linha, coluna] = (jogador.grid ?? '1:1').split(':').map(Number);
    return { jogador, linha: linha || 1, coluna: coluna || 1 };
  });

  const ultimaLinha = Math.max(...lidos.map((p) => p.linha));
  const porLinha = new Map<number, typeof lidos>();
  lidos.forEach((p) => {
    const atual = porLinha.get(p.linha) ?? [];
    atual.push(p);
    porLinha.set(p.linha, atual);
  });
  porLinha.forEach((arr) => arr.sort((a, b) => a.coluna - b.coluna));

  return lidos.map((p) => {
    const irmas = porLinha.get(p.linha)!;
    const ordem = irmas.indexOf(p);

    // Uma formação de linha única (payload truncado, ou um jogo em que só o
    // goleiro saiu publicado) dividiria por zero no avanço. Aí todo mundo fica
    // no fundo.
    const distancia = ultimaLinha > 1 ? (p.linha - 1) / (ultimaLinha - 1) : 0;
    const avanco = FUNDO + distancia * (FRENTE - FUNDO);

    // `(i + 1) / (n + 1)` distribui deixando margem nas duas pontas: quatro
    // zagueiros saem em 20, 40, 60 e 80, e não colados em 0 e 100.
    const largura = ((ordem + 1) / (irmas.length + 1)) * 100;

    return {
      jogador: p.jogador,
      linha: p.linha,
      // O visitante é o espelho nos DOIS eixos. Só inverter o avanço deixaria o
      // lateral direito de um de frente para o lateral direito do outro, que
      // num campo de verdade não acontece.
      avanco: lado === 'home' ? avanco : 100 - avanco,
      largura: lado === 'home' ? largura : 100 - largura,
    };
  });
}

/**
 * Quem NÃO foi desenhado em campo, deste lado.
 *
 * A regra é essa, e não "quem não é titular", por causa de um buraco: o campo
 * exigia ser titular E ter posição, e o banco exigia não ser titular. Titular
 * sem `grid` publicado não passava em nenhum dos dois e sumia da tela inteira,
 * sem nada dizendo que ele existe. Definido como o complemento do campo, não
 * sobra ninguém no meio.
 */
export function reservasDoLado<T extends JogadorPosicionavel>(
  jogadores: T[],
  lado: 'home' | 'away',
): T[] {
  const emCampo = new Set(posicoesNoCampo(jogadores, lado).map((p) => p.jogador));
  return jogadores.filter((p) => p.team_side === lado && !emCampo.has(p));
}

/**
 * A posição vira coordenada de tela, em percentual, para a orientação do campo.
 *
 * Deitado, o avanço é o horizontal e o mandante ataca para a direita. Em pé, os
 * eixos trocam e o mandante ataca para baixo.
 */
export function paraTela<T extends JogadorPosicionavel>(
  posicao: PosicaoEmCampo<T>,
  orientacao: OrientacaoDoCampo,
): { left: number; top: number } {
  return orientacao === 'deitado'
    ? { left: posicao.avanco, top: posicao.largura }
    : { left: posicao.largura, top: posicao.avanco };
}
