import { describe, expect, it } from 'vitest';
import { ESTADOS_DO_JOGO, estadoDoJogo, passaNoFiltroDeEstado } from './futebol-score';

// ============================================================================
// O filtro de ESTADO do painel de oportunidades
// ============================================================================
// Substitui o interruptor "Só jogos em aberto", que respondia uma pergunta só:
// esconde o que já começou, ou mostra tudo. Não havia como pedir os encerrados
// do dia — para conferir como as leituras fecharam — nem o que está rolando
// agora.
//
// A regra que ele herda, e que os testes abaixo prendem, é a de sempre: QUEM
// MANDA É O RELÓGIO. O `status_short` vem do espelho e atrasa, então um jogo
// que já apitou continua em `NS` por alguns minutos — e durante esses minutos
// ele não pode aparecer como "em aberto", que é o recorte de quem ainda quer
// apostar.
// ============================================================================

const AGORA = new Date('2026-09-18T20:00:00Z');
/** Apito marcado para daqui a duas horas: o jogo ainda não começou. */
const APITO_A_FRENTE = '2026-09-18T22:00:00Z';
/** Apito de uma hora atrás: o jogo já começou. */
const APITO_JA_PASSOU = '2026-09-18T19:00:00Z';

describe('estadoDoJogo', () => {
  it('em aberto enquanto o apito não soou', () => {
    expect(estadoDoJogo('NS', APITO_A_FRENTE, AGORA)).toBe('aberto');
  });

  it('encerrado nos três status de fim, mesmo com o apito recém-passado', () => {
    expect(estadoDoJogo('FT', APITO_JA_PASSOU, AGORA)).toBe('encerrado');
    expect(estadoDoJogo('AET', APITO_JA_PASSOU, AGORA)).toBe('encerrado');
    expect(estadoDoJogo('PEN', APITO_JA_PASSOU, AGORA)).toBe('encerrado');
  });

  it('ao vivo quando o status diz que a bola rola', () => {
    expect(estadoDoJogo('1H', APITO_JA_PASSOU, AGORA)).toBe('ao_vivo');
    expect(estadoDoJogo('HT', APITO_JA_PASSOU, AGORA)).toBe('ao_vivo');
    expect(estadoDoJogo('2H', APITO_JA_PASSOU, AGORA)).toBe('ao_vivo');
  });

  // O ponto do filtro inteiro: o espelho atrasa, e quem decide é o relógio.
  it('ao vivo quando o apito passou e o status ainda não sabe', () => {
    expect(estadoDoJogo('NS', APITO_JA_PASSOU, AGORA)).toBe('ao_vivo');
    expect(estadoDoJogo(null, APITO_JA_PASSOU, AGORA)).toBe('ao_vivo');
  });

  // Sem horário não há como dizer que começou, e chutar "ao vivo" tiraria a
  // linha do recorte de quem está procurando aposta para fazer.
  it('em aberto quando não há horário de apito', () => {
    expect(estadoDoJogo('NS', null, AGORA)).toBe('aberto');
  });
});

describe('passaNoFiltroDeEstado', () => {
  it('os três marcados não escondem nada', () => {
    expect(passaNoFiltroDeEstado(ESTADOS_DO_JOGO, 'NS', APITO_A_FRENTE, AGORA)).toBe(true);
    expect(passaNoFiltroDeEstado(ESTADOS_DO_JOGO, '1H', APITO_JA_PASSOU, AGORA)).toBe(true);
    expect(passaNoFiltroDeEstado(ESTADOS_DO_JOGO, 'FT', APITO_JA_PASSOU, AGORA)).toBe(true);
  });

  it('cada jogo cai em exatamente um estado', () => {
    const jogos = [
      { status: 'NS', kickoff: APITO_A_FRENTE },
      { status: '2H', kickoff: APITO_JA_PASSOU },
      { status: 'FT', kickoff: APITO_JA_PASSOU },
    ];
    for (const jogo of jogos) {
      const casam = ESTADOS_DO_JOGO.filter((estado) =>
        passaNoFiltroDeEstado([estado], jogo.status, jogo.kickoff, AGORA),
      );
      expect(casam).toHaveLength(1);
    }
  });

  // A lista vazia esconde tudo, e isso é decisão de produto: o seletor deixa
  // desmarcar o último item, e a tela responde com o vazio e a instrução de
  // marcar alguma. O contrário — o clique não fazer nada — era o que havia.
  it('nenhum estado marcado esconde tudo', () => {
    expect(passaNoFiltroDeEstado([], 'NS', APITO_A_FRENTE, AGORA)).toBe(false);
    expect(passaNoFiltroDeEstado([], 'FT', APITO_JA_PASSOU, AGORA)).toBe(false);
  });
});
