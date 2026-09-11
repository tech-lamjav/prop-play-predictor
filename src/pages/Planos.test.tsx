import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Planos from './Planos';

/**
 * O que este arquivo protege: cada plano leva à paywall do produto que ele
 * vende. Errar o destino aqui não quebra a tela — o usuário compra outro
 * produto, e a gente só descobre pelo suporte.
 *
 * Também guarda os dois botões que devem ficar DESABILITADOS: o Completo (o
 * preço não existe no Stripe) e qualquer plano no modo anual (idem). Botão
 * que leva a uma tela cobrando valor diferente do anunciado é pior que botão
 * desabilitado.
 */

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: 'user-1' }, isLoading: false }) }));
vi.mock('@/components/AnalyticsNav', () => ({ default: () => null }));
vi.mock('@/components/Seo', () => ({ Seo: () => null, SITE_URL: 'https://www.smartbetting.app' }));

const montar = () => render(<Planos />, { wrapper: MemoryRouter });

/** O botão de assinatura de um plano, achado pelo rótulo visível. */
const botao = (nome: string | RegExp) => screen.getByRole('button', { name: nome });

beforeEach(() => mocks.navigate.mockClear());

describe('CTAs dos planos (mensal)', () => {
  it('Entrada leva à paywall do Betinho', async () => {
    montar();
    await userEvent.click(botao('Assinar Entrada'));
    expect(mocks.navigate).toHaveBeenCalledWith('/paywall');
  });

  it('Essencial leva à tela de assinatura do Futebol', async () => {
    montar();
    await userEvent.click(botao('Assinar Essencial'));
    expect(mocks.navigate).toHaveBeenCalledWith('/futebol/assinar');
  });

  it('Completo continua desabilitado — o preço não existe no Stripe', async () => {
    montar();
    const b = botao('Pagamento em breve');
    expect(b).toBeDisabled();
    await userEvent.click(b);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('logado já vê o rótulo de assinar, não mais "Pagamento em breve"', () => {
    montar();
    expect(screen.queryByRole('button', { name: 'Assinar Entrada' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Assinar Essencial' })).toBeTruthy();
  });
});

describe('CTAs no modo anual', () => {
  const irParaAnual = async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: /Anual/i }));
  };

  it('nenhum plano é comprável no anual — os preços anuais não existem', async () => {
    await irParaAnual();
    const emBreve = screen.getAllByRole('button', { name: 'Anual em breve' });
    expect(emBreve).toHaveLength(3);
    for (const b of emBreve) expect(b).toBeDisabled();
  });

  it('clicar no anual não navega para uma tela que cobra mensal', async () => {
    await irParaAnual();
    mocks.navigate.mockClear();
    await userEvent.click(screen.getAllByRole('button', { name: 'Anual em breve' })[0]);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
