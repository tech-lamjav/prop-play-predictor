import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LpVariant from './LpVariant';
import { LP_VARIANTS } from './variants';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), slug: '' }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useParams: () => ({ slug: mocks.slug }),
  };
});

vi.mock('@posthog/react', () => ({ usePostHog: () => null }));
vi.mock('@/components/Seo', () => ({ Seo: () => null }));
vi.mock('@/components/AnalyticsNav', () => ({ default: () => null }));

// Antes estas LPs mandavam a pessoa direto pro produto, pulando o onboarding
// inteiro — e com isso ninguém de tráfego pago conectava o Telegram. Agora
// seguem o mesmo caminho da landing indexada: cadastro, onboarding, futebol.
const RECADO = {
  from: { pathname: '/onboarding', search: '?src=lp-futebol&return=%2Ffutebol' },
};

// As três posições de CTA de cada LP: o topo, o bloco de oferta e a barra fixa
// do celular. A barra fixa é escondida por CSS — fica deslocada para fora da
// tela — e não removida do HTML, por isso ela conta aqui sem simular rolagem.
const CTAS_POR_PAGINA = 3;

describe('LpVariant — todo CTA de cadastro termina no futebol', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
  });

  // A lista vem do registry de verdade, não de uma cópia: quando alguém criar a
  // quinta LP (o plano diz que é copiar um objeto), ela já nasce coberta aqui.
  it('o registry tem LP para percorrer', () => {
    // Sem isto, um registry vazio faria o `it.each` abaixo não rodar teste
    // nenhum e a suíte passaria verde sem ter verificado uma linha.
    expect(LP_VARIANTS.length).toBeGreaterThanOrEqual(4);
  });

  it.each(LP_VARIANTS.map((v) => [v.slug, v] as const))(
    '/lp/%s: os CTAs todos passam pelo onboarding e terminam no futebol',
    async (slug, variant) => {
      mocks.slug = slug;

      render(
        <MemoryRouter initialEntries={[`/lp/${slug}`]}>
          <LpVariant />
        </MemoryRouter>,
      );

      const ctas = await screen.findAllByRole('button', { name: variant.cta.label });
      expect(ctas).toHaveLength(CTAS_POR_PAGINA);

      // Um por um: dois CTAs ligados e um esquecido mandariam parte do tráfego
      // pago para o hub, e clicar só no primeiro nunca mostraria isso.
      for (const cta of ctas) {
        mocks.navigate.mockReset();
        await userEvent.click(cta);
        expect(mocks.navigate).toHaveBeenCalledWith('/auth', { state: RECADO });
      }
    },
  );
});
