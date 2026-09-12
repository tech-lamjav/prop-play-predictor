import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FutebolAccess } from '@/services/futebol-data.service';
import { useFutebolAccess } from '@/hooks/use-futebol-data';
import { FutebolTrialChip } from './FutebolGate';

vi.mock('@/hooks/use-futebol-data', () => ({ useFutebolAccess: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

// ============================================================================
// A pílula do cabeçalho, agora que o teste dura 48 horas
// ============================================================================
// O que esta suíte trava não é o cálculo — isso é de `tempo-de-teste.ts` e tem
// teste próprio. É a LIGAÇÃO: a pílula lia `days_left` direto do contrato e
// escrevia "Nd" na mão, e com 48 horas isso só conseguia dizer "2d" e depois
// "1d". Se alguém religar a pílula no `days_left`, quebra aqui.
//
// O âmbar também mudou de régua: era "faltam 2 dias ou menos", que num teste de
// 48 horas nasceria âmbar e ficaria âmbar até o fim.
// ============================================================================

const mock = vi.mocked(useFutebolAccess);

/** Um acesso em teste que termina daqui a `h` horas, como o servidor responde. */
function emTeste(h: number, override: Partial<FutebolAccess> = {}): FutebolAccess {
  return {
    state: 'trial',
    unlocked: true,
    days_left: Math.max(0, Math.ceil(h / 24)),
    hours_left: Math.max(0, h),
    trial_ends_at: new Date(Date.now() + h * 3600000).toISOString(),
    ...override,
  };
}

function montar(access: FutebolAccess | undefined) {
  // O hook devolve muito mais que `data`; a pílula só lê isso.
  mock.mockReturnValue({ data: access } as ReturnType<typeof useFutebolAccess>);
  render(<FutebolTrialChip />);
}

const ambar = (el: HTMLElement) => /amber/.test(el.className);

beforeEach(() => {
  mock.mockReset();
});

describe('a pílula durante o teste de 48 horas', () => {
  it('conta em horas, e não em dias', () => {
    montar(emTeste(31));
    const chip = screen.getByRole('button');
    expect(chip).toHaveTextContent('Teste · 31h');
    expect(chip).toHaveAttribute('title', 'Teste grátis · faltam 31 horas');
  });

  it('nasce dizendo 48h', () => {
    montar(emTeste(48));
    expect(screen.getByRole('button')).toHaveTextContent('Teste · 48h');
  });

  it('na última hora fala no singular', () => {
    montar(emTeste(1));
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Teste grátis · falta 1 hora');
  });

  it('não anuncia zero para quem ainda tem acesso', () => {
    montar(emTeste(0));
    expect(screen.getByRole('button')).toHaveTextContent('Teste · <1h');
  });
});

describe('o âmbar da última reta', () => {
  it('fica neutra com um dia e meio pela frente', () => {
    montar(emTeste(36));
    expect(ambar(screen.getByRole('button'))).toBe(false);
  });

  it('vira âmbar nas últimas doze horas', () => {
    montar(emTeste(12));
    expect(ambar(screen.getByRole('button'))).toBe(true);
  });

  it('não nasce âmbar num teste de 48 horas', () => {
    // A régua antiga era "2 dias ou menos". Com 48 horas ela acenderia no
    // primeiro segundo e o aviso não avisaria nada.
    montar(emTeste(48));
    expect(ambar(screen.getByRole('button'))).toBe(false);
  });
});

describe('a coorte que ainda tem 7 dias', () => {
  it('continua vendo dias, porque 161 horas não é informação', () => {
    montar(emTeste(24 * 7));
    expect(screen.getByRole('button')).toHaveTextContent('Teste · 7d');
  });

  it('e também chega no âmbar quando o fim se aproxima', () => {
    montar(emTeste(5));
    expect(ambar(screen.getByRole('button'))).toBe(true);
  });
});

describe('quando não há pílula para mostrar', () => {
  it('assinante não vê nada', () => {
    montar({ state: 'subscribed', unlocked: true, days_left: null, hours_left: null, trial_ends_at: null });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('sem resposta do servidor, nada', () => {
    montar(undefined);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('em teste mas sem tempo apurável, nada — em vez de uma pílula vazia', () => {
    montar(emTeste(0, { hours_left: null, trial_ends_at: null }));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('expirado troca a pílula pelo CTA de assinar', () => {
    montar({ state: 'expired', unlocked: false, days_left: 0, hours_left: 0, trial_ends_at: null });
    expect(screen.getByRole('button')).toHaveTextContent('Assinar Futebol');
  });

  it('deslogado convida com as 48 horas', () => {
    montar({ state: 'anon', unlocked: false, days_left: null, hours_left: null, trial_ends_at: null });
    expect(screen.getByRole('button')).toHaveTextContent('48 horas grátis');
  });
});
