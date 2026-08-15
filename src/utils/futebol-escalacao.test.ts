import { describe, it, expect } from 'vitest';
import { escalacaoExibida, faseDaEscalacao, rotuloEscalacao } from './futebol-escalacao';

// A RPC devolve UMA fase por jogo (migration 098): prefere a confirmada e cai
// para a real quando não houver confirmada. Estes testes cobrem o que a tela
// diz em cada caso — a regra, não a renderização.
//
// As duas listas são decididas em separado no banco porque discordam entre si:
// escalação confirmada existe em 4 jogos na tabela de times e em 137 na de
// jogadores. Por isso `faseDaEscalacao` recebe as duas e tem uma ordem de
// preferência declarada.

const time = (fase: string | null) => ({ lineup_phase: fase });
const jogador = (fase: string | null) => ({ lineup_phase: fase });

describe('faseDaEscalacao', () => {
  it('lê a fase da lista de jogadores, que é o conteúdo principal do card', () => {
    expect(faseDaEscalacao([time('real')], [jogador('confirmed')])).toBe('confirmed');
  });

  it('cai para a lista de times quando não há jogadores', () => {
    expect(faseDaEscalacao([time('confirmed')], [])).toBe('confirmed');
  });

  it('devolve null quando nenhuma das duas listas tem nada', () => {
    expect(faseDaEscalacao([], [])).toBeNull();
  });

  it('tolera payload ausente sem quebrar', () => {
    expect(faseDaEscalacao(undefined, undefined)).toBeNull();
    expect(faseDaEscalacao(null, null)).toBeNull();
  });

  it('ignora fase vazia ou nula dentro do item', () => {
    expect(faseDaEscalacao([], [jogador(null)])).toBeNull();
    expect(faseDaEscalacao([], [jogador('')])).toBeNull();
  });

  it('não inventa fase desconhecida: devolve o que veio', () => {
    // Se a fonte passar a publicar uma terceira fase, a tela não deve fingir
    // que é uma das duas conhecidas — quem decide o rótulo é rotuloEscalacao.
    expect(faseDaEscalacao([], [jogador('probable')])).toBe('probable');
  });
});

describe('escalacaoExibida', () => {
  // Esta é a regra que impede o card de dizer "Escalação confirmada" e mostrar
  // ao lado a formação do registro pós-jogo. No banco isso acontece em 139 dos
  // 8.071 jogos com as duas listas, e SEMPRE na mesma direção: jogadores
  // confirmados e times do pós-jogo. Zero no sentido inverso.
  const t = (fase: string) => ({ lineup_phase: fase, formation: `f-${fase}` });
  const j = (fase: string) => ({ lineup_phase: fase, player_name: `p-${fase}` });

  it('quando as duas listas concordam, devolve as duas inteiras', () => {
    const r = escalacaoExibida([t('confirmed')], [j('confirmed')]);
    expect(r.fase).toBe('confirmed');
    expect(r.times).toHaveLength(1);
    expect(r.jogadores).toHaveLength(1);
  });

  it('quando discordam, a fase é a dos jogadores e a lista de times sai VAZIA', () => {
    // É o caso dos 139 jogos. Melhor não mostrar formação nenhuma do que
    // mostrar a formação de uma fase diferente da que o título anuncia.
    const r = escalacaoExibida([t('real')], [j('confirmed')]);
    expect(r.fase).toBe('confirmed');
    expect(r.times).toEqual([]);
    expect(r.jogadores).toHaveLength(1);
  });

  it('sem jogadores, cai para a fase dos times e devolve os times', () => {
    const r = escalacaoExibida([t('confirmed')], []);
    expect(r.fase).toBe('confirmed');
    expect(r.times).toHaveLength(1);
    expect(r.jogadores).toEqual([]);
  });

  it('sem nada, devolve fase nula e duas listas vazias', () => {
    const r = escalacaoExibida([], []);
    expect(r).toEqual({ fase: null, times: [], jogadores: [] });
  });

  it('tolera payload ausente', () => {
    expect(escalacaoExibida(undefined, undefined)).toEqual({ fase: null, times: [], jogadores: [] });
  });

  it('descarta item de fase divergente dentro da mesma lista', () => {
    // Defesa contra a RPC um dia deixar de garantir uma fase só por lista.
    const r = escalacaoExibida([t('confirmed'), t('real')], [j('confirmed')]);
    expect(r.times).toHaveLength(1);
    expect(r.times[0].lineup_phase).toBe('confirmed');
  });
});

describe('rotuloEscalacao', () => {
  it('escalação confirmada diz que foi anunciada antes do jogo', () => {
    expect(rotuloEscalacao('confirmed', false)).toEqual({
      titulo: 'Escalação confirmada',
      subtitulo: 'anunciada antes do jogo',
    });
  });

  it('a confirmada continua sendo confirmada depois do apito', () => {
    // Ela não vira "quem entrou em campo" só porque o jogo começou: são
    // registros diferentes, e a confirmada segue sendo o que foi anunciado.
    expect(rotuloEscalacao('confirmed', true).titulo).toBe('Escalação confirmada');
  });

  it('escalação real diz que é registro do jogo', () => {
    expect(rotuloEscalacao('real', true)).toEqual({
      titulo: 'Quem entrou em campo',
      subtitulo: 'registro do jogo',
    });
  });

  it('sem escalação e jogo por vir: diz que ainda não saiu e quando costuma sair', () => {
    expect(rotuloEscalacao(null, false)).toEqual({
      titulo: 'Escalação ainda não anunciada',
      subtitulo: 'costuma sair cerca de 1h antes',
    });
  });

  it('sem escalação e jogo encerrado: diz que não foi registrada, sem prometer nada', () => {
    // Não pode prometer "sai 1h antes" num jogo que já acabou.
    expect(rotuloEscalacao(null, true)).toEqual({
      titulo: 'Escalação não registrada',
      subtitulo: null,
    });
  });

  it('nunca usa a palavra "provável"', () => {
    // Escalação provável não existe: a fonte não publica previsão de escalação
    // em momento nenhum. O rótulo antigo da tela prometia isso.
    const todos = [
      rotuloEscalacao('confirmed', false),
      rotuloEscalacao('real', true),
      rotuloEscalacao(null, false),
      rotuloEscalacao(null, true),
    ];
    for (const r of todos) {
      expect(`${r.titulo} ${r.subtitulo ?? ''}`.toLowerCase()).not.toContain('prov');
    }
  });

  it('fase desconhecida cai no caso conservador em vez de mentir', () => {
    expect(rotuloEscalacao('probable', false).titulo).toBe('Escalação ainda não anunciada');
    expect(rotuloEscalacao('probable', true).titulo).toBe('Escalação não registrada');
  });
});
