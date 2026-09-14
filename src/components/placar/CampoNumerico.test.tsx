import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampoNumerico } from './CampoNumerico';
import { parseNumero } from './placar-formato';

// ============================================================================
// O campo que aceita fração
// ============================================================================
// Este arquivo existe por causa de um defeito que foi para a tela: os campos
// eram `<input type="number">` controlados direto pelo número, e a cada tecla o
// valor voltava convertido. Ao digitar "0,5" o estado intermediário "0," não é
// número, virava 0 e apagava a vírgula — então NÃO DAVA para digitar meia
// unidade. O sócio tentou e não conseguiu.
// ============================================================================

describe('parseNumero', () => {
  it('aceita vírgula e ponto', () => {
    expect(parseNumero('0,5')).toBe(0.5);
    expect(parseNumero('0.5')).toBe(0.5);
    expect(parseNumero('2')).toBe(2);
  });

  it('aceita o menos tipográfico, que é o que a tela mostra', () => {
    expect(parseNumero('−2,5')).toBe(-2.5);
    expect(parseNumero('-2,5')).toBe(-2.5);
  });

  it('devolve nulo enquanto o texto ainda não é número', () => {
    // São os estados intermediários de quem está digitando. Tratá-los como zero
    // é exatamente o defeito que este campo conserta.
    expect(parseNumero('')).toBeNull();
    expect(parseNumero('-')).toBeNull();
    expect(parseNumero('.')).toBeNull();
    expect(parseNumero('abc')).toBeNull();
  });
});

describe('CampoNumerico', () => {
  it('deixa digitar meia unidade, com vírgula', async () => {
    const aoMudar = vi.fn();
    render(<CampoNumerico aria="Unidades" valor={1} aoMudar={aoMudar} minimo={0} maximo={5} />);

    const campo = screen.getByLabelText('Unidades');
    await userEvent.clear(campo);
    await userEvent.type(campo, '0,5');

    expect(campo).toHaveValue('0,5');
    expect(aoMudar).toHaveBeenLastCalledWith(0.5);
  });

  it('e com ponto também', async () => {
    const aoMudar = vi.fn();
    render(<CampoNumerico aria="Unidades" valor={1} aoMudar={aoMudar} minimo={0} maximo={5} />);

    const campo = screen.getByLabelText('Unidades');
    await userEvent.clear(campo);
    await userEvent.type(campo, '0.75');

    expect(aoMudar).toHaveBeenLastCalledWith(0.75);
  });

  it('não deixa passar do limite', async () => {
    const aoMudar = vi.fn();
    render(<CampoNumerico aria="Unidades" valor={1} aoMudar={aoMudar} minimo={0} maximo={5} />);

    const campo = screen.getByLabelText('Unidades');
    await userEvent.clear(campo);
    await userEvent.type(campo, '9');

    expect(aoMudar).toHaveBeenLastCalledWith(5);
  });

  it('texto inválido volta ao último número bom quando sai do campo', async () => {
    const aoMudar = vi.fn();
    render(<CampoNumerico aria="Unidades" valor={1} aoMudar={aoMudar} />);

    const campo = screen.getByLabelText('Unidades');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'x');
    await userEvent.tab();

    expect(campo).toHaveValue('1');
  });

  it('o valor negativo aparece com vírgula, como o produto escreve', () => {
    render(<CampoNumerico aria="Valor" valor={-2.5} aoMudar={() => {}} />);
    expect(screen.getByLabelText('Valor')).toHaveValue('-2,5');
  });
});
