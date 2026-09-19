import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LpVariant from './LpVariant';

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useParams: () => ({ slug: 'mais-clareza' }),
  };
});

vi.mock('@posthog/react', () => ({ usePostHog: () => null }));
vi.mock('@/components/Seo', () => ({ Seo: () => null }));
vi.mock('@/components/AnalyticsNav', () => ({ default: () => null }));

// Antes estas quatro LPs mandavam a pessoa direto pro produto, pulando o
// onboarding inteiro — e com isso ninguém de tráfego pago conectava o Telegram.
// Agora seguem o mesmo caminho da landing indexada.
const RECADO = {
  from: { pathname: '/onboarding', search: '?src=lp-futebol&return=%2Ffutebol' },
};

describe('LpVariant — para onde o CTA manda', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
  });

  it('o CTA passa pelo onboarding em vez de pular direto pro produto', async () => {
    render(
      <MemoryRouter initialEntries={['/lp/mais-clareza']}>
        <LpVariant />
      </MemoryRouter>,
    );

    const ctas = await screen.findAllByRole('button', { name: /Quero testar 48 horas grátis/i });
    await userEvent.click(ctas[0]);

    expect(mocks.navigate).toHaveBeenCalledWith('/auth', { state: RECADO });
  });
});
