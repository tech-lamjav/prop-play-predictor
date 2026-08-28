import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertasPublicacaoAtalho, AlertasPublicacaoCartao } from './AlertasPublicacao';

describe('AlertasPublicacaoCartao', () => {
  it('explica que os alertas já estão ligados e podem ser pausados', () => {
    render(<AlertasPublicacaoCartao onDismiss={vi.fn()} />);
    expect(screen.getByText(/Agora avisamos no Telegram/i)).toBeInTheDocument();
    expect(screen.getByText(/pode pausar quando quiser/i)).toBeInTheDocument();
  });

  it('"Entendi" apenas dispensa a explicação', async () => {
    const onDismiss = vi.fn();
    render(<AlertasPublicacaoCartao onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('o X também dispensa', async () => {
    const onDismiss = vi.fn();
    render(<AlertasPublicacaoCartao onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dispensar explicação' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('AlertasPublicacaoAtalho', () => {
  const ligado = { telegramLinked: true, accessActive: true, enabled: true };

  it('mostra alertas ligados e leva ao controle em Configurações', async () => {
    const onOpenSettings = vi.fn();
    const onConnect = vi.fn();
    render(<AlertasPublicacaoAtalho estado={ligado} onConnect={onConnect} onOpenSettings={onOpenSettings} />);

    expect(screen.getByText('Alertas do Telegram ativos')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onConnect).not.toHaveBeenCalled();
  });

  it('mostra alertas pausados quando a preferência está desligada', () => {
    render(
      <AlertasPublicacaoAtalho
        estado={{ ...ligado, enabled: false }}
        onConnect={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Alertas do Telegram pausados')).toBeInTheDocument();
  });

  it('separa acesso inativo de pausa escolhida pelo usuário', () => {
    render(
      <AlertasPublicacaoAtalho
        estado={{ ...ligado, accessActive: false }}
        onConnect={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Alertas indisponíveis com o acesso atual')).toBeInTheDocument();
    expect(screen.getByText(/preferência está salva/i)).toBeInTheDocument();
  });

  it('acesso inativo vence o convite de conectar, para não prometer entrega', async () => {
    const onConnect = vi.fn();
    const onOpenSettings = vi.fn();
    render(
      <AlertasPublicacaoAtalho
        estado={{ ...ligado, telegramLinked: false, accessActive: false }}
        onConnect={onConnect}
        onOpenSettings={onOpenSettings}
      />,
    );

    expect(screen.getByText('Alertas indisponíveis com o acesso atual')).toBeInTheDocument();
    expect(screen.queryByText('Conectar')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button'));
    expect(onConnect).not.toHaveBeenCalled();
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('sem Telegram conectado, chama a conexão em vez das configurações', async () => {
    const onOpenSettings = vi.fn();
    const onConnect = vi.fn();
    render(
      <AlertasPublicacaoAtalho
        estado={{ ...ligado, telegramLinked: false }}
        onConnect={onConnect}
        onOpenSettings={onOpenSettings}
      />,
    );

    expect(screen.getByText('Conecte o Telegram para receber alertas')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button'));
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).not.toHaveBeenCalled();
  });
});
