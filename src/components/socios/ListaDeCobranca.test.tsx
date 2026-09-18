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
  valor_mensal: '39.90',
  criada_em: '2026-09-01T12:00:00Z',
  // Esta tela não usa o começo para nada: ela ordena por vencimento. Fica o
  // mesmo dia do cadastro, que é o caso normal.
  comecou_em: '2026-09-01',
  criada_por: 's1',
  ...over,
});

function montar(estado: EstadoDasAssinaturas, noCartao = 0) {
  return render(
    <MemoryRouter>
      <ListaDeCobranca
        estado={estado}
        hoje={HOJE}
        vazio="Ninguém para cobrar agora."
        noCartao={noCartao}
      />
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

  it('diz quanto a pessoa paga por mês', () => {
    // A fila é lida antes de ligar para alguém, e "quanto ele paga" é metade da
    // conversa. Sem isso o sócio abre a ficha só para ver o número.
    montar(pronto([linha()]));
    expect(screen.getByText(/R\$ 39,90 por mês/)).toBeInTheDocument();
  });

  it('sem valor combinado, diz sem cobrança em vez de R$ 0,00', () => {
    montar(pronto([linha({ valor_mensal: null })]));
    expect(screen.getByText(/sem cobrança/i)).toBeInTheDocument();
  });

  it('a vitalícia diz que não vence, e não mostra data nenhuma', () => {
    // Ela só aparece no recorte "Todas", porque a fila a cobrar a exclui. Mas
    // aparece, e uma data vazia ali leria como dado faltando.
    montar(pronto([linha({ vence_em: null })]));
    expect(screen.getByText(/não vence/)).toBeInTheDocument();
    expect(screen.getByText(/Essencial na mão, vitalícia/)).toBeInTheDocument();
  });

  it('a vitalícia não vem com mensagem de cobrança', () => {
    // ⚠️ Toda mensagem de cobrança fala de uma data que está chegando, e para
    // quem não tem data nenhuma dessas frases é verdade. Uma mensagem dizendo
    // "seu acesso vai até " com o final vazio é o que o sócio colaria no
    // WhatsApp do cliente.
    montar(pronto([linha({ vence_em: null })]));
    expect(screen.queryByRole('button', { name: /Copiar/i })).not.toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: 'Maria' })).toHaveAttribute('href', '/socios/crm/u1');
  });

  it('desenha uma cobrança por concessão', () => {
    // Sem número nos dois: aqui se conta o link do NOME, e quem tem telefone
    // ganha também o link de abrir o WhatsApp — que é assunto do bloco abaixo.
    const cadastros = [
      cadastro({ id: 'u1', name: 'Maria', whatsapp_number: null }),
      cadastro({ id: 'u2', name: 'João', whatsapp_number: null }),
    ];
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

describe('quem também paga no cartão', () => {
  const noCartao = [cadastro({ id: 'u1', name: 'Maria', tem_assinatura_no_stripe: true })];

  it('a linha diz que a pessoa também paga no cartão', () => {
    // Em "Todas" essa pessoa aparece, e sem o selo o sócio mandaria a mensagem
    // de renovação para quem já renova sozinho.
    montar(pronto([linha()], noCartao));
    expect(screen.getByText(/Também paga no cartão/)).toBeInTheDocument();
    expect(screen.getByText(/parou de acumular mês/)).toBeInTheDocument();
  });

  it('e quem não paga não recebe selo nenhum', () => {
    // Selo em todo mundo é selo que ninguém lê.
    montar(pronto([linha()]));
    expect(screen.queryByText(/Também paga no cartão/)).not.toBeInTheDocument();
  });

  it('⚠️ o rodapé DIZ quantos saíram da fila', () => {
    // Sumiço silencioso é a mesma família de defeito do encerramento que
    // rebaixava acesso sem avisar: a fila encolhe e o sócio não sabe por quê.
    montar(pronto([linha()]), 2);
    expect(screen.getByText(/2 pessoas saíram desta fila/)).toBeInTheDocument();
  });

  it('uma pessoa é dita no singular', () => {
    montar(pronto([linha()]), 1);
    expect(screen.getByText(/1 pessoa saiu desta fila/)).toBeInTheDocument();
  });

  it('⚠️ e o rodapé aparece MESMO com a fila vazia', () => {
    // O caso que mais importa, e o que a primeira versão errava: a lista vazia
    // saía por um desvio que pulava o rodapé. O sócio lia "ninguém para
    // cobrar", fechava a tela, e nunca ficava sabendo que havia gente escondida
    // ali dentro.
    montar({ tipo: 'pronto', assinaturas: [] }, 3);
    expect(screen.getByText(/Ninguém para cobrar agora/)).toBeInTheDocument();
    expect(screen.getByText(/3 pessoas saíram desta fila/)).toBeInTheDocument();
  });

  it('sem ninguém escondido, não há rodapé', () => {
    montar(pronto([linha()]), 0);
    expect(screen.queryByText(/saíram desta fila|saiu desta fila/)).not.toBeInTheDocument();
  });
});
