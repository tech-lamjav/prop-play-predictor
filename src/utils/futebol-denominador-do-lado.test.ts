import { describe, expect, it } from 'vitest';
import { MERCADOS, contagemDaPorta, contaQueValem, mercadoDe, premissasDaSaida } from './futebol-premissas';
import type { FutebolFixturePremissas } from '@/services/futebol-data.service';

// ============================================================================
// O denominador conta só o lado da saída (issue #351, spec #349)
// ============================================================================
// "3 de 6 premissas" tinha um Y que se mexia quando o assinante arrastava a
// régua de linha. Duas causas, as duas aqui:
//
//   · o total, em algumas telas, contava as premissas dos DOIS lados — e as do
//     Under nunca poderiam acender numa saída de Over;
//   · `premissasDaSaida` tinha uma exceção que devolvia a premissa ACESA do lado
//     oposto. Como o total saía dessa lista, o Y crescia na linha em que o mart
//     acendeu do lado errado.
//
// O conjunto de premissas de um lado é FIXO e vem do modelo. No mercado de gols
// são 6 de Over e 5 de Under, e nenhuma linha muda isso.
// ============================================================================

const GOLS = mercadoDe('goals_over_under')!;

const saida = (
  outcome: 'Over' | 'Under',
  line_value: number,
  acesas: string[] = [],
): FutebolFixturePremissas => ({
  market: 'goals_over_under',
  outcome,
  line_value,
  pts_premissas: 0,
  penalidades_pts: 0,
  acesas,
  apagadas: [],
  penalidades: [],
});

describe('a lista da saída é só do lado da saída', () => {
  it('um Over não lista premissa de Under, e vice-versa', () => {
    const doOver = premissasDaSaida(GOLS, saida('Over', 2.5)).map((p) => p.slug);
    const doUnder = premissasDaSaida(GOLS, saida('Under', 2.5)).map((p) => p.slug);

    expect(doOver).toContain('defesas_vazaveis');
    expect(doOver).not.toContain('defesas_firmes');
    expect(doUnder).toContain('defesas_firmes');
    expect(doUnder).not.toContain('defesas_vazaveis');
    // E os dois conjuntos não se tocam: qualquer interseção é premissa aparecendo
    // dos dois lados, que é o que fazia a tela se contradizer.
    expect(doOver.filter((s) => doUnder.includes(s))).toEqual([]);
  });

  it('premissa ACESA do lado oposto continua fora', () => {
    // Se o mart acender um Under embaixo de um Over, isso é dado a investigar —
    // não coisa a exibir. Antes ele entrava na lista "como rede de segurança", e
    // levava o denominador junto.
    const comIntruso = premissasDaSaida(GOLS, saida('Over', 2.5, ['defesas_firmes'])).map(
      (p) => p.slug,
    );

    expect(comIntruso).not.toContain('defesas_firmes');
  });
});

describe('o total não se mexe ao trocar de linha dentro do mesmo lado', () => {
  it.each([1.5, 2.5, 3.5, 4.5])('Over %s tem sempre o mesmo total', (linha) => {
    expect(contagemDaPorta(saida('Over', linha)).total).toBe(
      contagemDaPorta(saida('Over', 2.5)).total,
    );
  });

  it('nem quando a linha acende uma premissa do lado oposto', () => {
    const limpa = contagemDaPorta(saida('Over', 2.5, ['defesas_vazaveis']));
    const suja = contagemDaPorta(saida('Over', 3.5, ['defesas_vazaveis', 'clean_sheets_altos']));

    expect(suja.total).toBe(limpa.total);
    // E a intrusa também não infla o numerador: ela não é premissa deste lado.
    expect(suja.acesas).toBe(1);
  });
});

describe('numerador e denominador medem o mesmo universo', () => {
  // Enquanto o numerador vivia em `contaQueValem` e cada tela derivava o seu
  // denominador, eles mediam coisas diferentes e a fração podia passar de 100%.
  it.each([
    ['Over' as const, ['defesas_vazaveis', 'ataque_combinado', 'xg_combinado_alto']],
    ['Under' as const, ['defesas_firmes', 'clean_sheets_altos', 'xg_baixo_combinado']],
  ])('%s: acender todas as que valem dá n igual a N', (outcome, acesas) => {
    const c = contagemDaPorta(saida(outcome, 2.5, acesas));

    expect(c.acesas).toBe(acesas.length);
    expect(c.acesas).toBeLessThanOrEqual(c.total);
  });

  it('`contaQueValem` é o numerador dessa mesma contagem', () => {
    const s = saida('Over', 2.5, ['defesas_vazaveis', 'defesas_firmes']);

    expect(contaQueValem(s)).toBe(contagemDaPorta(s).acesas);
  });

  it('saída de mercado desconhecido não inventa total', () => {
    const s = { ...saida('Over', 2.5), market: 'mercado_que_nao_existe' };

    expect(contagemDaPorta(s)).toEqual({ acesas: 0, total: 0 });
  });
});

describe('mercado sem lado declarado conta o mercado inteiro', () => {
  it('no resultado, as premissas valem para as três saídas', () => {
    // 1X2 e dupla chance não dividem premissa por lado: ali o total é o mercado
    // todo, e recortar por lado devolveria zero.
    const r = mercadoDe('match_winner')!;
    const total = premissasDaSaida(r, {
      market: 'match_winner',
      outcome: 'Home',
      line_value: null,
    }).length;

    expect(total).toBeGreaterThan(0);
    expect(total).toBe(
      premissasDaSaida(r, { market: 'match_winner', outcome: 'Draw', line_value: null }).length,
    );
  });
});

describe('a divisão por lado cobre o catálogo inteiro', () => {
  // Guarda contra premissa nova nascer sem lado num mercado que tem lados: ela
  // apareceria nos DOIS, e o denominador voltaria a contar demais.
  const COM_LADO = ['goals_over_under', 'btts', 'asian_handicap'];

  it.each(COM_LADO)('%s: toda premissa declara de que lado é', (slug) => {
    const m = MERCADOS.find((x) => x.slug === slug)!;
    const semLado = m.premissas.filter((p) => p.lado == null).map((p) => p.slug);

    expect(semLado).toEqual([]);
  });
});
