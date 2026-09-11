import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorDeAcesso, type EstadoDaEscrita } from './EditorDeAcesso';
import type { Pessoa } from './crm-ficha';

function pessoa(campos: Partial<Pessoa> = {}): Pessoa {
  return {
    id: 'p1',
    name: 'Maria Silva',
    email: 'maria@exemplo.com',
    whatsapp_number: null,
    created_at: '2026-09-01T12:00:00Z',
    betinho_subscription_status: null,
    futebol_subscription_status: 'free',
    analytics_subscription_status: null,
    telegram_synced: null,
    subscription_product_type: null,
    futebol_trial_started_at: null,
    futebol_publication_alerts_ack_at: null,
    telegram_username: null,
    betinho_subscription_period_end: null,
    analytics_subscription_period_end: null,
    has_report_access: null,
    ...campos,
  };
}

const PARADO: EstadoDaEscrita = { tipo: 'parado' };

function montar(props: Partial<Parameters<typeof EditorDeAcesso>[0]> = {}) {
  const aoSalvar = vi.fn();
  const aoDefinirTeste = vi.fn();
  render(
    <EditorDeAcesso
      pessoa={pessoa()}
      escrita={PARADO}
      aoSalvar={aoSalvar}
      aoDefinirTeste={aoDefinirTeste}
      {...props}
    />,
  );
  return { aoSalvar, aoDefinirTeste };
}

describe('EditorDeAcesso', () => {
  it('avisa que o Stripe manda, e não o CRM', () => {
    // O aviso é o item mais importante da tela. Sem ele, o sócio libera alguém,
    // o webhook passa por cima três semanas depois, e ninguém liga uma coisa à
    // outra: o acesso "sumiu sozinho".
    montar();
    expect(screen.getByText(/Stripe/)).toBeInTheDocument();
  });

  it('abre com o que já vale, e não em branco', () => {
    montar({
      pessoa: pessoa({
        betinho_subscription_status: 'premium',
        betinho_subscription_period_end: '2026-10-12T03:00:00Z',
      }),
    });
    expect(screen.getByLabelText('Acesso ao Betinho')).toBeChecked();
    expect(screen.getByLabelText('Acesso ao Betinho até')).toHaveValue('2026-10-12');
    expect(screen.getByLabelText('Acesso ao Análises')).not.toBeChecked();
  });

  it('sem mudança, não dá para salvar', () => {
    // Cada gravação escreve um registro na linha do tempo. Um botão sempre
    // aceso encheria a linha de "Betinho: liberou" repetido.
    montar();
    expect(screen.getByRole('button', { name: 'Salvar Betinho' })).toBeDisabled();
  });

  it('mudar o interruptor libera o botão e manda o produto certo', async () => {
    const { aoSalvar } = montar();
    await userEvent.click(screen.getByLabelText('Acesso ao Betinho'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Betinho' }));
    expect(aoSalvar).toHaveBeenCalledWith({ produto: 'betinho', ativo: true, ate: null });
  });

  it('manda a data quando o sócio escolhe uma', async () => {
    const { aoSalvar } = montar();
    await userEvent.click(screen.getByLabelText('Acesso ao Análises'));
    await userEvent.type(screen.getByLabelText('Acesso ao Análises até'), '2026-12-31');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Análises' }));
    expect(aoSalvar).toHaveBeenCalledWith({
      produto: 'analises',
      ativo: true,
      ate: '2026-12-31',
    });
  });

  it('tirar o acesso não manda data junto', async () => {
    // Uma data sobrando num "tirar" seria gravada como prazo de um acesso que
    // não existe, e a próxima leitura mostraria "sem acesso, renova em…".
    const { aoSalvar } = montar({
      pessoa: pessoa({
        betinho_subscription_status: 'premium',
        betinho_subscription_period_end: '2026-10-12T03:00:00Z',
      }),
    });
    await userEvent.click(screen.getByLabelText('Acesso ao Betinho'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Betinho' }));
    expect(aoSalvar).toHaveBeenCalledWith({ produto: 'betinho', ativo: false, ate: null });
  });

  it('o futebol não pede data, e diz por quê', () => {
    montar();
    expect(screen.queryByLabelText('Acesso ao Futebol até')).not.toBeInTheDocument();
    expect(screen.getByText(/não guarda prazo do futebol/i)).toBeInTheDocument();
  });

  it('gravar um produto não trava os outros', async () => {
    // Com um booleano no lugar do alvo, salvar o Betinho apagaria as três
    // linhas e a tela pareceria congelada.
    montar({ escrita: { tipo: 'salvando', alvo: 'betinho' } });
    expect(screen.getByLabelText('Acesso ao Betinho')).toBeDisabled();
    expect(screen.getByLabelText('Acesso ao Análises')).not.toBeDisabled();
  });

  it('quando falha, diz que nada mudou', () => {
    // "Não deu para gravar" sozinho deixa o sócio sem saber se o acesso foi
    // pela metade. A frase precisa dizer o estado, e não só o erro.
    montar({ escrita: { tipo: 'erro', alvo: 'betinho' } });
    expect(screen.getByText(/continua como estava/)).toBeInTheDocument();
  });
});

describe('o teste do futebol', () => {
  it('quem nunca testou ganha o botão de começar', async () => {
    const { aoDefinirTeste } = montar();
    expect(screen.getByText('Nunca usou o teste.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Começar sete dias/ }));
    expect(aoDefinirTeste).toHaveBeenCalledWith(true);
  });

  it('teste correndo diz quando termina, e o botão encerra', async () => {
    vi.setSystemTime(new Date('2026-09-12T12:00:00Z'));
    const { aoDefinirTeste } = montar({
      pessoa: pessoa({ futebol_trial_started_at: '2026-09-10T12:00:00Z' }),
    });
    expect(screen.getByText('Correndo, termina em 17/09/2026 (5 dias).')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Encerrar o teste/ }));
    expect(aoDefinirTeste).toHaveBeenCalledWith(false);
    vi.useRealTimers();
  });

  it('teste vencido não some da tela', () => {
    // É o estado que decide se dar outro teste faz sentido. Tratar vencido
    // como "nunca" esconderia que esta pessoa já usou o dela.
    vi.setSystemTime(new Date('2026-09-12T12:00:00Z'));
    montar({ pessoa: pessoa({ futebol_trial_started_at: '2026-08-01T12:00:00Z' }) });
    expect(screen.getByText(/Já usou/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dar mais sete dias/ })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('o interruptor do futebol não mexe no teste', async () => {
    // São decisões diferentes. Um interruptor só faria desligar o premium
    // apagar o teste da pessoa sem ninguém ter pedido.
    const { aoSalvar, aoDefinirTeste } = montar();
    await userEvent.click(screen.getByLabelText('Acesso ao Futebol'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Futebol' }));
    expect(aoSalvar).toHaveBeenCalledWith({ produto: 'futebol', ativo: true, ate: null });
    expect(aoDefinirTeste).not.toHaveBeenCalled();
  });
});
