import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DarAssinatura, type EstadoDaConcessao } from './DarAssinatura';

const HOJE = '2026-09-12';
const PARADO: EstadoDaConcessao = { tipo: 'parado' };

const ATE = 'Assinatura manual válida até';
const VITALICIA = 'Assinatura vitalícia';
const VALOR = 'Valor cobrado por mês';

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
  it('pede plano, prazo e valor: é o acordo inteiro', () => {
    // O prazo é o que faz a cobrança existir; o valor é o que faz a receita
    // existir. A 136 criou a coluna do valor e nada a escrevia, então a metade
    // financeira do CRM estava inalcançável pela tela.
    montar();
    expect(screen.getByLabelText('Plano da assinatura manual')).toBeInTheDocument();
    expect(screen.getByLabelText(ATE)).toBeInTheDocument();
    expect(screen.getByLabelText(VALOR)).toBeInTheDocument();
  });

  it('a data já vem preenchida com um mês', () => {
    // O prazo mais comum, pronto. Campo vazio é um passo a mais entre combinar
    // a assinatura e registrá-la, e é nesse passo que ela deixa de ser registrada.
    montar();
    expect(screen.getByLabelText(ATE)).toHaveValue('2026-10-12');
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

  it('concede o plano, a data e o valor escolhidos', async () => {
    const { aoConceder } = montar();
    await userEvent.selectOptions(screen.getByLabelText('Plano da assinatura manual'), 'completo');
    await userEvent.clear(screen.getByLabelText(ATE));
    await userEvent.type(screen.getByLabelText(ATE), '2026-12-31');
    await userEvent.type(screen.getByLabelText(VALOR), '39,90');
    await userEvent.click(screen.getByRole('button', { name: /Dar esta assinatura/ }));
    expect(aoConceder).toHaveBeenCalledWith('completo', '2026-12-31', 39.9);
  });

  it('sem data, não dá para conceder', async () => {
    const { aoConceder } = montar();
    await userEvent.clear(screen.getByLabelText(ATE));
    expect(screen.getByRole('button', { name: /Dar esta assinatura/ })).toBeDisabled();
    expect(aoConceder).not.toHaveBeenCalled();
  });
});

describe('vitalícia', () => {
  it('marcada, concede sem data nenhuma', async () => {
    // Nulo é a resposta certa. A saída que o modelo oferecia antes era digitar
    // 2099: um número falso que o resto do sistema trataria como verdade, e que
    // um dia chegaria.
    const { aoConceder } = montar();
    await userEvent.click(screen.getByLabelText(VITALICIA));
    await userEvent.click(screen.getByRole('button', { name: /Dar esta assinatura/ }));
    expect(aoConceder).toHaveBeenCalledWith('essencial', null, null);
  });

  it('marcada, o campo de data desliga', async () => {
    // Data e vitalícia juntas seriam duas respostas para a mesma pergunta, e a
    // tela não diria qual valeu.
    montar();
    await userEvent.click(screen.getByLabelText(VITALICIA));
    expect(screen.getByLabelText(ATE)).toBeDisabled();
  });

  it('marcada, ainda dá para combinar cobrança mensal', async () => {
    // ⚠️ As duas perguntas são independentes: vitalícia com valor é quem paga
    // todo mês e nunca perde o acesso por atraso. Desligar o valor junto com a
    // data juntaria duas decisões numa.
    const { aoConceder } = montar();
    await userEvent.click(screen.getByLabelText(VITALICIA));
    await userEvent.type(screen.getByLabelText(VALOR), '49,90');
    await userEvent.click(screen.getByRole('button', { name: /Dar esta assinatura/ }));
    expect(aoConceder).toHaveBeenCalledWith('essencial', null, 49.9);
  });

  it('desmarcar devolve a data que estava digitada', async () => {
    // Quem só quis ver a outra opção não perde o que já tinha preenchido.
    montar();
    await userEvent.click(screen.getByLabelText(VITALICIA));
    await userEvent.click(screen.getByLabelText(VITALICIA));
    expect(screen.getByLabelText(ATE)).toHaveValue('2026-10-12');
  });

  it('avisa que vitalícia não entra na fila de vencimento', async () => {
    montar();
    await userEvent.click(screen.getByLabelText(VITALICIA));
    expect(screen.getByText(/não entra na fila de vencimento/i)).toBeInTheDocument();
  });

  it('quem já é vitalício abre com a marca ligada', () => {
    // Abrir desmarcado sobre um vitalício faria "trocar o plano" dar uma data
    // de fim a quem não tinha, sem ninguém pedir.
    montar({ atual: { id: 'c1', plano: 'completo', venceEm: null, valorMensal: null } });
    expect(screen.getByLabelText(VITALICIA)).toBeChecked();
    // A frase inteira: "vitalícia" solta casa também com o rótulo da marca e
    // com o aviso do rodapé, e o teste ficaria verde sem o resumo existir.
    expect(screen.getByText(/na mão, vitalícia/i)).toBeInTheDocument();
  });
});

describe('a cobrança mensal', () => {
  it('em branco quer dizer sem cobrança, e a tela fala isso', async () => {
    const { aoConceder } = montar();
    expect(screen.getByText(/Em branco quer dizer sem cobrança/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Dar esta assinatura/ }));
    expect(aoConceder).toHaveBeenCalledWith('essencial', '2026-10-12', null);
  });

  it('aceita ponto além de vírgula', async () => {
    const { aoConceder } = montar();
    await userEvent.type(screen.getByLabelText(VALOR), '39.90');
    await userEvent.click(screen.getByRole('button', { name: /Dar esta assinatura/ }));
    expect(aoConceder).toHaveBeenCalledWith('essencial', '2026-10-12', 39.9);
  });

  it('mostra o valor lido de volta, para não gravar outro número', async () => {
    // "1.500" e "1,500" são coisas diferentes, e quem digita não pensa nisso. A
    // tela devolve o que entendeu ANTES de gravar.
    montar();
    await userEvent.type(screen.getByLabelText(VALOR), '1.500,00');
    expect(screen.getByText(/1\.500,00/)).toBeInTheDocument();
  });

  it('texto que não é número trava a gravação em vez de virar sem cobrança', async () => {
    // O erro que importa: devolver nulo aqui gravaria "sem cobrança" para quem
    // digitou o preço errado, e essa pessoa nunca mais seria cobrada.
    const { aoConceder } = montar();
    await userEvent.type(screen.getByLabelText(VALOR), 'trinta e nove');
    expect(screen.getByText(/não dá para ler/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dar esta assinatura/ })).toBeDisabled();
    expect(aoConceder).not.toHaveBeenCalled();
  });
});

describe('a assinatura que já existe', () => {
  it('quem já tem vê qual é, até quando, e por quanto', () => {
    // A frase inteira, e não só o nome do plano: "Essencial" também aparece na
    // opção do seletor, e casar com ele deixaria o teste verde mesmo sem a
    // assinatura estar escrita em lugar nenhum.
    montar({ atual: { id: 'c1', plano: 'essencial', venceEm: '2026-10-31', valorMensal: 39.9 } });
    expect(screen.getByText(/na mão,/)).toBeInTheDocument();
    expect(screen.getByText(/31\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/39,90 por mês/)).toBeInTheDocument();
  });

  it('sem valor combinado, diz sem cobrança em vez de R$ 0,00', () => {
    montar({ atual: { id: 'c1', plano: 'entrada', venceEm: '2026-10-31', valorMensal: null } });
    expect(screen.getByText(/Sem cobrança combinada/i)).toBeInTheDocument();
  });

  it('o formulário abre no plano, no prazo e no valor dela', () => {
    // Abrir em branco sobre uma assinatura manual que existe faria trocar só o
    // prazo virar troca de plano, e zerar o valor, sem ninguém pedir.
    montar({ atual: { id: 'c1', plano: 'completo', venceEm: '2026-10-31', valorMensal: 39.9 } });
    expect(screen.getByLabelText('Plano da assinatura manual')).toHaveValue('completo');
    expect(screen.getByLabelText(ATE)).toHaveValue('2026-10-31');
    expect(screen.getByLabelText(VALOR)).toHaveValue('39,9');
  });

  it('dá para encerrar a assinatura manual aberta', async () => {
    const { aoEncerrar } = montar({
      atual: { id: 'c1', plano: 'entrada', venceEm: '2026-10-31', valorMensal: null },
    });
    await userEvent.click(screen.getByRole('button', { name: /Encerrar a assinatura/ }));
    expect(aoEncerrar).toHaveBeenCalledWith('c1');
  });

  it('sem assinatura manual, não existe botão de encerrar', () => {
    montar();
    expect(screen.queryByRole('button', { name: /Encerrar/ })).not.toBeInTheDocument();
  });
});

describe('enquanto grava', () => {
  it('não dá para gravar de novo', async () => {
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
