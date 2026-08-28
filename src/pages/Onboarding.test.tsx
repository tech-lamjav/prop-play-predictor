import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Onboarding from './Onboarding';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  single: vi.fn(async () => ({ data: { telegram_chat_id: null } })),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock('../integrations/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }),
    rpc: vi.fn(),
  }),
}));

vi.mock('@posthog/react', () => ({ usePostHog: () => null }));

vi.mock('embla-carousel-react', () => ({ default: () => [vi.fn(), undefined] }));

vi.mock('../components/AnalyticsNav', () => ({ default: () => null }));

function renderOnboarding(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/onboarding${search}`]}>
      <Onboarding />
    </MemoryRouter>,
  );
}

describe('Onboarding', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.single.mockResolvedValue({ data: { telegram_chat_id: null } });
  });

  it('vindo dos alertas, a introdução fala das novas oportunidades', async () => {
    renderOnboarding('?src=alertas-futebol&return=%2Ffutebol%2Foportunidades');

    expect(await screen.findByText('Alertas de oportunidades')).toBeInTheDocument();
    expect(screen.getByText(/Receba as novas oportunidades no/i)).toBeInTheDocument();
    // Os demais benefícios e a mecânica de conexão continuam iguais.
    expect(screen.getByText('Registra pelo print')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Conectar meu Telegram/i })).toBeInTheDocument();
  });

  it('sem origem, mantém o onboarding genérico', async () => {
    renderOnboarding();

    expect(await screen.findByText('Conheça o Betinho')).toBeInTheDocument();
    expect(screen.getByText(/Seu assistente de apostas/i)).toBeInTheDocument();
  });

  it('pular volta para a tela de origem permitida', async () => {
    renderOnboarding('?src=alertas-futebol&return=%2Ffutebol%2Foportunidades');

    await userEvent.click(await screen.findByRole('button', { name: 'Pular por agora' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/futebol/oportunidades');
  });

  it('destino de retorno inválido cai na rota segura', async () => {
    renderOnboarding('?src=alertas-futebol&return=https%3A%2F%2Fevil.com');

    await userEvent.click(await screen.findByRole('button', { name: 'Pular por agora' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/inicio');
  });

  it('quem já tem Telegram conectado é levado direto ao destino', async () => {
    mocks.single.mockResolvedValue({ data: { telegram_chat_id: '123' } });
    renderOnboarding('?src=alertas-futebol&return=%2Ffutebol%2Foportunidades');

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith('/futebol/oportunidades', { replace: true }),
    );
  });

  it('regressão: já conectado sem origem continua indo para o hub', async () => {
    mocks.single.mockResolvedValue({ data: { telegram_chat_id: '123' } });
    renderOnboarding();

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/inicio', { replace: true }));
  });
});
