import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Receita, type EstadoDaReceita } from './Receita';
import { montarPagamentos, type PagamentoDoBanco } from './crm-receita';
import type { EstadoDosPagamentos } from '@/hooks/use-pagamentos';

const HOJE = '2026-09-15';
const PARADO: EstadoDaReceita = { tipo: 'parado' };

const linha = (over: Partial<PagamentoDoBanco> = {}): PagamentoDoBanco => ({
  id: 'p1',
  competencia: '2026-09-01',
  valor: '39.90',
  origem: 'pix',
  pago_em: '2026-09-03',
  estornado_em: null,
  motivo_do_estorno: null,
  ...over,
});

const pronto = (linhas: PagamentoDoBanco[] = []): EstadoDosPagamentos => ({
  tipo: 'pronto',
  pagamentos: montarPagamentos(linhas),
});

function montar(props: Partial<Parameters<typeof Receita>[0]> = {}) {
  const aoLancar = vi.fn();
  const aoEstornar = vi.fn();
  render(
    <Receita
      hoje={HOJE}
      assinatura={{ comecouEm: '2026-09-01', valorMensal: 39.9, pagaNoCartao: false }}
      estado={pronto()}
      escrita={PARADO}
      aoLancar={aoLancar}
      aoEstornar={aoEstornar}
      {...props}
    />,
  );
  return { aoLancar, aoEstornar };
}

describe('o resumo', () => {
  it('soma o que entrou na mão', () => {
    montar({
      estado: pronto([
        linha({ id: 'a', competencia: '2026-08-01' }),
        linha({ id: 'b', competencia: '2026-09-01' }),
      ]),
      assinatura: { comecouEm: '2026-08-01', valorMensal: 39.9, pagaNoCartao: false },
    });
    expect(screen.getByText(/79,80/)).toBeInTheDocument();
  });

  it('estornado não conta na soma', () => {
    // É o ponto de existir estorno: um lançamento errado sai da conta sem sair
    // da tabela.
    montar({
      estado: pronto([
        linha({ id: 'a', competencia: '2026-08-01' }),
        linha({ id: 'b', competencia: '2026-09-01', estornado_em: '2026-09-10T12:00:00Z' }),
      ]),
      assinatura: { comecouEm: '2026-08-01', valorMensal: 39.9, pagaNoCartao: false },
    });
    expect(screen.getByText(/Recebido na mão:/)).toHaveTextContent('39,90');
  });

  it('explica a diferença entre os dois números', () => {
    // ⚠️ Este teste fixava a frase "Só o que entrou fora do Stripe", e ela
    // virou mentira quando a ficha passou a somar as duas origens — teste verde
    // segurando texto falso é pior que texto falso sozinho, porque dá a
    // impressão de que alguém conferiu.
    //
    // O que precisa estar na tela agora é a distinção: um número é o que
    // depende do sócio cobrar, o outro é tudo que a pessoa pagou.
    montar();
    expect(screen.getByText(/depende de você cobrar/i)).toBeInTheDocument();
    expect(screen.queryByText(/Só o que entrou fora do Stripe/i)).not.toBeInTheDocument();
  });

  it('quem deve aparece devendo, com quantos meses e quanto', () => {
    // O total é o que decide se vale insistir ou encerrar.
    montar({ assinatura: { comecouEm: '2026-07-01', valorMensal: 39.9, pagaNoCartao: false }, estado: pronto() });
    expect(screen.getByText(/devendo 3 meses/)).toBeInTheDocument();
    expect(screen.getByText(/119,70/)).toBeInTheDocument();
  });

  it('quem pagou o mês corrente está em dia', () => {
    montar({ estado: pronto([linha()]) });
    expect(screen.getByText('em dia')).toBeInTheDocument();
  });

  it('sem valor combinado é sem cobrança, e não devendo', () => {
    // Quem não combinou pagar não deve nada. Chamar isso de dívida encheria a
    // fila de gente que não tem o que pagar.
    montar({ assinatura: { comecouEm: '2026-01-01', valorMensal: null, pagaNoCartao: false } });
    expect(screen.getByText('sem cobrança')).toBeInTheDocument();
    expect(screen.queryByText(/devendo/)).not.toBeInTheDocument();
  });

  it('lista os meses em aberto, do mais antigo primeiro', () => {
    montar({ assinatura: { comecouEm: '2026-07-01', valorMensal: 39.9, pagaNoCartao: false } });
    expect(screen.getByText(/Em aberto: 07\/2026, 08\/2026, 09\/2026/)).toBeInTheDocument();
  });

  it('lista longa é resumida, e a tela DIZ que resumiu', () => {
    // ⚠️ Doze meses escritos por extenso embaixo de um selo dizendo "devendo
    // 18 meses" faria os dois números da MESMA tela se desmentirem. Resumir a
    // linha é legítimo, porque trinta e três meses escritos um a um não são
    // cobrança, são ruído. Resumir calado é o defeito.
    montar({ assinatura: { comecouEm: '2025-04-01', valorMensal: 39.9, pagaNoCartao: false } });
    expect(screen.getByText(/devendo 18 meses/)).toBeInTheDocument();
    expect(screen.getByText(/e mais 6/)).toBeInTheDocument();
  });

  it('o resumo corta os meses recentes, e o "e mais" vem no fim por isso', () => {
    // ⚠️ A ponta importa e quase passou batido. Cortando os ANTIGOS, a frase
    // ficava "Em aberto: 10/2025, …, 09/2026, e mais 6" — e esse "e mais 6" no
    // fim promete seis meses DEPOIS de setembro de 2026, quando os escondidos
    // eram os seis anteriores a outubro de 2025. O aviso apontava para a ponta
    // oposta à que tinha sido cortada.
    montar({ assinatura: { comecouEm: '2025-04-01', valorMensal: 39.9, pagaNoCartao: false } });
    expect(screen.getByText(/Em aberto: 04\/2025/)).toBeInTheDocument();
  });
});

describe('lançar um pagamento', () => {
  it('já vem no mês mais antigo em aberto e no valor combinado', async () => {
    // É o lançamento que o sócio vai fazer em quase toda visita. Campo vazio é
    // um passo a mais entre receber o Pix e registrá-lo, e é nesse passo que
    // ele deixa de ser registrado.
    const { aoLancar } = montar({ assinatura: { comecouEm: '2026-07-01', valorMensal: 39.9, pagaNoCartao: false } });
    expect(screen.getByLabelText('Mês de competência do pagamento')).toHaveValue('2026-07');
    await userEvent.click(screen.getByRole('button', { name: /Registrar pagamento/ }));
    expect(aoLancar).toHaveBeenCalledWith({
      mes: '2026-07',
      valor: 39.9,
      origem: 'pix',
      pagoEm: HOJE,
    });
  });

  it('com dívida longa, sugere o mês mais antigo DE VERDADE', async () => {
    // ⚠️ Efeito colateral bom de tirar o corte de dentro do cálculo, e que vale
    // travar com teste porque ninguém pediu por ele.
    //
    // A sugestão de lançamento é o primeiro mês em aberto. Enquanto a lista
    // vinha cortada nos doze mais recentes, quem devia dezoito meses não
    // conseguia lançar os seis mais antigos por aqui: eles não estavam na
    // lista, então o campo nunca os oferecia e a dívida mais velha ficava sem
    // caminho de quitação na tela.
    const { aoLancar } = montar({ assinatura: { comecouEm: '2025-04-01', valorMensal: 39.9, pagaNoCartao: false } });
    expect(screen.getByLabelText('Mês de competência do pagamento')).toHaveValue('2025-04');
    await userEvent.click(screen.getByRole('button', { name: /Registrar pagamento/ }));
    expect(aoLancar).toHaveBeenCalledWith({
      mes: '2025-04',
      valor: 39.9,
      origem: 'pix',
      pagoEm: HOJE,
    });
  });

  it('o padrão acompanha o que chega do banco, e não o que existia ao montar', () => {
    // ⚠️ O modal monta antes de os pagamentos chegarem. Um valor inicial fixo
    // nasceria com a lista vazia e ficaria preso no mês errado — o sócio
    // lançaria julho de novo achando que estava lançando agosto.
    const { rerender } = render(
      <Receita
        hoje={HOJE}
        assinatura={{ comecouEm: '2026-07-01', valorMensal: 39.9, pagaNoCartao: false }}
        estado={{ tipo: 'carregando' }}
        escrita={PARADO}
        aoLancar={vi.fn()}
        aoEstornar={vi.fn()}
      />,
    );
    rerender(
      <Receita
        hoje={HOJE}
        assinatura={{ comecouEm: '2026-07-01', valorMensal: 39.9, pagaNoCartao: false }}
        estado={pronto([linha({ competencia: '2026-07-01' })])}
        escrita={PARADO}
        aoLancar={vi.fn()}
        aoEstornar={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Mês de competência do pagamento')).toHaveValue('2026-08');
  });

  it('dá para lançar outro mês e outro valor', async () => {
    const { aoLancar } = montar();
    const mes = screen.getByLabelText('Mês de competência do pagamento');
    await userEvent.clear(mes);
    await userEvent.type(mes, '2026-10');
    const valor = screen.getByLabelText('Valor recebido');
    await userEvent.clear(valor);
    await userEvent.type(valor, '49,90');
    await userEvent.selectOptions(screen.getByLabelText('Origem do pagamento'), 'dinheiro');
    await userEvent.click(screen.getByRole('button', { name: /Registrar pagamento/ }));
    expect(aoLancar).toHaveBeenCalledWith({
      mes: '2026-10',
      valor: 49.9,
      origem: 'dinheiro',
      pagoEm: HOJE,
    });
  });

  it('o dia em que caiu pode ser diferente do mês pago', async () => {
    // Um Pix que cai em 2 de outubro pagando setembro. Sem os dois campos, a
    // competência viraria outubro e setembro seguiria em aberto.
    const { aoLancar } = montar();
    const dia = screen.getByLabelText('Dia em que o dinheiro caiu');
    await userEvent.clear(dia);
    await userEvent.type(dia, '2026-09-02');
    await userEvent.click(screen.getByRole('button', { name: /Registrar pagamento/ }));
    expect(aoLancar).toHaveBeenCalledWith(expect.objectContaining({ pagoEm: '2026-09-02' }));
  });

  it('o Stripe não está entre as origens para escolher', () => {
    // Ninguém lança Stripe na mão: quem paga por lá já tem registro lá.
    montar();
    const origens = screen.getByLabelText('Origem do pagamento');
    expect(origens).not.toHaveTextContent(/stripe/i);
  });

  it('valor ilegível trava a gravação', async () => {
    // Um número errado de dinheiro é pior que número nenhum: o sócio age em
    // cima dele, cobrando quem pagou ou deixando de cobrar quem não pagou.
    const { aoLancar } = montar();
    const valor = screen.getByLabelText('Valor recebido');
    await userEvent.clear(valor);
    await userEvent.type(valor, 'trinta e nove');
    expect(screen.getByRole('button', { name: /Registrar pagamento/ })).toBeDisabled();
    expect(aoLancar).not.toHaveBeenCalled();
  });

  it('valor em branco também trava: sem valor não há pagamento', async () => {
    const { aoLancar } = montar();
    await userEvent.clear(screen.getByLabelText('Valor recebido'));
    expect(screen.getByRole('button', { name: /Registrar pagamento/ })).toBeDisabled();
    expect(aoLancar).not.toHaveBeenCalled();
  });

  it('enquanto grava, não dá para gravar de novo', () => {
    // Dois cliques lançariam o mesmo mês duas vezes, e o índice único derrubaria
    // o segundo com um erro de banco na cara do sócio.
    montar({ escrita: { tipo: 'salvando' } });
    expect(screen.getByRole('button', { name: /Gravando/ })).toBeDisabled();
  });

  it('quando falha, diz o motivo', () => {
    montar({ escrita: { tipo: 'erro', recado: 'Esse mês já foi lançado.' } });
    expect(screen.getByText(/já foi lançado/)).toBeInTheDocument();
  });
});

describe('o histórico', () => {
  it('mostra mês, origem, valor e o dia em que caiu', () => {
    // Pela linha, e não por texto solto: "Pix" também é uma opção do seletor
    // de origem logo acima, e casar com ela deixaria o teste verde sem o
    // histórico existir.
    montar({ estado: pronto([linha({ pago_em: '2026-10-02' })]) });
    const lancamento = screen.getByRole('listitem');
    expect(lancamento).toHaveTextContent('09/2026');
    expect(lancamento).toHaveTextContent('Pix');
    expect(lancamento).toHaveTextContent('39,90');
    expect(lancamento).toHaveTextContent('Caiu em 02/10/2026');
  });

  it('sem pagamento, diz que não há, em vez de ficar em branco', () => {
    montar();
    expect(screen.getByText(/Nenhum pagamento registrado ainda/)).toBeInTheDocument();
  });

  it('estornar pede motivo antes de mandar', async () => {
    // O banco recusa sem motivo. Sem o campo, o sócio veria um erro de função
    // em vez de saber que faltou escrever.
    const { aoEstornar } = montar({ estado: pronto([linha()]) });
    await userEvent.click(screen.getByRole('button', { name: 'Estornar' }));
    expect(aoEstornar).not.toHaveBeenCalled();

    const motivo = screen.getByLabelText(/Motivo do estorno de 09\/2026/);
    await userEvent.type(motivo, 'lancei no mês errado');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(aoEstornar).toHaveBeenCalledWith('p1', 'lancei no mês errado');
  });

  it('motivo só com espaço não confirma', async () => {
    const { aoEstornar } = montar({ estado: pronto([linha()]) });
    await userEvent.click(screen.getByRole('button', { name: 'Estornar' }));
    await userEvent.type(screen.getByLabelText(/Motivo do estorno/), '   ');
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    expect(aoEstornar).not.toHaveBeenCalled();
  });

  it('o estornado continua na lista, marcado e com o motivo', () => {
    // ⚠️ Some da soma, não da lista. Um registro de dinheiro que desaparece da
    // tela é um registro que ninguém consegue auditar.
    montar({
      estado: pronto([
        linha({ estornado_em: '2026-09-10T12:00:00Z', motivo_do_estorno: 'mês errado' }),
      ]),
    });
    expect(screen.getByText('estornado')).toBeInTheDocument();
    expect(screen.getByText(/mês errado/)).toBeInTheDocument();
    expect(screen.getByText(/acesso não foi recuado/i)).toBeInTheDocument();
  });

  it('o que já foi estornado não estorna de novo', () => {
    montar({ estado: pronto([linha({ estornado_em: '2026-09-10T12:00:00Z' })]) });
    expect(screen.queryByRole('button', { name: 'Estornar' })).not.toBeInTheDocument();
  });
});

describe('quando não há o que mostrar', () => {
  it('sem assinatura manual, explica em vez de mostrar formulário', () => {
    // Pagamento pendura em assinatura. Um formulário aqui não teria onde
    // gravar, e o sócio descobriria isso só depois de preencher.
    montar({ assinatura: null });
    expect(screen.getByText(/Sem assinatura dada na mão/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Registrar pagamento/ })).not.toBeInTheDocument();
  });

  it('carregando não é lista vazia', () => {
    // ⚠️ Lista vazia quer dizer "nunca pagou", e o sócio cobra em cima disso.
    montar({ estado: { tipo: 'carregando' } });
    expect(screen.getByText(/Carregando os pagamentos/)).toBeInTheDocument();
  });

  it('erro diz que não dá para cobrar em cima disso', () => {
    montar({ estado: { tipo: 'erro' } });
    expect(screen.getByText(/cobrar seria chute/i)).toBeInTheDocument();
  });
});

describe('quem está devendo', () => {
  it('é avisado de que a assinatura não encerra sozinha', () => {
    // Ver "devendo 3 meses" sem saber o que acontece em seguida leva a
    // esperar um corte que não vem.
    montar({ assinatura: { comecouEm: '2026-07-01', valorMensal: 39.9, pagaNoCartao: false } });
    expect(screen.getByText(/não encerra sozinha/)).toBeInTheDocument();
  });

  it('quem está em dia não recebe o aviso', () => {
    montar({ estado: pronto([linha()]) });
    expect(screen.queryByText(/não encerra sozinha/)).not.toBeInTheDocument();
  });
});

describe('a virada para o cartão, na ficha', () => {
  it('⚠️ a ficha DIZ desde quando o cartão assumiu', () => {
    // Sem esta frase, o sócio vê a conta parar num mês qualquer e conclui que o
    // sistema esqueceu de contar.
    montar({
      assinatura: { comecouEm: '2026-06-01', valorMensal: 39.9, pagaNoCartao: true },
      estado: pronto([
        linha({ id: 'g1', competencia: '2026-08-01', origem: 'stripe', valor: '49.90' }),
      ]),
    });
    expect(screen.getByText(/também paga no cartão desde 08\/2026/)).toBeInTheDocument();
  });

  it('e os meses anteriores à virada continuam listados', () => {
    // A outra metade: o acordo na mão existiu, e o que não foi pago naquele
    // tempo continua devido. A frase da virada não pode virar perdão.
    montar({
      assinatura: { comecouEm: '2026-06-01', valorMensal: 39.9, pagaNoCartao: true },
      estado: pronto([
        linha({ id: 'g1', competencia: '2026-08-01', origem: 'stripe', valor: '49.90' }),
      ]),
    });
    expect(screen.getByText(/Em aberto: 06\/2026, 07\/2026/)).toBeInTheDocument();
  });

  it('sem cartão, a ficha não fala de virada nenhuma', () => {
    montar({ assinatura: { comecouEm: '2026-07-01', valorMensal: 39.9, pagaNoCartao: false } });
    expect(screen.queryByText(/também paga no cartão desde/)).not.toBeInTheDocument();
  });
});
