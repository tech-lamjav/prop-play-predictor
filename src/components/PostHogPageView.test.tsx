import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';

// ============================================================================
// Um `$pageview` por mudança REAL de rota
// ============================================================================
// O PostHog é iniciado com `capture_pageview: false`, porque numa SPA o
// pageview automático só dispara no primeiro carregamento — toda navegação
// seguinte é troca de componente, não de documento. Quem conta é este
// componente.
//
// A versão anterior dependia do objeto `location` INTEIRO, que nasce novo a
// cada navegação — inclusive nas que não mudam de página. Um
// `navigate(mesmaRota, { replace: true })` produzia outro objeto com o mesmo
// `pathname`, e a tela contava um pageview a mais. A régua de dias do futebol
// faz exatamente isso o tempo todo.
// ============================================================================

const { posthogMock, configMock } = vi.hoisted(() => ({
  posthogMock: { capture: vi.fn() },
  configMock: { posthog: { key: 'fake-key' as string | undefined, host: 'https://h' } },
}));

vi.mock('posthog-js', () => ({ default: posthogMock }));
vi.mock('@/config/environment', () => ({ config: configMock }));

import { PostHogPageView } from './PostHogPageView';

function Navegador({ para, rotulo }: { para: string; rotulo: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(para)}>
      {rotulo}
    </button>
  );
}

function montar() {
  return render(
    <MemoryRouter initialEntries={['/futebol']}>
      <PostHogPageView />
      <Navegador para="/futebol/jogos" rotulo="ir para jogos" />
      <Navegador para="/futebol" rotulo="voltar" />
      <Navegador para="/futebol?dia=2026-09-19" rotulo="trocar o dia" />
    </MemoryRouter>,
  );
}

const pageviews = () =>
  posthogMock.capture.mock.calls.filter(([nome]) => nome === '$pageview');

beforeEach(() => {
  vi.clearAllMocks();
  configMock.posthog.key = 'fake-key';
});

describe('PostHogPageView', () => {
  it('conta a primeira visualização', () => {
    montar();
    expect(pageviews()).toHaveLength(1);
    expect(pageviews()[0][1].path).toBe('/futebol');
  });

  it('conta a mudança de rota', async () => {
    montar();
    await userEvent.click(botao('ir para jogos'));

    expect(pageviews()).toHaveLength(2);
    expect(pageviews()[1][1].path).toBe('/futebol/jogos');
  });

  it('navegar para o MESMO endereço não conta de novo', async () => {
    // É o caso do `replace` para a rota atual: o objeto `location` é novo, o
    // endereço não. Era aqui que a contagem inflava.
    montar();
    await userEvent.click(botao('voltar'));

    expect(pageviews()).toHaveLength(1);
  });

  it('trocar a query conta, porque é outra visualização', async () => {
    // A régua de dias reescreve a query sem sair da rota, e o dia faz parte do
    // que a pessoa está vendo.
    montar();
    await userEvent.click(botao('trocar o dia'));

    expect(pageviews()).toHaveLength(2);
  });

  it('com o PostHog desligado, não captura nada', () => {
    configMock.posthog.key = undefined;
    montar();
    expect(posthogMock.capture).not.toHaveBeenCalled();
  });
});

/** O botão pelo nome acessível, como o resto da suíte faz. */
const botao = (rotulo: string) => screen.getByRole('button', { name: rotulo });
