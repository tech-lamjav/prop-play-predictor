import { describe, expect, it } from 'vitest';
import { escalacaoDoTime, ultimoJogoDoTime } from './futebol-escalacao-referencia';
import type { FutebolFormResult } from '@/services/futebol-data.service';

const jogo = (fixture_id: number, date_utc: string): FutebolFormResult => ({
  fixture_id,
  date_utc,
  opponent: 'Adversário',
  side: 'home',
  goals_for: 1,
  goals_against: 0,
  result: 'W',
});

describe('o último jogo do time', () => {
  it('é o mais recente por data, e não o primeiro da lista', () => {
    // A ordem da RPC não é contrato nosso. Confiar nela deixaria a tela mostrar
    // uma escalação de três jogos atrás sem nada acusando.
    const form = [jogo(1, '2026-08-16T00:00:00Z'), jogo(3, '2026-08-30T00:00:00Z'), jogo(2, '2026-08-24T00:00:00Z')];

    expect(ultimoJogoDoTime(form)?.fixture_id).toBe(3);
  });

  it('sem histórico, não há último jogo', () => {
    expect(ultimoJogoDoTime([])).toBeNull();
    expect(ultimoJogoDoTime(undefined)).toBeNull();
  });
});

describe('a escalação de um time noutro jogo', () => {
  const doOutroJogo = [
    { team_id: 120, team_side: 'away' as const, player_name: 'Zagueiro' },
    { team_id: 120, team_side: 'away' as const, player_name: 'Atacante' },
    { team_id: 127, team_side: 'home' as const, player_name: 'Adversário' },
  ];

  it('traz só os jogadores daquele time', () => {
    expect(escalacaoDoTime(doOutroJogo, 120, 'home')).toHaveLength(2);
  });

  it('reetiqueta o lado para o lado DESTE jogo', () => {
    // O Botafogo jogou como visitante na rodada passada e é mandante agora. Sem
    // reetiquetar, ele seria desenhado na metade do adversário — e o `grid` da
    // fonte é sempre relativo ao próprio ataque, então a posição continua certa.
    const remapeados = escalacaoDoTime(doOutroJogo, 120, 'home');

    expect(remapeados.every((p) => p.team_side === 'home')).toBe(true);
  });

  it('não altera a lista original', () => {
    escalacaoDoTime(doOutroJogo, 120, 'home');

    expect(doOutroJogo[0].team_side).toBe('away');
  });

  it('time ausente daquele jogo devolve lista vazia', () => {
    expect(escalacaoDoTime(doOutroJogo, 999, 'home')).toEqual([]);
  });
});
