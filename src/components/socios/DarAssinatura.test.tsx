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
    // existir. A 141 criou a coluna do valor e nada a escrevia, então a metade
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
    expect(aoConceder).toHaveBeenCalledWith('completo', '2026-12-31', 39.9, HOJE);
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
    expect(aoConceder).toHaveBeenCalledWith('essencial', null, null, HOJE);
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
    expect(aoConceder).toHaveBeenCalledWith('essencial', null, 49.9, HOJE);
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

describe('quando o acordo começou', () => {
  const COMECO = 'Quando a assinatura começou';

  it('o campo existe ao criar, e já vem com hoje', () => {
    montar();
    expect(screen.getByLabelText(COMECO)).toHaveValue(HOJE);
  });

  it('⚠️ o campo NÃO aparece ao trocar o plano', () => {
    // O guarda mais caro deste ticket. O histórico de pagamento pendura na
    // linha da assinatura e os meses em aberto contam a partir do começo:
    // deixar editar o começo numa troca faria a dívida INTEIRA sumir quando o
    // sócio só queria corrigir o valor. É o mesmo estrago que a 142 evitou ao
    // parar de encerrar e recriar, chegando por outro caminho.
    montar({ atual: { id: 'c1', plano: 'entrada', venceEm: '2026-10-31', valorMensal: 39.9 } });
    expect(screen.queryByLabelText(COMECO)).not.toBeInTheDocument();
  });

  it('e uma troca manda HOJE como começo, nunca outra data', async () => {
    // ⚠️ Este teste já foi sem dentes: ele só conferia que o botão dizia
    // "Trocar o plano", sem clicar e sem olhar o argumento. Quem pegou foi a
    // mutação, que sobreviveu porque não havia nada afirmando o que sai daqui.
    //
    // O banco ignora o começo numa troca, mas a tela não pode contar com isso:
    // se um dia a função mudar, o parâmetro que sai daqui é o que vale.
    const { aoConceder } = montar({
      atual: { id: 'c1', plano: 'entrada', venceEm: '2026-10-31', valorMensal: 39.9 },
    });
    await userEvent.click(screen.getByRole('button', { name: /Trocar o plano/ }));
    expect(aoConceder).toHaveBeenCalledWith('entrada', '2026-10-31', 39.9, HOJE);
  });

  it('retroagir com cobrança AVISA quantos meses vão abrir, e quanto', async () => {
    // ⚠️ O aviso central. Retroagir com valor combinado faz a pessoa aparecer
    // devendo vários meses de uma vez, e esse número não pode aparecer pela
    // primeira vez na fila de inadimplentes, depois de gravado.
    montar();
    await userEvent.type(screen.getByLabelText(VALOR), '39,90');
    const comeco = screen.getByLabelText(COMECO);
    await userEvent.clear(comeco);
    await userEvent.type(comeco, '2026-06-01');
    expect(screen.getByText(/Vai abrir 4 meses em aberto/)).toBeInTheDocument();
    expect(screen.getByText(/159,60/)).toBeInTheDocument();
  });

  it('sem cobrança combinada não avisa nada, porque nada abre', async () => {
    // Quem não combinou pagar não deve nada. Avisar aqui seria ruído, e ruído
    // ensina a ignorar o aviso.
    montar();
    const comeco = screen.getByLabelText(COMECO);
    await userEvent.clear(comeco);
    await userEvent.type(comeco, '2026-06-01');
    expect(screen.queryByText(/Vai abrir/)).not.toBeInTheDocument();
  });

  it('começar hoje não avisa: é o caso normal', async () => {
    montar();
    await userEvent.type(screen.getByLabelText(VALOR), '39,90');
    expect(screen.queryByText(/Vai abrir/)).not.toBeInTheDocument();
  });

  it('data no futuro trava a gravação e diz por quê', async () => {
    // Acordo que ainda não começou não tem mês em aberto, e a fila contaria
    // meses negativos.
    montar();
    const comeco = screen.getByLabelText(COMECO);
    await userEvent.clear(comeco);
    await userEvent.type(comeco, '2026-12-01');
    expect(screen.getByText(/Não dá para começar no futuro/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dar esta assinatura/ })).toBeDisabled();
  });

  it('mais de um ano atrás trava, e o recado fala de ANO digitado errado', async () => {
    // ⚠️ O limite não é da conta: desde a #451 ela soma a dívida inteira. É
    // proteção contra alguém escrever 2019 em vez de 2026, e o recado precisa
    // dizer isso — senão alguém "conserta" o limite achando que é o corte
    // antigo voltando.
    montar();
    const comeco = screen.getByLabelText(COMECO);
    await userEvent.clear(comeco);
    await userEvent.type(comeco, '2019-06-01');
    expect(screen.getByText(/Confira o ano antes de gravar/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dar esta assinatura/ })).toBeDisabled();
  });

  it('conceder retroativo manda a data escolhida', async () => {
    const { aoConceder } = montar();
    const comeco = screen.getByLabelText(COMECO);
    await userEvent.clear(comeco);
    await userEvent.type(comeco, '2026-06-01');
    await userEvent.click(screen.getByRole('button', { name: /Dar esta assinatura/ }));
    expect(aoConceder).toHaveBeenCalledWith('essencial', '2026-10-12', null, '2026-06-01');
  });
});

describe('a cobrança mensal', () => {
  it('em branco quer dizer sem cobrança, e a tela fala isso', async () => {
    const { aoConceder } = montar();
    expect(screen.getByText(/Em branco quer dizer sem cobrança/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Dar esta assinatura/ }));
    expect(aoConceder).toHaveBeenCalledWith('essencial', '2026-10-12', null, HOJE);
  });

  it('aceita ponto além de vírgula', async () => {
    const { aoConceder } = montar();
    await userEvent.type(screen.getByLabelText(VALOR), '39.90');
    await userEvent.click(screen.getByRole('button', { name: /Dar esta assinatura/ }));
    expect(aoConceder).toHaveBeenCalledWith('essencial', '2026-10-12', 39.9, HOJE);
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

  it('⚠️ a tela AVISA que encerrar não tira o acesso', async () => {
    // É o que sustenta a escolha da issue #454: encerrar deixou de rebaixar
    // acesso, porque para decidir se podia a função adivinhava quem paga no
    // cartão — e derrubava o produto de quem estava pagando.
    //
    // Sem este aviso, a mudança troca um defeito silencioso por outro: o sócio
    // encerra, vai embora achando que cortou, e a pessoa segue com o produto.
    montar({
      atual: { id: 'c1', plano: 'entrada', venceEm: '2026-10-31', valorMensal: 39.9 },
    });
    expect(screen.getByText(/não tira o acesso/i)).toBeInTheDocument();
    expect(screen.getByText(/acessos avulsos/i)).toBeInTheDocument();
  });

  it('e o aviso só aparece quando há assinatura para encerrar', () => {
    // Numa concessão nova não há o que encerrar, e o aviso seria ruído — ruído
    // ensina a ignorar aviso.
    montar();
    expect(screen.queryByText(/não tira o acesso/i)).not.toBeInTheDocument();
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

describe('o que acontece quando a pessoa não paga', () => {
  it('a tela diz que a assinatura não encerra sozinha', () => {
    // É a pergunta que surge ao dar uma assinatura, e a resposta não estava em
    // lugar nenhum da tela.
    montar();
    expect(screen.getByText(/Não encerra sozinha/)).toBeInTheDocument();
  });

  it('a vitalícia avisa que, com cobrança, entra na fila de inadimplentes', async () => {
    montar();
    await userEvent.click(screen.getByLabelText(VITALICIA));
    expect(screen.getByText(/fila de inadimplentes/)).toBeInTheDocument();
  });
});
