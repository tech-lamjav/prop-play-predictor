import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListaDeCobranca } from './ListaDeCobranca';
import { montarAssinaturas, type AssinaturaDoBanco } from './crm-assinatura';
import { cadastroDeTeste as cadastro } from './crm-cadastro-de-teste';
import type { EstadoDasAssinaturas } from '@/hooks/use-assinaturas';

const HOJE = '2026-09-12';

const linha = (over: Partial<AssinaturaDoBanco> = {}): AssinaturaDoBanco => ({
  id: 'a1',
  user_id: 'u1',
  plano: 'essencial',
  vence_em: '2026-09-20',
  criada_em: '2026-09-01T12:00:00Z',
  criada_por: 's1',
  ...over,
});

function montar(estado: EstadoDasAssinaturas) {
  return render(
    <MemoryRouter>
      <ListaDeCobranca estado={estado} hoje={HOJE} vazio="Ninguém para cobrar agora." />
    </MemoryRouter>,
  );
}

const pronto = (linhas: AssinaturaDoBanco[], cadastros = [cadastro({ id: 'u1', name: 'Maria' })]) =>
  ({ tipo: 'pronto', assinaturas: montarAssinaturas(linhas, cadastros) }) as const;

describe('ListaDeCobranca', () => {
  it('diz quem, qual plano, e quando vence', () => {
    montar(pronto([linha()]));
    expect(screen.getByRole('link', { name: 'Maria' })).toBeInTheDocument();
    expect(screen.getByText(/Essencial na mão, até 20\/09\/2026/)).toBeInTheDocument();
  });

  it('diz quanto falta, e não só a data', () => {
    // "Vence em 20/09" obriga o sócio a fazer a conta na cabeça toda vez que
    // desce a lista, e é essa conta que decide para quem ele liga primeiro.
    montar(pronto([linha()]));
    expect(screen.getByText(/vence em 8 dias/)).toBeInTheDocument();
  });

  it('quem já venceu fala no passado', () => {
    montar(pronto([linha({ vence_em: '2026-09-05' })]));
    expect(screen.getByText(/venceu faz 7 dias/)).toBeInTheDocument();
  });

  it('quem vence hoje tem frase própria', () => {
    montar(pronto([linha({ vence_em: HOJE })]));
    expect(screen.getByText('vence hoje')).toBeInTheDocument();
  });

  it('a mensagem de cobrança já vem escrita, sem precisar de clique', () => {
    // O trabalho aqui é copiar e colar num WhatsApp. Cada clique entre ver a
    // pessoa e ter o texto na mão é um motivo a mais para deixar para depois.
    montar(pronto([linha()]));
    const campo = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(campo.value).toContain('Essencial');
    expect(campo.value).toContain('20/09/2026');
  });

  it('a mensagem fala com a pessoa certa, pelo primeiro nome', () => {
    montar(pronto([linha()], [cadastro({ id: 'u1', name: 'Maria Silva' })]));
    const campo = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(campo.value).toContain('Oi, Maria!');
  });

  it('carregando não é lista vazia', () => {
    // Uma fila vazia diz ao sócio que ninguém precisa ser cobrado, e ele fecha
    // a tela em cima disso.
    montar({ tipo: 'carregando' });
    expect(screen.queryByText('Ninguém para cobrar agora.')).not.toBeInTheDocument();
    expect(screen.getByText(/Carregando/)).toBeInTheDocument();
  });

  it('erro também não é lista vazia', () => {
    montar({ tipo: 'erro' });
    expect(screen.queryByText('Ninguém para cobrar agora.')).not.toBeInTheDocument();
    expect(screen.getByText(/Não deu para carregar/)).toBeInTheDocument();
  });

  it('lista vazia mostra a frase de quem chamou', () => {
    montar({ tipo: 'pronto', assinaturas: [] });
    expect(screen.getByText('Ninguém para cobrar agora.')).toBeInTheDocument();
  });

  it('cada nome leva à ficha daquela pessoa', () => {
    montar(pronto([linha()]));
    expect(screen.getByRole('link', { name: 'Maria' })).toHaveAttribute('href', '/socios/u1');
  });

  it('desenha uma cobrança por concessão', () => {
    const cadastros = [cadastro({ id: 'u1', name: 'Maria' }), cadastro({ id: 'u2', name: 'João' })];
    montar(
      pronto([linha(), linha({ id: 'a2', user_id: 'u2', vence_em: '2026-09-14' })], cadastros),
    );
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    // E na ordem de quem vence primeiro.
    const nomes = screen.getAllByRole('link').map((l) => l.textContent);
    expect(nomes).toEqual(['João', 'Maria']);
  });
});

describe('a mensagem tem como ir para o WhatsApp', () => {
  it('quando há número', () => {
    montar(
      pronto([linha()], [cadastro({ id: 'u1', name: 'Maria', whatsapp_number: '5511998877665' })]),
    );
    expect(screen.getByRole('link', { name: /WhatsApp/i })).toBeInTheDocument();
  });

  it('e some quando não há, em vez de abrir uma aba em branco', () => {
    montar(pronto([linha()], [cadastro({ id: 'u1', name: 'Maria', whatsapp_number: null })]));
    const links = within(document.body).queryAllByRole('link', { name: /WhatsApp/i });
    expect(links).toHaveLength(0);
  });
});
