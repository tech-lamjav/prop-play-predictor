import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RegistrarApostaModal } from './RegistrarAposta';
import type { FutebolBetDraft } from './registrar-aposta-utils';

// ============================================================================
// O que a pessoa digita não pode sumir sozinho (04/09)
// ============================================================================
// Medido em produção: escolher "½ unidade" no modal, esperar, e o campo voltava
// a 0,00 com o botão desabilitado — sem ninguém tocar em nada.
//
// A causa era o efeito que zera os campos ao abrir: ele dependia do OBJETO
// `draft`, e a lista de oportunidades monta um literal novo a cada render
// (`draftFromBoardRow(o)` dentro do JSX). Como a lista rerenderiza sozinha — o
// relógio da tela avança, o board revalida —, cada rerender apagava o valor.
//
// Registrar aposta pela lista era, na prática, uma corrida contra o próximo
// render. Este teste reproduz o rerender com um draft NOVO e igual.
//
// Os campos são <input type="number">, então o valor esperado é número.
// ============================================================================

vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/hooks/use-user-unit', () => ({ useUserUnit: () => ({ config: { unit_value: 10 } }) }));
vi.mock('@/integrations/supabase/client', () => ({ createClient: () => ({ from: () => ({ insert: async () => ({ error: null }) }) }) }));

const draft = (): FutebolBetDraft => ({
  homeName: 'Lyon',
  awayName: 'Auxerre',
  competition: 'ligue_1',
  kickoffUtc: '2026-09-04T14:00:00Z',
  market: 'goals_over_under',
  outcome: 'Over',
  lineValue: 2.5,
  bestOdd: 1.74,
  oddKind: 'melhor',
});

/**
 * A mesma aposta com outra odd. O tipo do rascunho é união discriminada pela
 * origem da odd, então o campo que discrimina vai escrito por extenso: espalhar
 * o objeto e trocar só a odd apaga a discriminação e o tipo deixa de casar.
 */
const draftComOdd = (bestOdd: number): FutebolBetDraft => ({ ...draft(), bestOdd, oddKind: 'melhor' });

function renderModal(d: FutebolBetDraft) {
  return render(
    <MemoryRouter>
      <RegistrarApostaModal open onOpenChange={vi.fn()} draft={d} />
    </MemoryRouter>,
  );
}

describe('RegistrarApostaModal', () => {
  it('o valor digitado sobrevive a um rerender do pai', async () => {
    const { rerender } = renderModal(draft());

    const valor = screen.getByLabelText(/valor/i);
    await userEvent.clear(valor);
    await userEvent.type(valor, '5');
    expect(valor).toHaveValue(5);

    // O pai rerenderiza e monta OUTRO objeto com os mesmos dados — é o que a
    // lista de oportunidades faz sozinha, sem ninguém mexer na tela.
    rerender(
      <MemoryRouter>
        <RegistrarApostaModal open onOpenChange={vi.fn()} draft={draft()} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/valor/i)).toHaveValue(5);
  });

  it('trocar de aposta zera o valor, que é o que o efeito existe para fazer', async () => {
    const { rerender } = renderModal(draft());

    const valor = screen.getByLabelText(/valor/i);
    await userEvent.type(valor, '5');

    rerender(
      <MemoryRouter>
        <RegistrarApostaModal open onOpenChange={vi.fn()} draft={{ ...draft(), outcome: 'Under' }} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/valor/i)).toHaveValue(null);
  });

  it('preço novo no board não mexe na odd de quem está digitando', async () => {
    // A odd fica fora da chave da aposta: se o board trouxer preço melhor com o
    // modal aberto, o campo não pode trocar embaixo do dedo.
    const { rerender } = renderModal(draft());

    expect(screen.getByLabelText(/odd/i)).toHaveValue(1.74);

    rerender(
      <MemoryRouter>
        <RegistrarApostaModal open onOpenChange={vi.fn()} draft={draftComOdd(1.9)} />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/odd/i)).toHaveValue(1.74);
  });
});
