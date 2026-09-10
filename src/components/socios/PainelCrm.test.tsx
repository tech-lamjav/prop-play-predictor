import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PainelCrm } from './PainelCrm';

describe('PainelCrm', () => {
  it('mostra quantos cadastros a base tem', () => {
    render(<PainelCrm contagem={{ estado: 'pronta', total: 603 }} />);
    expect(screen.getByRole('heading', { name: /CRM/i })).toBeInTheDocument();
    expect(screen.getByText('603')).toBeInTheDocument();
  });

  it('enquanto conta, não mostra zero', () => {
    // Zero é uma resposta possível e assustadora: um painel que pisca "0
    // cadastros" antes de carregar parece base vazia, não tela carregando.
    render(<PainelCrm contagem={{ estado: 'contando' }} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('base vazia é dita com palavra, não com um zero solto', () => {
    render(<PainelCrm contagem={{ estado: 'pronta', total: 0 }} />);
    expect(screen.getByText(/nenhum cadastro/i)).toBeInTheDocument();
  });

  it('quando a consulta falha, diz que falhou em vez de fingir base vazia', () => {
    // Com `total` e `carregando` soltos, o erro caía na combinação sem
    // significado e a tela desenhava vazio: a base parecia sumida.
    render(<PainelCrm contagem={{ estado: 'erro' }} />);
    expect(screen.getByText(/não deu para contar/i)).toBeInTheDocument();
    expect(screen.queryByText(/nenhum cadastro/i)).not.toBeInTheDocument();
  });
});
