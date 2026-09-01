import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import FutebolDayStepper from './FutebolDayStepper';

describe('FutebolDayStepper', () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T15:00:00Z'));
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    scrollIntoView.mockReset();
  });

  it('posiciona o dia selecionado imediatamente na primeira abertura', () => {
    render(
      <FutebolDayStepper
        days={['2026-07-28', '2026-08-11', '2026-08-26', '2026-08-27']}
        value="2026-08-26"
        onChange={vi.fn()}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({
      inline: 'center',
      behavior: 'auto',
    }));
  });

  it('mantém o atalho Hoje dentro da régua rolável sem alargar a página', () => {
    const { container } = render(
      <FutebolDayStepper
        days={['2026-08-25', '2026-08-26', '2026-08-27']}
        value="2026-08-25"
        onChange={vi.fn()}
      />,
    );

    const previous = container.querySelector('button[aria-label="Dia anterior"]');
    const rail = previous?.nextElementSibling;

    expect(rail).toHaveClass('min-w-0', 'flex-1');
  });
});
