import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MensagemPronta } from './MensagemPronta';

const escrever = vi.fn();

beforeEach(() => {
  escrever.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText: escrever } });
});

const montar = (over: Partial<Parameters<typeof MensagemPronta>[0]> = {}) =>
  render(
    <MensagemPronta
      modelo="Oi, Maria! Vi que você começou a usar o Betinho."
      numero="5511998877665"
      {...over}
    />,
  );

const campo = () => screen.getByRole('textbox', { name: /mensagem/i });

describe('MensagemPronta', () => {
  it('já vem com o texto montado', () => {
    montar();
    expect(campo()).toHaveValue('Oi, Maria! Vi que você começou a usar o Betinho.');
  });

  it('o sócio pode editar antes de mandar', async () => {
    // O modelo é ponto de partida. Quem conhece o lead ajusta, e uma caixa
    // travada só faria ele copiar para outro lugar para editar.
    montar();
    await userEvent.clear(campo());
    await userEvent.type(campo(), 'Oi Maria, tudo bem?');
    expect(campo()).toHaveValue('Oi Maria, tudo bem?');
  });

  it('copia o que está na tela, e não o modelo original', async () => {
    montar();
    await userEvent.clear(campo());
    await userEvent.type(campo(), 'texto meu');
    await userEvent.click(screen.getByRole('button', { name: /copiar/i }));
    expect(escrever).toHaveBeenCalledWith('texto meu');
  });

  it('avisa que copiou, senão o clique não dá sinal nenhum', async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: /copiar/i }));
    expect(await screen.findByText(/copiado/i)).toBeInTheDocument();
  });

  it('o link do WhatsApp leva o texto editado', async () => {
    montar();
    await userEvent.clear(campo());
    await userEvent.type(campo(), 'texto meu');
    const link = screen.getByRole('link', { name: /whatsapp/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('texto%20meu'));
    expect(link).toHaveAttribute('href', expect.stringContaining('wa.me/5511998877665'));
  });

  it('sem número, o botão do WhatsApp some e a tela explica', () => {
    // Um link quebrado abre aba em branco e o sócio não entende por quê.
    montar({ numero: null });
    expect(screen.queryByRole('link', { name: /whatsapp/i })).not.toBeInTheDocument();
    expect(screen.getByText(/sem whatsapp no cadastro/i)).toBeInTheDocument();
  });

  it('copiar continua funcionando sem número', () => {
    montar({ numero: null });
    expect(screen.getByRole('button', { name: /copiar/i })).toBeEnabled();
  });

  it('dá para voltar ao modelo depois de editar', async () => {
    montar();
    await userEvent.clear(campo());
    await userEvent.type(campo(), 'baguncei');
    await userEvent.click(screen.getByRole('button', { name: /voltar ao modelo/i }));
    expect(campo()).toHaveValue('Oi, Maria! Vi que você começou a usar o Betinho.');
  });

  it('sem edição, não oferece voltar ao modelo', () => {
    montar();
    expect(screen.queryByRole('button', { name: /voltar ao modelo/i })).not.toBeInTheDocument();
  });
});

describe('MensagemPronta · quando o modelo muda na tela', () => {
  it('sem o sócio ter digitado, a caixa acompanha o modelo novo', async () => {
    // O sócio troca a etapa e a mensagem tem de acompanhar. A primeira versão
    // semeava o estado uma vez só: o texto ficava congelado no modelo antigo,
    // o link do WhatsApp levava o texto velho, e "voltar ao modelo" aparecia
    // sem ele ter escrito coisa nenhuma.
    const { rerender } = render(
      <MensagemPronta modelo="Modelo do Betinho." numero="5511998877665" />,
    );
    rerender(<MensagemPronta modelo="Modelo do futebol." numero="5511998877665" />);
    expect(campo()).toHaveValue('Modelo do futebol.');
    expect(screen.queryByRole('button', { name: /voltar ao modelo/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute(
      'href',
      expect.stringContaining(encodeURIComponent('Modelo do futebol.')),
    );
  });

  it('depois de digitar, o texto do sócio manda', async () => {
    const { rerender } = render(
      <MensagemPronta modelo="Modelo do Betinho." numero="5511998877665" />,
    );
    await userEvent.clear(campo());
    await userEvent.type(campo(), 'meu texto');
    rerender(<MensagemPronta modelo="Modelo do futebol." numero="5511998877665" />);
    expect(campo()).toHaveValue('meu texto');
    expect(screen.getByRole('button', { name: /voltar ao modelo/i })).toBeInTheDocument();
  });

  it('voltar ao modelo devolve o modelo ATUAL, e não o de quando a tela abriu', async () => {
    const { rerender } = render(
      <MensagemPronta modelo="Modelo do Betinho." numero="5511998877665" />,
    );
    await userEvent.clear(campo());
    await userEvent.type(campo(), 'meu texto');
    rerender(<MensagemPronta modelo="Modelo do futebol." numero="5511998877665" />);
    await userEvent.click(screen.getByRole('button', { name: /voltar ao modelo/i }));
    expect(campo()).toHaveValue('Modelo do futebol.');
  });
});

describe('MensagemPronta · quando copiar não funciona', () => {
  it('diz o que fazer, em vez de o clique não dar sinal nenhum', async () => {
    // Fora de contexto seguro o navegador nem define a área de transferência.
    // Sem aviso, o sócio clica, nada acontece, e ele manda a mensagem errada.
    escrever.mockRejectedValue(new Error('bloqueado'));
    montar();
    await userEvent.click(screen.getByRole('button', { name: /copiar/i }));
    expect(await screen.findByText(/selecione o texto acima/i)).toBeInTheDocument();
    expect(screen.queryByText(/^copiado$/i)).not.toBeInTheDocument();
  });

  it('e o aviso some quando o sócio mexe no texto', async () => {
    escrever.mockRejectedValue(new Error('bloqueado'));
    montar();
    await userEvent.click(screen.getByRole('button', { name: /copiar/i }));
    await userEvent.type(campo(), '!');
    expect(screen.queryByText(/selecione o texto acima/i)).not.toBeInTheDocument();
  });
});

describe('MensagemPronta · o link', () => {
  it('abre em aba nova e sem dar acesso à janela de origem', () => {
    // `rel` sem `noopener` deixa a página aberta mexer nesta pela `window.opener`.
    montar();
    const link = screen.getByRole('link', { name: /whatsapp/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
