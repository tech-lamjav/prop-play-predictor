import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DarAssinatura, type EstadoDaConcessao } from './DarAssinatura';

const HOJE = '2026-09-12';
const PARADO: EstadoDaConcessao = { tipo: 'parado' };

function montar(props: Partial<Parameters<typeof DarAssinatura>[0]> = {}) {
  const aoConceder = vi.fn();
  const aoEncerrar = vi.fn();
  render(
    <DarAssinatura
      hoje={HOJE}
      atual={null}
      estado={PARADO}
      aoConceder={aoConceder}
      aoEncerrar={aoEncerrar}
      {...props}
    />,
  );
  return { aoConceder, aoEncerrar };
}

describe('DarAssinatura', () => {
  it('pede plano e prazo, que é o que faz a cobrança existir', () => {
    // Uma cortesia sem data nunca é cobrada, porque ninguém sabe quando ela
    // deveria acabar. A data é o ponto de toda esta tela.
    montar();
    expect(screen.getByLabelText('Plano da assinatura manual')).toBeInTheDocument();
    expect(screen.getByLabelText('Assinatura manual vai até')).toBeInTheDocument();
  });

  it('a data já vem preenchida com um mês', () => {
    // O prazo mais comum, pronto. Campo vazio é um passo a mais entre combinar
    // a cortesia e registrá-la, e é nesse passo que ela deixa de ser registrada.
    montar();
    expect(screen.getByLabelText('Assinatura manual vai até')).toHaveValue('2026-10-12');
  });

  it('diz o que o plano libera antes de dar', () => {
    // "Essencial" não diz nada sobre o Betinho ir junto, e ir junto é
    // justamente o que surpreende quem só leu o nome.
    montar();
    expect(screen.getByText(/futebol completo e Betinho ilimitado/i)).toBeInTheDocument();
  });

  it('o que libera muda com o plano escolhido', async () => {
    montar();
    await userEvent.selectOptions(screen.getByLabelText('Plano da assinatura manual'), 'entrada');
    expect(screen.getByText(/Betinho ilimitado/i)).toBeInTheDocument();
    expect(screen.queryByText(/análises de NBA/i)).not.toBeInTheDocument();
  });

  it('concede o plano e a data escolhidos', async () => {
    const { aoConceder } = montar();
    await userEvent.selectOptions(screen.getByLabelText('Plano da assinatura manual'), 'completo');
    await userEvent.clear(screen.getByLabelText('Assinatura manual vai até'));
    await userEvent.type(screen.getByLabelText('Assinatura manual vai até'), '2026-12-31');
    await userEvent.click(screen.getByRole('button', { name: /Dar esta assinatura/ }));
    expect(aoConceder).toHaveBeenCalledWith('completo', '2026-12-31');
  });

  it('sem data, não dá para conceder', async () => {
    const { aoConceder } = montar();
    await userEvent.clear(screen.getByLabelText('Assinatura manual vai até'));
    expect(screen.getByRole('button', { name: /Dar esta assinatura/ })).toBeDisabled();
    expect(aoConceder).not.toHaveBeenCalled();
  });

  it('quem já tem cortesia vê qual é, e até quando', () => {
    // A frase inteira, e não só o nome do plano: "Essencial" também aparece na
    // opção do seletor, e casar com ele deixaria o teste verde mesmo sem a
    // cortesia estar escrita em lugar nenhum.
    montar({ atual: { id: 'c1', plano: 'essencial', venceEm: '2026-10-31' } });
    expect(screen.getByText(/na mão, até/)).toBeInTheDocument();
    expect(screen.getByText(/31\/10\/2026/)).toBeInTheDocument();
  });

  it('com cortesia aberta, o formulário abre no plano e no prazo dela', () => {
    // Abrir em branco sobre uma cortesia que existe faria trocar só o prazo
    // virar troca de plano sem ninguém pedir.
    montar({ atual: { id: 'c1', plano: 'completo', venceEm: '2026-10-31' } });
    expect(screen.getByLabelText('Plano da assinatura manual')).toHaveValue('completo');
    expect(screen.getByLabelText('Assinatura manual vai até')).toHaveValue('2026-10-31');
  });

  it('dá para encerrar a cortesia aberta', async () => {
    const { aoEncerrar } = montar({ atual: { id: 'c1', plano: 'entrada', venceEm: '2026-10-31' } });
    await userEvent.click(screen.getByRole('button', { name: /Encerrar a cortesia/ }));
    expect(aoEncerrar).toHaveBeenCalledWith('c1');
  });

  it('sem cortesia, não existe botão de encerrar', () => {
    montar();
    expect(screen.queryByRole('button', { name: /Encerrar/ })).not.toBeInTheDocument();
  });

  it('enquanto grava, não dá para gravar de novo', async () => {
    // Dois cliques gravariam duas concessões, e a segunda encerraria a primeira
    // um instante depois de criá-la.
    montar({ estado: { tipo: 'salvando' } });
    expect(screen.getByRole('button', { name: /Gravando/ })).toBeDisabled();
  });

  it('quando falha, diz o motivo', () => {
    montar({ estado: { tipo: 'erro', recado: 'Sua conta não está mais marcada como sócio.' } });
    expect(screen.getByText(/não está mais marcada como sócio/)).toBeInTheDocument();
  });
});
