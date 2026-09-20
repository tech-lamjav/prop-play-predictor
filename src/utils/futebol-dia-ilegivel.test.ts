import { describe, expect, it } from 'vitest';
import { addDays } from './futebol-datas';
import { demoBoardNoDia, demoFutebolBoard } from '@/components/onboarding/demo/futebol';

// ============================================================================
// O dia ilegível que apagava a tela de Oportunidades
// ============================================================================
// Num carregamento FRIO de /futebol/oportunidades — endereço digitado, ou F5 —
// nenhuma consulta voltou ainda, então a lista de dias do seletor está vazia. E
// o dia escolhido saía dela assim:
//
//   days.find((d) => d >= hoje) ?? days[days.length - 1]
//
// Com a lista vazia, `days[-1]` é `undefined`. Esse `undefined` descia até o
// board de exemplo, que monta as linhas no dia pedido e soma um dia para o jogo
// das 21h (BRT+3 passa da meia-noite UTC). `new Date("undefinedT12:00:00Z")` é
// data inválida, e o `toISOString` estourava DENTRO do render: sem
// ErrorBoundary no caminho, a página inteira sumia.
//
// Quem entrava por /futebol e navegava até lá nunca via: o board já estava em
// cache e a lista de dias vinha cheia na primeira pintura. Só quebrava para
// quem abria o endereço direto — e foi por isso que passou despercebido.
//
// O conserto está na origem (a tela cai em `hoje`); estes testes prendem a
// borda para que o mesmo dia ilegível volte a ser um erro que se lê.
// ============================================================================

describe('addDays com dia ilegível', () => {
  it('diz QUAL foi a chave, em vez de um "Invalid time value" anônimo', () => {
    expect(() => addDays(undefined as unknown as string, 1)).toThrowError(/dia ilegível: undefined/);
    expect(() => addDays('', 1)).toThrowError(/dia ilegível: ""/);
    expect(() => addDays('nao-e-data', 1)).toThrowError(/dia ilegível: "nao-e-data"/);
  });

  it('continua somando dias normalmente, inclusive virando o mês', () => {
    expect(addDays('2026-09-19', 1)).toBe('2026-09-20');
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-03-01', -29)).toBe('2026-01-31');
  });
});

describe('o board de exemplo', () => {
  // A linha que estourava: o board tem jogo às 21h de Brasília, que em UTC cai
  // no dia seguinte e por isso chama `addDays`.
  it('monta no dia pedido sem reclamar', () => {
    const linhas = demoFutebolBoard('contexto_v1');
    expect(() => demoBoardNoDia(linhas, '2026-09-19')).not.toThrow();
    expect(demoBoardNoDia(linhas, '2026-09-19').length).toBe(linhas.length);
  });

  it('recusa um dia ilegível dizendo o que recebeu', () => {
    const linhas = demoFutebolBoard('contexto_v1');
    expect(() => demoBoardNoDia(linhas, undefined as unknown as string))
      .toThrowError(/dia ilegível/);
  });
});
