import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FutebolLP from './FutebolLP';

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/hooks/use-scroll-depth-pixel', () => ({ useScrollDepthPixel: () => undefined }));
vi.mock('@/components/Seo', () => ({ Seo: () => null }));

// A landing é de futebol: quem se cadastra por aqui tem que terminar no futebol,
// não no hub. O recado de destino viaja na query, então ele é parte da asserção.
const RECADO = {
  from: { pathname: '/onboarding', search: '?src=lp-futebol&return=%2Ffutebol' },
};

describe('FutebolLP — para onde o CTA manda', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
  });

  it('o CTA do cadastro carrega o onboarding do futebol como destino', async () => {
    render(
      <MemoryRouter>
        <FutebolLP />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: /Criar conta — 48 horas grátis/i }));

    expect(mocks.navigate).toHaveBeenCalledWith('/auth', { state: RECADO });
  });

  // São três CTAs de cadastro na página (topo, meio e fecho) e todos passam pelo
  // mesmo lugar. O teste percorre os três: um que ficasse para trás mandaria a
  // pessoa para o hub sem ninguém perceber.
  it('os três CTAs de cadastro mandam o mesmo recado', async () => {
    render(
      <MemoryRouter>
        <FutebolLP />
      </MemoryRouter>,
    );

    const ctas = screen.getAllByRole('button', {
      name: /Começar Grátis|Criar conta — 48 horas grátis|Começar grátis/i,
    });
    expect(ctas).toHaveLength(3);

    for (const cta of ctas) {
      mocks.navigate.mockReset();
      await userEvent.click(cta);
      expect(mocks.navigate).toHaveBeenCalledWith('/auth', { state: RECADO });
    }
  });
});
