import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FutebolAccess } from '@/services/futebol-data.service';
import { useFutebolAccess } from '@/hooks/use-futebol-data';
import { FutebolAccessBanner, FutebolTrialChip } from './FutebolGate';

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('@/hooks/use-futebol-data', () => ({ useFutebolAccess: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));

const hook = vi.mocked(useFutebolAccess);

// ============================================================================
// Cadastro feito de DENTRO do futebol
// ============================================================================
// Quem clica em "Espiar sem login" na landing cai numa tela do futebol e se
// cadastra por aqui, não pela landing. Sem o destino viajando junto, essa
// pessoa terminava no hub — o mesmo atrito que as landings deixaram de ter.
// A origem é `gate-futebol`, e não `lp-futebol`, porque ela não veio de uma
// landing: juntar as duas etiquetas apagaria essa diferença no funil.
// ============================================================================

const RECADO = {
  state: { from: { pathname: '/onboarding', search: '?src=gate-futebol&return=%2Ffutebol' } },
};

/** Um acesso no estado pedido; os componentes só leem `state`. */
const acesso = (state: FutebolAccess['state']) =>
  ({ state, unlocked: false, days_left: 0, hours_left: 0, trial_ends_at: null }) as unknown as FutebolAccess;

describe('FutebolGate — cadastro a partir do futebol', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    hook.mockReset();
  });

  it('a pílula do cabeçalho leva o destino do futebol para o cadastro', async () => {
    hook.mockReturnValue({ data: acesso('anon') } as ReturnType<typeof useFutebolAccess>);
    render(<FutebolTrialChip />);

    await userEvent.click(screen.getByRole('button', { name: /48 horas grátis/i }));

    expect(mocks.navigate).toHaveBeenCalledWith('/auth', RECADO);
  });

  it('a faixa de acesso leva o mesmo destino', async () => {
    render(<FutebolAccessBanner access={acesso('anon')} />);

    await userEvent.click(screen.getByRole('button', { name: /Criar conta grátis/i }));

    expect(mocks.navigate).toHaveBeenCalledWith('/auth', RECADO);
  });

  // Regressão: mexi nestas duas linhas, e o caminho de quem JÁ teve conta não
  // pode ter mudado junto. Assinar não é cadastrar, e não leva destino nenhum.
  it('quem já testou continua indo para a assinatura, sem destino pendurado', async () => {
    render(<FutebolAccessBanner access={acesso('expired')} />);

    await userEvent.click(screen.getByRole('button', { name: /Assinar Futebol/i }));

    expect(mocks.navigate).toHaveBeenCalledWith('/futebol/assinar');
  });
});
