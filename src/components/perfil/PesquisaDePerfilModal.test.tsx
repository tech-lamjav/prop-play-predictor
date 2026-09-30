import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PesquisaDePerfilModal } from './PesquisaDePerfilModal';
import { ABERTURAS } from '@/utils/perfil-declarado';

// ============================================================================
// O que é regra, e não desenho
// ============================================================================
// Cor, espaçamento e ícone mudam sem aviso e não entram aqui. O que entra é o
// que foi decidido e pode regredir calado: as duas aberturas, o envio que não
// aceita meia resposta, e as saídas — que são DUAS, e o clique fora não é uma
// delas.
// ============================================================================

function montar(overrides: Partial<Parameters<typeof PesquisaDePerfilModal>[0]> = {}) {
  const props = {
    open: true,
    abertura: 'chegada' as const,
    onResponder: vi.fn(),
    onPular: vi.fn(),
    ...overrides,
  };
  render(<PesquisaDePerfilModal {...props} />);
  return props;
}

describe('a abertura', () => {
  it('quem acabou de chegar vê o convite de entrada', () => {
    montar({ abertura: 'chegada' });
    expect(screen.getByText(ABERTURAS.chegada)).toBeInTheDocument();
  });

  it('quem já usava vê a explicação de por que estão perguntando agora', () => {
    montar({ abertura: 'base' });
    expect(screen.getByText(ABERTURAS.base)).toBeInTheDocument();
  });
});

describe('as duas perguntas', () => {
  it('cabem na mesma tela', () => {
    montar();
    expect(screen.getByText('O que você mais quer conseguir com a Smart Betting?')).toBeInTheDocument();
    expect(screen.getByText('Com que frequência você aposta hoje?')).toBeInTheDocument();
  });

  it('cada uma oferece quatro opções', () => {
    montar();
    expect(screen.getAllByRole('radio')).toHaveLength(8);
  });
});

describe('o envio', () => {
  it('começa desabilitado, porque meia resposta não serve', () => {
    montar();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('continua desabilitado com só uma pergunta respondida', async () => {
    const usuario = userEvent.setup();
    montar();

    await usuario.click(screen.getByRole('radio', { name: 'Economizar tempo na análise' }));

    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('libera quando as duas estão respondidas', async () => {
    const usuario = userEvent.setup();
    montar();

    await usuario.click(screen.getByRole('radio', { name: 'Economizar tempo na análise' }));
    await usuario.click(screen.getByRole('radio', { name: 'Toda semana' }));

    expect(screen.getByRole('button', { name: /enviar/i })).toBeEnabled();
  });

  it('devolve os códigos, e não o texto da tela', async () => {
    const usuario = userEvent.setup();
    const props = montar();

    await usuario.click(screen.getByRole('radio', { name: 'Economizar tempo na análise' }));
    await usuario.click(screen.getByRole('radio', { name: 'Toda semana' }));
    await usuario.click(screen.getByRole('button', { name: /enviar/i }));

    expect(props.onResponder).toHaveBeenCalledWith({
      objetivo: 'economizar_tempo',
      frequencia: 'toda_semana',
    });
  });

  it('trocar de opção na mesma pergunta substitui, não soma', async () => {
    const usuario = userEvent.setup();
    const props = montar();

    await usuario.click(screen.getByRole('radio', { name: 'Economizar tempo na análise' }));
    await usuario.click(screen.getByRole('radio', { name: 'Receber oportunidades prontas' }));
    await usuario.click(screen.getByRole('radio', { name: 'Toda semana' }));
    await usuario.click(screen.getByRole('button', { name: /enviar/i }));

    expect(props.onResponder).toHaveBeenCalledWith({
      objetivo: 'oportunidades_prontas',
      frequencia: 'toda_semana',
    });
  });
});

describe('as saídas', () => {
  it('pular é uma delas', async () => {
    const usuario = userEvent.setup();
    const props = montar();

    await usuario.click(screen.getByRole('button', { name: /pular/i }));

    expect(props.onPular).toHaveBeenCalledTimes(1);
  });

  // Decisão explícita: a pesquisa é adiável e não dispensável, e adiar é um ato
  // deliberado. Clique fora por acidente não pode custar a pergunta, e um X no
  // canto seria uma terceira saída fazendo o quê — nem responder, nem adiar.
  it('clicar fora não é', () => {
    // `fireEvent` e não `userEvent`: o Radix desliga os eventos de ponteiro do
    // resto da página enquanto a caixa está aberta, e o userEvent se recusa a
    // clicar no que está desligado. O evento cru chega ao ouvinte de "interagiu
    // fora", que é exatamente o que este teste cobra.
    const props = montar();

    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);

    expect(props.onPular).not.toHaveBeenCalled();
    expect(props.onResponder).not.toHaveBeenCalled();
    expect(screen.getByText(ABERTURAS.chegada)).toBeInTheDocument();
  });

  it('o Esc também não é', async () => {
    const usuario = userEvent.setup();
    const props = montar();

    await usuario.keyboard('{Escape}');

    expect(props.onPular).not.toHaveBeenCalled();
    expect(props.onResponder).not.toHaveBeenCalled();
    expect(screen.getByText(ABERTURAS.chegada)).toBeInTheDocument();
  });

  it('não sobra um X no canto fazendo uma terceira coisa', () => {
    montar();
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });
});

describe('fechada', () => {
  it('não desenha nada', () => {
    montar({ open: false });
    expect(screen.queryByText(ABERTURAS.chegada)).not.toBeInTheDocument();
  });
});
