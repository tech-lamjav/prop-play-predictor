import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FichaEmModal } from './FichaEmModal';

// ============================================================================
// A ficha abre POR CIMA da lista
// ============================================================================
// A primeira versão era uma página separada, e abrir um lead tirava o sócio da
// lista. O trabalho é abrir, registrar, fechar, abrir o próximo — e com página
// separada cada lead custava sair e voltar.
//
// O formato saiu de um protótipo de três variações. Estes testes guardam o que
// a decisão tem de estrutural: abre por cima, fecha voltando, e não monta nada
// enquanto ninguém abriu ninguém.
// ============================================================================

describe('FichaEmModal', () => {
  it('fechada, não desenha o conteúdo', () => {
    render(
      <FichaEmModal aberta={false} aoFechar={vi.fn()}>
        <p>a ficha</p>
      </FichaEmModal>,
    );
    expect(screen.queryByText('a ficha')).not.toBeInTheDocument();
  });

  it('aberta, desenha por cima', () => {
    render(
      <FichaEmModal aberta aoFechar={vi.fn()}>
        <p>a ficha</p>
      </FichaEmModal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('a ficha')).toBeInTheDocument();
  });

  it('tem nome para quem navega por teclado', () => {
    // Sem título acessível, quem usa leitor de tela não sabe o que abriu — e o
    // Radix reclama no console, que é o aviso que costuma ser ignorado.
    render(
      <FichaEmModal aberta aoFechar={vi.fn()}>
        <p>a ficha</p>
      </FichaEmModal>,
    );
    expect(screen.getByRole('dialog', { name: /ficha do lead/i })).toBeInTheDocument();
  });

  it('fechar avisa quem cuida da rota', async () => {
    // Quem fecha não é o modal: é a navegação de volta para a lista. É isso que
    // mantém o endereço compartilhável e faz o botão voltar do navegador
    // funcionar sem código nenhum.
    const aoFechar = vi.fn();
    render(
      <FichaEmModal aberta aoFechar={aoFechar}>
        <p>a ficha</p>
      </FichaEmModal>,
    );
    await userEvent.keyboard('{Escape}');
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('abrir não dispara fechamento', () => {
    const aoFechar = vi.fn();
    render(
      <FichaEmModal aberta aoFechar={aoFechar}>
        <p>a ficha</p>
      </FichaEmModal>,
    );
    expect(aoFechar).not.toHaveBeenCalled();
  });
});
