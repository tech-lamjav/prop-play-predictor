import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OportunidadesFiltros, type MarketFilter } from './OportunidadesFiltros';
import { ESTADOS_DO_JOGO } from '@/utils/futebol-score';

const props = {
  mercado: 'all' as MarketFilter,
  onMercadoChange: vi.fn(),
  estadosSelecionados: [...ESTADOS_DO_JOGO],
  onEstadosChange: vi.fn(),
  faixasSelecionadas: ['alta', 'media'] as const,
  onFaixasChange: vi.fn(),
  competicoesSelecionadas: null,
  onCompeticoesChange: vi.fn(),
  competicaoOptions: [{ value: 'brasileirao', label: 'Brasileirão' }],
};

describe('OportunidadesFiltros', () => {
  it('mantém mercado e filtros de visualização em duas faixas independentes no mobile', () => {
    render(<OportunidadesFiltros {...props} />);

    expect(screen.getByTestId('filtros-mercado')).toBeInTheDocument();
    expect(screen.getByTestId('filtros-visualizacao')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Estado Todos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Faixa Alta e Média/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Competição Todas/i })).toBeInTheDocument();
  });

  // O estado do jogo virou filtro de marcar vários (era o interruptor "Só jogos
  // em aberto", que não tinha como pedir os encerrados nem o que está rolando).
  it('combina estados sem fechar o seletor', async () => {
    const onEstadosChange = vi.fn();
    render(
      <OportunidadesFiltros
        {...props}
        estadosSelecionados={['aberto']}
        onEstadosChange={onEstadosChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Estado Em aberto/i }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Ao vivo' }));
    expect(onEstadosChange).toHaveBeenCalledWith(['aberto', 'ao_vivo']);
    expect(screen.getByRole('menuitemcheckbox', { name: 'Encerrado' })).toBeInTheDocument();
  });

  it('resume dois estados pelos nomes e não pela contagem', () => {
    render(<OportunidadesFiltros {...props} estadosSelecionados={['aberto', 'ao_vivo']} />);

    expect(screen.getByRole('button', { name: 'Estado Em aberto e Ao vivo' })).toBeInTheDocument();
  });

  // O feedback que originou a mudança: o clique tem que acompanhar. Desmarcar o
  // último item era engolido — a lista ficava como estava, sem dizer por quê.
  it('deixa desmarcar o último item que sobrou', async () => {
    const onFaixasChange = vi.fn();
    render(
      <OportunidadesFiltros {...props} faixasSelecionadas={['alta']} onFaixasChange={onFaixasChange} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Faixa Alta/i }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Alta' }));
    expect(onFaixasChange).toHaveBeenCalledWith([]);
  });

  it('anuncia no botão quando nada está marcado', () => {
    render(<OportunidadesFiltros {...props} faixasSelecionadas={[]} />);

    expect(screen.getByRole('button', { name: 'Faixa Nenhuma' })).toBeInTheDocument();
  });

  it('marca as três faixas de uma vez pela opção Todas', async () => {
    const onFaixasChange = vi.fn();
    render(<OportunidadesFiltros {...props} onFaixasChange={onFaixasChange} />);

    await userEvent.click(screen.getByRole('button', { name: /Faixa Alta e Média/i }));
    const todas = screen.getByRole('menuitemcheckbox', { name: 'Todas' });
    expect(todas).toHaveAttribute('data-state', 'unchecked');
    await userEvent.click(todas);
    expect(onFaixasChange).toHaveBeenCalledWith(['alta', 'media', 'baixa']);
  });

  // "Todas" alterna dos DOIS lados: com tudo marcado ela desmarca, em vez de
  // ser um clique sem efeito nenhum.
  it('desmarca tudo pela opção Todas quando já estava tudo marcado', async () => {
    const onFaixasChange = vi.fn();
    render(
      <OportunidadesFiltros
        {...props}
        faixasSelecionadas={['alta', 'media', 'baixa']}
        onFaixasChange={onFaixasChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Faixa Todas/i }));
    const todas = screen.getByRole('menuitemcheckbox', { name: 'Todas' });
    expect(todas).toHaveAttribute('data-state', 'checked');
    await userEvent.click(todas);
    expect(onFaixasChange).toHaveBeenCalledWith([]);
  });

  it('abre com todos os campeonatos marcados e permite tirar um sem fechar o seletor', async () => {
    const onCompeticoesChange = vi.fn();
    render(
      <OportunidadesFiltros
        {...props}
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
