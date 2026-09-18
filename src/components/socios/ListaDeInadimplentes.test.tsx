import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListaDeInadimplentes, type EstadoDosInadimplentes } from './ListaDeInadimplentes';
import { inadimplentes, montarAssinaturas, type AssinaturaDoBanco } from './crm-assinatura';
import { cadastroDeTeste as cadastro } from './crm-cadastro-de-teste';

const HOJE = '2026-09-15';

const linha = (over: Partial<AssinaturaDoBanco> = {}): AssinaturaDoBanco => ({
  id: 'a1',
  user_id: 'u1',
  plano: 'essencial',
  vence_em: '2026-10-20',
  valor_mensal: '39.90',
  criada_em: '2026-07-10T15:00:00Z',
  criada_por: null,
  ...over,
});

const pronto = (linhas: AssinaturaDoBanco[]): EstadoDosInadimplentes => ({
  tipo: 'pronto',
  inadimplentes: inadimplentes(
    montarAssinaturas(linhas, [cadastro({ id: 'u1', name: 'Maria' })]),
    new Map(),
    HOJE,
  ),
});

const montar = (estado: EstadoDosInadimplentes) =>
  render(
    <MemoryRouter>
      <ListaDeInadimplentes estado={estado} />
    </MemoryRouter>,
  );

describe('ListaDeInadimplentes', () => {
  it('diz quem deve, quantos meses e quanto', () => {
    // O total é o que decide se vale insistir ou encerrar.
    montar(pronto([linha()]));
    expect(screen.getByText(/devendo 3 meses/)).toHaveTextContent('119,70');
  });

  it('lista os meses em aberto, do mais antigo primeiro', () => {
    montar(pronto([linha()]));
    expect(screen.getByText(/Em aberto: 07\/2026, 08\/2026, 09\/2026/)).toBeInTheDocument();
  });

  it('lista longa é resumida, e a tela DIZ que resumiu', () => {
    // ⚠️ Aqui o resumo calado custa mais caro que na ficha: esta fila é
    // ordenada PELO TOTAL, e o total é o que decide insistir ou encerrar. Uma
    // linha que mostra doze meses embaixo de um selo de dezoito faz o sócio
    // duvidar do número que ele usa para decidir.
    montar(pronto([linha({ criada_em: '2025-04-10T15:00:00Z' })]));
    expect(screen.getByText(/devendo 18 meses/)).toHaveTextContent('718,20');
    expect(screen.getByText(/e mais 6/)).toBeInTheDocument();
  });

  it('a dívida mais VELHA é a que a linha mostra', () => {
    // ⚠️ Esta fila existe para decidir insistir ou encerrar, e é a idade da
    // dívida que responde isso. Resumir cortando os meses antigos jogava fora
    // exatamente o dado pelo qual a fila existe.
    montar(pronto([linha({ criada_em: '2025-04-10T15:00:00Z' })]));
    expect(screen.getByText(/Em aberto: 04\/2025/)).toBeInTheDocument();
  });

  it('o nome leva para a ficha, onde se registra o Pix e se encerra', () => {
    // Não há botão de encerrar aqui de propósito: cortar o acesso de um
    // cliente é decisão tomada olhando o histórico de pagamento.
    montar(pronto([linha()]));
    expect(screen.getByRole('link', { name: 'Maria' })).toHaveAttribute('href', '/socios/crm/u1');
    expect(screen.queryByRole('button', { name: /encerrar/i })).not.toBeInTheDocument();
    expect(screen.getByText(/aba Planos/)).toBeInTheDocument();
  });

  it('vitalícia com cobrança aparece dizendo que é vitalícia', () => {
    montar(pronto([linha({ vence_em: null })]));
    expect(screen.getByText(/na mão, vitalícia/)).toBeInTheDocument();
  });

  it('diz que ninguém é encerrado sozinho', () => {
    montar(pronto([linha()]));
    expect(screen.getByText(/Ninguém sai daqui encerrado sozinho/)).toBeInTheDocument();
  });

  it('ninguém devendo é dito com palavra', () => {
    montar(pronto([linha({ valor_mensal: null })]));
    expect(screen.getByText(/Ninguém devendo/)).toBeInTheDocument();
  });

  it('carregando não é lista vazia', () => {
    // "Ninguém devendo" enquanto a consulta está no ar faria o sócio deixar de
    // cobrar quem deve.
    montar({ tipo: 'carregando' });
    expect(screen.getByText(/Carregando quem está devendo/)).toBeInTheDocument();
    expect(screen.queryByText(/Ninguém devendo/)).not.toBeInTheDocument();
  });

  it('erro é erro, e não fila vazia', () => {
    montar({ tipo: 'erro' });
    expect(screen.getByText(/estaria chutando/)).toBeInTheDocument();
  });
});
