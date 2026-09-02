import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertasPublicacaoAtalho, AlertasPublicacaoCartao, AlertasPublicacaoStatus } from './AlertasPublicacao';

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

describe('AlertasPublicacaoStatus', () => {
  const conectado = { telegramLinked: true, accessActive: true, enabled: true };

  it('mostra o estado ativo em um card compacto e só Gerenciar abre as configurações', async () => {
    const onOpenSettings = vi.fn();
    render(<AlertasPublicacaoStatus estado={conectado} onOpenSettings={onOpenSettings} />);

    expect(screen.getByRole('region', { name: 'Status dos alertas no Telegram' })).toBeInTheDocument();
    expect(screen.getByText('Telegram ativo')).toBeInTheDocument();
    expect(screen.queryByText(/Você recebe um aviso quando novas oportunidades forem publicadas/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Gerenciar alertas do Telegram' }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('mantém o mesmo formato quando está pausado', () => {
    render(<AlertasPublicacaoStatus estado={{ ...conectado, enabled: false }} onOpenSettings={vi.fn()} />);
    expect(screen.getByText('Telegram pausado')).toBeInTheDocument();
    expect(screen.queryByText(/Ative para receber um aviso/i)).not.toBeInTheDocument();
  });

  it('continua visível sem acesso ativo, dizendo que a preferência está salva', () => {
    // Sumir aqui deixaria quem perdeu o acesso sem saber se um dia ligou os
    // alertas — e a preferência é persistente, não morre com o acesso.
    render(<AlertasPublicacaoStatus estado={{ ...conectado, accessActive: false }} onOpenSettings={vi.fn()} />);
    expect(screen.getByText('Alertas sem acesso')).toBeInTheDocument();
    expect(screen.getByText(/volta a valer quando o acesso retornar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerenciar alertas do Telegram' })).toBeInTheDocument();
  });
});

describe('AlertasPublicacaoAtalho', () => {
  const ligado = { telegramLinked: true, accessActive: true, enabled: true };

  it('não ocupa espaço para quem já conectou o Telegram', () => {
    render(
      <AlertasPublicacaoAtalho
        estado={ligado}
        onConnect={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('não ocupa espaço nem convida quem está sem acesso ativo', () => {
    render(
      <AlertasPublicacaoAtalho
        estado={{ ...ligado, telegramLinked: false, accessActive: false }}
        onConnect={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('explica o benefício e inicia a conexão para quem ainda não conectou', async () => {
    const onConnect = vi.fn();
    render(
      <AlertasPublicacaoAtalho
        estado={{ ...ligado, telegramLinked: false }}
        onConnect={onConnect}
      />,
    );

    expect(screen.getByText('Receba alertas de publicação no Telegram')).toBeInTheDocument();
    expect(screen.getByText(/ser avisado quando uma oportunidade for publicada no painel/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Conectar Telegram/i }));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });
});
