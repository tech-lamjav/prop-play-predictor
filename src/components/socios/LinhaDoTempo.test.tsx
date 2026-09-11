import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinhaDoTempo } from './LinhaDoTempo';
import { linhaDoTempo } from './crm-linha-do-tempo';

const ITENS = linhaDoTempo(
  [
    {
      id: 'f1',
      tipo: 'feedback',
      texto: 'achou o Betinho confuso no começo',
      criada_em: '2026-09-10T12:00:00Z',
      criada_por: 's1',
    },
    {
      id: 'n1',
      tipo: 'anotacao',
      texto: 'ligou e pediu para retomar semana que vem',
      criada_em: '2026-09-09T12:00:00Z',
      criada_por: 's1',
    },
  ],
  [{ id: 'e1', de: 'novo', para: 'contatado', em: '2026-09-08T12:00:00Z', por: 's2' }],
);

const montar = (over: Partial<Parameters<typeof LinhaDoTempo>[0]> = {}) =>
  render(
    <LinhaDoTempo
      estado={{ tipo: 'pronta', itens: ITENS }}
      nomeDoSocio={(id) => (id === 's1' ? 'Diogo' : 'Mateus')}
      aoAnotar={vi.fn().mockResolvedValue(undefined)}
      anotando={false}
      erroAoAnotar={null}
      {...over}
    />,
  );

const campo = () => screen.getByRole('textbox', { name: /anotação/i });
const botao = () => screen.getByRole('button', { name: 'Registrar na linha do tempo' });

describe('LinhaDoTempo', () => {
  it('mostra anotações e mudanças de etapa na mesma lista', () => {
    montar();
    const lista = screen.getByRole('list', { name: /linha do tempo/i });
    expect(within(lista).getByText(/achou o Betinho confuso/)).toBeInTheDocument();
    expect(within(lista).getByText(/Novo.*Contatado/)).toBeInTheDocument();
  });

  it('diz qual sócio registrou cada coisa', () => {
    // Numa linha do tempo que existe para saber quem falou com quem, o autor
    // não é enfeite.
    montar();
    expect(screen.getAllByText(/Diogo/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Mateus/)).toBeInTheDocument();
  });

  it('dá para ver só os feedbacks', async () => {
    montar();
    await userEvent.click(screen.getByRole('checkbox', { name: /só feedbacks/i }));
    expect(screen.getByText(/achou o Betinho confuso/)).toBeInTheDocument();
    expect(screen.queryByText(/pediu para retomar/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Novo.*Contatado/)).not.toBeInTheDocument();
  });

  it('anotação vazia não grava', async () => {
    // A restrição existe no banco também, mas deixar o botão vivo faz o sócio
    // clicar e receber um erro por algo que a tela já sabia.
    const aoAnotar = vi.fn().mockResolvedValue(undefined);
    montar({ aoAnotar });
    expect(botao()).toBeDisabled();
    await userEvent.type(campo(), '   ');
    expect(botao()).toBeDisabled();
    expect(aoAnotar).not.toHaveBeenCalled();
  });

  it('registra com o tipo escolhido, e aparado', async () => {
    const aoAnotar = vi.fn().mockResolvedValue(undefined);
    montar({ aoAnotar });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /tipo/i }), 'objecao');
    await userEvent.type(campo(), '  achou caro  ');
    await userEvent.click(botao());
    expect(aoAnotar).toHaveBeenCalledWith('objecao', 'achou caro');
  });

  it('gravando com sucesso, o campo fica limpo para a próxima', async () => {
    montar();
    await userEvent.type(campo(), 'primeira');
    await userEvent.click(botao());
    expect(campo()).toHaveValue('');
  });

  it('gravando com FALHA, o texto do sócio continua lá', async () => {
    // O defeito que isto impede: a primeira versão limpava o campo na linha
    // seguinte ao clique, sem esperar o resultado. Uma falha do banco apagava
    // trinta minutos de conversa e ainda mostrava "tente de novo" com o campo
    // em branco. E o teste que dizia guardar isso nunca digitava nada.
    const aoAnotar = vi.fn().mockRejectedValue(new Error('caiu'));
    montar({ aoAnotar });
    await userEvent.type(campo(), 'trinta minutos de conversa');
    await userEvent.click(botao());
    expect(campo()).toHaveValue('trinta minutos de conversa');
  });

  it('enquanto grava, não aceita um segundo clique', () => {
    montar({ anotando: true });
    expect(botao()).toBeDisabled();
  });

  it('o aviso de falha é o que quem chama mandou dizer', async () => {
    // Perder a marca de sócio não se resolve tentando de novo, e a mensagem
    // certa para cada caso é decidida fora daqui.
    montar({ erroAoAnotar: 'Sua conta não está mais marcada como sócio.' });
    expect(screen.getByText(/não está mais marcada como sócio/i)).toBeInTheDocument();
  });

  it('linha do tempo vazia é dita com palavra', () => {
    montar({ estado: { tipo: 'pronta', itens: [] } });
    expect(screen.getByText(/nada registrado ainda/i)).toBeInTheDocument();
  });

  it('filtro sem resultado fala do filtro, não da pessoa', async () => {
    montar({ estado: { tipo: 'pronta', itens: ITENS.filter((i) => i.natureza === 'etapa') } });
    await userEvent.click(screen.getByRole('checkbox', { name: /só feedbacks/i }));
    expect(screen.getByText(/nenhum feedback registrado ainda/i)).toBeInTheDocument();
  });

  it('enquanto carrega, não afirma que está vazia', () => {
    montar({ estado: { tipo: 'carregando' } });
    expect(screen.queryByText(/nada registrado ainda/i)).not.toBeInTheDocument();
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('falhar ao carregar não vira lista vazia', () => {
    montar({ estado: { tipo: 'erro' } });
    expect(screen.getByText(/não deu para carregar/i)).toBeInTheDocument();
    expect(screen.queryByText(/nada registrado ainda/i)).not.toBeInTheDocument();
  });
});
