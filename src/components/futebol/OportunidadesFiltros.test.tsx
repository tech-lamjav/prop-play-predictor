import { describe, expect, it, vi } from 'vitest';
import { configure, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OportunidadesFiltros, type MarketFilter } from './OportunidadesFiltros';
import type { FiltroDeValor } from '@/utils/futebol-score';

const props = {
  mercado: 'all' as MarketFilter,
  onMercadoChange: vi.fn(),
  faixasSelecionadas: ['alta', 'media'] as const,
  onFaixasChange: vi.fn(),
  competicoesSelecionadas: null,
  onCompeticoesChange: vi.fn(),
  competicaoOptions: [{ value: 'brasileirao', label: 'Brasileirão' }],
  valor: 'todos' as FiltroDeValor,
  onValorChange: vi.fn(),
};

// Folga no limite da testing-library, pelo mesmo motivo do Onboarding.test:
// `userEvent` digita caractere a caractere e cada passo espera o React,
// então com a suíte inteira em paralelo o padrão de 1s estoura por saturação
// da máquina, não por regressão. Rodando sozinho, o arquivo leva 2 segundos.
configure({ asyncUtilTimeout: 10_000 });

describe('OportunidadesFiltros', () => {
  it('mantém mercado e filtros de visualização em duas faixas independentes no mobile', () => {
    render(<OportunidadesFiltros {...props} soEmAberto onSoEmAbertoChange={vi.fn()} />);

    expect(screen.getByTestId('filtros-mercado')).toBeInTheDocument();
    expect(screen.getByTestId('filtros-visualizacao')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Só jogos em aberto' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Faixa Alta e Média/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Competição Todas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Valor Todos/i })).toBeInTheDocument();
  });

  // O filtro de valor é seleção ÚNICA: clicar numa opção troca, não acumula.
  it('troca a faixa de valor por seleção única', async () => {
    const onValorChange = vi.fn();
    render(<OportunidadesFiltros {...props} soEmAberto onSoEmAbertoChange={vi.fn()} onValorChange={onValorChange} />);

    await userEvent.click(screen.getByRole('button', { name: /Valor Todos/i }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Acima do justo' }));
    expect(onValorChange).toHaveBeenCalledWith('positivo');
  });

  it('permite desligar só os jogos em aberto sem alterar os demais filtros', async () => {
    const onSoEmAbertoChange = vi.fn();
    render(<OportunidadesFiltros {...props} soEmAberto onSoEmAbertoChange={onSoEmAbertoChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Só jogos em aberto' }));
    expect(onSoEmAbertoChange).toHaveBeenCalledWith(false);
  });

  it('permite combinar Alta, Média e Baixa sem fechar o seletor', async () => {
    const onFaixasChange = vi.fn();
    render(<OportunidadesFiltros {...props} soEmAberto onSoEmAbertoChange={vi.fn()} onFaixasChange={onFaixasChange} />);

    await userEvent.click(screen.getByRole('button', { name: /Faixa Alta e Média/i }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Alta' })).toHaveAttribute('data-state', 'checked');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Média' })).toHaveAttribute('data-state', 'checked');
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Baixa' }));
    expect(onFaixasChange).toHaveBeenCalledWith(['alta', 'media', 'baixa']);
    expect(screen.getByRole('menuitemcheckbox', { name: 'Baixa' })).toBeInTheDocument();
  });

  it('marca as três faixas de uma vez pela opção Todas', async () => {
    const onFaixasChange = vi.fn();
    render(<OportunidadesFiltros {...props} soEmAberto onSoEmAbertoChange={vi.fn()} onFaixasChange={onFaixasChange} />);

    await userEvent.click(screen.getByRole('button', { name: /Faixa Alta e Média/i }));
    const todas = screen.getByRole('menuitemcheckbox', { name: 'Todas' });
    expect(todas).toHaveAttribute('data-state', 'unchecked');
    await userEvent.click(todas);
    expect(onFaixasChange).toHaveBeenCalledWith(['alta', 'media', 'baixa']);
  });

  it('mostra Todas marcada quando as três faixas já estão selecionadas', async () => {
    render(
      <OportunidadesFiltros
        {...props}
        soEmAberto
        onSoEmAbertoChange={vi.fn()}
        faixasSelecionadas={['alta', 'media', 'baixa']}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Faixa Todas/i }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Todas' })).toHaveAttribute('data-state', 'checked');
  });

  it('abre com todos os campeonatos marcados e permite tirar um sem fechar o seletor', async () => {
    const onCompeticoesChange = vi.fn();
    render(
      <OportunidadesFiltros
        {...props}
        soEmAberto
        onSoEmAbertoChange={vi.fn()}
        competicoesSelecionadas={null}
        onCompeticoesChange={onCompeticoesChange}
        competicaoOptions={[
          { value: 'brasileirao', label: 'Brasileirão' },
          { value: 'premier_league', label: 'Premier League' },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Competição Todas' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Brasileirão' })).toHaveAttribute('data-state', 'checked');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Premier League' })).toHaveAttribute('data-state', 'checked');
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Premier League' }));
    expect(onCompeticoesChange).toHaveBeenCalledWith(['brasileirao']);
    expect(screen.getByRole('menuitemcheckbox', { name: 'Premier League' })).toBeInTheDocument();
  });

  it('volta para todos os campeonatos em um toque', async () => {
    const onCompeticoesChange = vi.fn();
    render(
      <OportunidadesFiltros
        {...props}
        soEmAberto
        onSoEmAbertoChange={vi.fn()}
        competicoesSelecionadas={['brasileirao']}
        onCompeticoesChange={onCompeticoesChange}
        competicaoOptions={[
          { value: 'brasileirao', label: 'Brasileirão' },
          { value: 'premier_league', label: 'Premier League' },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Competição Brasileirão' }));
    const todas = screen.getByRole('menuitemcheckbox', { name: 'Todas' });
    expect(todas).toHaveAttribute('data-state', 'unchecked');
    await userEvent.click(todas);
    // `null`, não a lista de hoje: assim o filtro acompanha as ligas do dia.
    expect(onCompeticoesChange).toHaveBeenCalledWith(null);
  });
});
