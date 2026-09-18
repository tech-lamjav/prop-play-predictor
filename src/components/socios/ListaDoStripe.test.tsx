import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListaDoStripe, type EstadoDoStripe } from './ListaDoStripe';
import { assinaturasDoStripe } from './crm-assinatura-do-stripe';
import { cadastroDeTeste as cadastro } from './crm-cadastro-de-teste';

const doGateway = (over = {}) =>
  cadastro({
    id: 'u1',
    name: 'Maria Silva',
    tem_assinatura_no_stripe: true,
    subscription_product_type: 'betinho',
    betinho_subscription_period_end: '2026-10-20T12:00:00Z',
    ...over,
  });

const pronto = (cadastros: ReturnType<typeof cadastro>[]): EstadoDoStripe => ({
  tipo: 'pronto',
  assinaturas: assinaturasDoStripe(cadastros),
});

const montar = (estado: EstadoDoStripe) =>
  render(
    <MemoryRouter>
      <ListaDoStripe estado={estado} />
    </MemoryRouter>,
  );

describe('ListaDoStripe', () => {
  it('mostra quem paga no cartão, com o produto e a renovação', () => {
    montar(pronto([doGateway()]));
    expect(screen.getByRole('link', { name: 'Maria Silva' })).toBeInTheDocument();
    expect(screen.getByText(/renova em 20\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/betinho no cartão/)).toBeInTheDocument();
  });

  it('sem data de renovação, DIZ que não sabe', () => {
    // ⚠️ Quem assina só o futebol não tem coluna de prazo, por decisão
    // registrada. Um traço ou um vazio aqui seria lido como "renova hoje" ou
    // como defeito da tela — e os dois levam à conversa errada.
    montar(pronto([doGateway({ betinho_subscription_period_end: null })]));
    expect(screen.getByText(/não sabemos/)).toBeInTheDocument();
  });

  it('o nome leva para a ficha', () => {
    montar(pronto([doGateway()]));
    expect(screen.getByRole('link', { name: 'Maria Silva' })).toHaveAttribute(
      'href',
      '/socios/crm/u1',
    );
  });

  it('NÃO oferece mensagem de cobrança', () => {
    // ⚠️ O gateway cobra e renova sozinho. Oferecer o texto de cobrança
    // convidaria o sócio a pedir Pix a quem já tem cartão passando, que é como
    // se produz pagamento em dobro.
    montar(pronto([doGateway()]));
    expect(screen.queryByRole('button', { name: /copiar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/quer renovar|Pix/i)).not.toBeInTheDocument();
  });

  it('não chama ninguém de inadimplente nem de devendo', () => {
    // A palavra é do outro eixo: inadimplente é conclusão nossa, derivada do
    // nosso registro de pagamento, e só vale para origem manual.
    montar(pronto([doGateway()]));
    expect(screen.queryByText(/inadimplente|devendo|em aberto/i)).not.toBeInTheDocument();
  });

  it('produto não gravado é dito, e não escondido', () => {
    montar(pronto([doGateway({ subscription_product_type: null })]));
    expect(screen.getByText(/produto não gravado/)).toBeInTheDocument();
  });

  it('carregando não é lista vazia', () => {
    // "Ninguém assinando" enquanto a consulta está no ar faria o sócio concluir
    // que o gateway não vendeu nada.
    montar({ tipo: 'carregando' });
    expect(screen.getByText(/Carregando quem paga no cartão/)).toBeInTheDocument();
    expect(screen.queryByText(/Ninguém assinando/)).not.toBeInTheDocument();
  });

  it('erro é erro, e não lista vazia', () => {
    montar({ tipo: 'erro' });
    expect(screen.getByText(/não dá para saber quem paga no cartão/)).toBeInTheDocument();
  });

  it('ninguém no cartão é dito com palavra', () => {
    montar(pronto([cadastro({ tem_assinatura_no_stripe: false })]));
    expect(screen.getByText(/Ninguém assinando pelo cartão ainda/)).toBeInTheDocument();
  });

  it('quem renova primeiro aparece primeiro', () => {
    montar(
      pronto([
        doGateway({ id: 'u2', name: 'Segunda', betinho_subscription_period_end: '2026-12-01T12:00:00Z' }),
        doGateway({ id: 'u1', name: 'Primeira', betinho_subscription_period_end: '2026-10-01T12:00:00Z' }),
      ]),
    );
    const nomes = screen.getAllByRole('link').map((l) => l.textContent);
    expect(nomes).toEqual(['Primeira', 'Segunda']);
  });
});
