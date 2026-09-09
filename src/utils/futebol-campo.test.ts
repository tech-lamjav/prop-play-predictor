import { describe, expect, it } from 'vitest';
import { paraTela, posicoesNoCampo, reservasDoLado, type JogadorPosicionavel } from './futebol-campo';

const j = (grid: string | null, side: 'home' | 'away', starter: boolean | null = true): JogadorPosicionavel => ({
  grid,
  team_side: side,
  is_starter: starter,
});

/** Um 4-2-3-1 inteiro, do goleiro ao centroavante. */
function escalacao(side: 'home' | 'away'): JogadorPosicionavel[] {
  const linhas = [1, 4, 2, 3, 1];
  return linhas.flatMap((n, i) =>
    Array.from({ length: n }, (_, c) => j(`${i + 1}:${c + 1}`, side)),
  );
}

describe('posições no campo compartilhado', () => {
  it('o goleiro do mandante fica na sua linha de fundo', () => {
    const [gk] = posicoesNoCampo(escalacao('home'), 'home');
    expect(gk.avanco).toBe(4);
  });

  it('o goleiro do visitante fica na linha de fundo oposta', () => {
    // O espelho é o ponto do campo único: os dois se olham, e não se seguem.
    const [gk] = posicoesNoCampo(escalacao('away'), 'away');
    expect(gk.avanco).toBe(96);
  });

  it('a linha mais adiantada para antes do meio de campo', () => {
    const casa = posicoesNoCampo(escalacao('home'), 'home');
    const fora = posicoesNoCampo(escalacao('away'), 'away');

    expect(Math.max(...casa.map((p) => p.avanco))).toBeLessThan(50);
    expect(Math.min(...fora.map((p) => p.avanco))).toBeGreaterThan(50);
  });

  it('uma linha de quatro se espalha sem encostar nas bordas', () => {
    const zaga = posicoesNoCampo(escalacao('home'), 'home').filter((p) => p.linha === 2);

    expect(zaga.map((p) => p.largura)).toEqual([20, 40, 60, 80]);
  });

  it('a linha do visitante sai na ordem invertida, que é o que faz o espelho', () => {
    // Sem inverter, o lateral direito de um apareceria de frente para o lateral
    // direito do outro — que num campo de verdade não acontece.
    const zaga = posicoesNoCampo(escalacao('away'), 'away').filter((p) => p.linha === 2);

    expect(zaga.map((p) => p.largura)).toEqual([80, 60, 40, 20]);
  });

  it('reserva não entra em campo nem trazendo posição', () => {
    const banco = [j(null, 'home', false), j('2:1', 'home', false)];

    expect(posicoesNoCampo(banco, 'home')).toEqual([]);
  });

  it('o time do outro lado não entra nesta metade', () => {
    const mistura = [...escalacao('home'), ...escalacao('away')];

    expect(posicoesNoCampo(mistura, 'home')).toHaveLength(11);
  });

  it('escalação de uma linha só não divide por zero', () => {
    const soGoleiro = [j('1:1', 'home')];

    expect(posicoesNoCampo(soGoleiro, 'home')[0].avanco).toBe(4);
  });
});

describe('quem fica de fora do campo', () => {
  it('o reserva é quem não foi desenhado', () => {
    const banco = [j(null, 'home', false), j(null, 'home', false)];

    expect(reservasDoLado([...escalacao('home'), ...banco], 'home')).toHaveLength(2);
  });

  it('titular sem posição publicada cai no banco, e não no limbo', () => {
    // O buraco de antes: o campo exigia posição e o banco exigia não ser
    // titular. Titular sem `grid` não passava em nenhum dos dois e sumia da
    // tela inteira, sem nada dizendo que ele existe.
    const semGrid = j(null, 'home', true);

    expect(reservasDoLado([...escalacao('home'), semGrid], 'home')).toEqual([semGrid]);
  });

  it('não devolve jogador do outro lado', () => {
    const banco = [j(null, 'home', false), j(null, 'away', false)];

    expect(reservasDoLado(banco, 'home')).toHaveLength(1);
  });
});

describe('a posição vira coordenada de tela', () => {
  const gol = posicoesNoCampo(escalacao('home'), 'home')[0];

  it('deitado, o avanço é o eixo horizontal', () => {
    expect(paraTela(gol, 'deitado')).toEqual({ left: 4, top: gol.largura });
  });

  it('em pé, os eixos trocam: o mandante ataca para baixo', () => {
    // A troca vive aqui, e não no JSX, exatamente porque é a outra metade do
    // espelho. No celular o campo gira, e um eixo trocado ao contrário poria o
    // mandante atacando o próprio gol sem quebrar teste nenhum.
    expect(paraTela(gol, 'em-pe')).toEqual({ left: gol.largura, top: 4 });
  });

  it('girar não muda quem está na frente de quem', () => {
    const casa = posicoesNoCampo(escalacao('home'), 'home');
    const fora = posicoesNoCampo(escalacao('away'), 'away');

    const casaEmPe = casa.map((p) => paraTela(p, 'em-pe').top);
    const foraEmPe = fora.map((p) => paraTela(p, 'em-pe').top);

    expect(Math.max(...casaEmPe)).toBeLessThan(Math.min(...foraEmPe));
  });
});
