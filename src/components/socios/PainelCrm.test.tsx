import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PainelCrm } from './PainelCrm';
import { cadastroDeTeste as cadastro } from './crm-cadastro-de-teste';
import type { Cadastro } from './crm-lista';
import type { Apostas, Toques } from './crm-painel';
import type { EstadoDoMovimento } from '@/hooks/use-painel-do-crm';
import type { EstadoDasEtapas } from '@/hooks/use-etapas';

// ============================================================================
// O painel responde "com quem eu falo agora"
// ============================================================================
// A primeira versão desta tela era uma lista por dia, e o diagnóstico foi que
// ela parecia um registro do que aconteceu, e não um CRM. Estes testes guardam
// a diferença: os números no topo, o funil clicável, e a FILA na frente da
// lista.
// ============================================================================

const HOJE = '2026-09-11';

const base = [
  cadastro({ id: 'a', name: 'Maria Silva', email: 'maria@exemplo.com' }),
  cadastro({
    id: 'b',
    name: 'João Souza',
    email: 'joao@exemplo.com',
    created_at: '2026-09-08T12:00:00Z',
  }),
];

function montar({
  cadastros = base,
  etapas = {} as Record<string, string>,
  toques = {} as Toques,
  apostas = {} as Apostas,
  totalNaBase,
  estadoDasEtapas,
  estadoDoMovimento,
}: {
  cadastros?: Cadastro[];
  etapas?: Record<string, string>;
  toques?: Toques;
  apostas?: Apostas;
  totalNaBase?: number;
  estadoDasEtapas?: EstadoDasEtapas;
  estadoDoMovimento?: EstadoDoMovimento;
} = {}) {
  return render(
    <MemoryRouter>
      <PainelCrm
        estado={{ tipo: 'pronto', cadastros, totalNaBase: totalNaBase ?? cadastros.length }}
        etapas={estadoDasEtapas ?? { tipo: 'pronto', etapas }}
        movimento={estadoDoMovimento ?? { tipo: 'pronto', movimento: { toques, apostas } }}
        hoje={HOJE}
      />
    </MemoryRouter>,
  );
}

const funil = () => screen.getByRole('region', { name: 'Funil' });
const degrau = (nome: RegExp) => within(funil()).getByRole('button', { name: nome });

describe('PainelCrm · os números do topo', () => {
  it('mostra cadastros do mês, conversão e abordados', () => {
    montar({ etapas: { b: 'contatado' }, cadastros: [...base, cadastro({ id: 'c', futebol_subscription_status: 'premium' })] });
    const topo = screen.getByRole('region', { name: 'Números da operação' });
    expect(within(topo).getByLabelText('Cadastros em 30 dias')).toHaveTextContent(/^3$/);
    expect(within(topo).getByLabelText('Conversão')).toHaveTextContent(/^33%$/);
    expect(within(topo).getByLabelText('Abordados')).toHaveTextContent(/^33%$/);
  });

  it('base sem assinante não vira NaN', () => {
    // Um "NaN%" na primeira dobra faz o sócio desconfiar de todos os outros
    // números da tela.
    montar();
    const topo = screen.getByRole('region', { name: 'Números da operação' });
    expect(within(topo).getByLabelText('Conversão')).toHaveTextContent(/^0%$/);
  });
});

describe('PainelCrm · o funil', () => {
  it('desenha as oito posições, inclusive as vazias', () => {
    // Degrau com zero precisa aparecer: a faixa mostra a FORMA do funil, e um
    // degrau que some esconde justamente onde está o gargalo.
    montar();
    expect(within(funil()).getAllByRole('button')).toHaveLength(8);
  });

  it('marca as duas posições que o banco responde', () => {
    montar();
    expect(within(funil()).getAllByText(/o banco responde/i)).toHaveLength(2);
  });

  it('quem assina aparece como assinante, e não na etapa manual', () => {
    // O estado calculado vence a etapa: mostrar a pessoa nos dois lugares faria
    // o funil somar duas vezes o mesmo lead.
    montar({
      cadastros: [cadastro({ id: 'a', futebol_subscription_status: 'premium' })],
      etapas: { a: 'interesse' },
    });
    expect(degrau(/Assinante/)).toHaveTextContent('1');
    expect(degrau(/Interesse/)).toHaveTextContent('0');
  });

  it('clicar num degrau filtra a lista', async () => {
    montar({ etapas: { b: 'contatado' } });
    await userEvent.click(screen.getByRole('tab', { name: 'Todos' }));
    await userEvent.click(degrau(/Contatado/));
    expect(screen.getByText('João Souza')).toBeInTheDocument();
    expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
  });

  it('clicar de novo no mesmo degrau limpa o filtro', async () => {
    // Sem isso, sair do filtro exige achar um botão em outro canto da tela.
    montar({ etapas: { b: 'contatado' } });
    await userEvent.click(screen.getByRole('tab', { name: 'Todos' }));
    await userEvent.click(degrau(/Contatado/));
    await userEvent.click(degrau(/Contatado/));
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
  });

  it('enquanto as etapas não chegam, o funil não afirma nada', () => {
    montar({ estadoDasEtapas: { tipo: 'carregando' } });
    expect(screen.queryByRole('region', { name: 'Funil' })).not.toBeInTheDocument();
    expect(screen.getByText(/carregando o funil/i)).toBeInTheDocument();
  });
});

describe('PainelCrm · as abas', () => {
  it('abre na fila de trabalho, e não na lista', () => {
    // A fila é a resposta para "com quem eu falo agora". Abrir na lista faria a
    // tela voltar a ser um registro do que aconteceu.
    montar();
    expect(screen.getByRole('tab', { name: 'Fila de trabalho' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('region', { name: 'Nunca abordados' })).toBeInTheDocument();
  });

  it('separa conversas esfriando de quem nunca foi abordado', () => {
    // Numa lista só, a fila de retomada sumiria embaixo da de primeiro
    // contato, que é sempre muito maior.
    montar({
      etapas: { b: 'contatado' },
      toques: { b: '2026-08-01T12:00:00Z' },
    });
    const esfriando = screen.getByRole('region', { name: 'Conversas esfriando' });
    expect(within(esfriando).getByText('João Souza')).toBeInTheDocument();
    const nunca = screen.getByRole('region', { name: 'Nunca abordados' });
    expect(within(nunca).getByText('Maria Silva')).toBeInTheDocument();
  });

  it('a aba Todos mostra a tabela com há quantos dias o lead está parado', async () => {
    montar({ etapas: { b: 'contatado' }, toques: { b: '2026-09-04T12:00:00Z' } });
    await userEvent.click(screen.getByRole('tab', { name: 'Todos' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('7d')).toBeInTheDocument();
  });

  it('a aba Por dia agrupa pelo dia de Brasília', async () => {
    montar();
    await userEvent.click(screen.getByRole('tab', { name: 'Por dia' }));
    expect(screen.getByText(/10\/09\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/08\/09\/2026/)).toBeInTheDocument();
  });
});

describe('PainelCrm · a base', () => {
  it('a busca filtra as três abas', async () => {
    montar();
    await userEvent.type(screen.getByRole('searchbox'), 'maria');
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.queryByText('João Souza')).not.toBeInTheDocument();
  });

  it('o gancho aparece na tabela, porque é o que decide a abordagem', async () => {
    // É a razão de o CRM existir: um assinante do Essencial cujo olho brilhou
    // no Betinho precisa ser abordado por Betinho.
    montar({ apostas: { a: 12 } });
    await userEvent.click(screen.getByRole('tab', { name: 'Todos' }));
    expect(screen.getByText('Betinho')).toBeInTheDocument();
  });

  it('cada nome leva à ficha daquela pessoa', () => {
    montar();
    expect(screen.getByRole('link', { name: 'Maria Silva' })).toHaveAttribute(
      'href',
      '/socios/a',
    );
  });

  it('base vazia é dita com palavra, sem números zerados em cima', () => {
    montar({ cadastros: [] });
    expect(screen.getByText(/nenhum cadastro na base/i)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Números da operação' })).not.toBeInTheDocument();
  });

  it('quando a base passa do teto da consulta, a tela avisa', () => {
    montar({ totalNaBase: 5000 });
    expect(screen.getByText(/passou do teto/i)).toBeInTheDocument();
  });

  it('não promete saber de onde a pessoa veio', () => {
    // Não existe campo de origem em lugar nenhum do banco. A asserção é sobre
    // o HTML porque rótulo de campo mora em placeholder e aria-label.
    const { container } = montar();
    expect(container.innerHTML).not.toMatch(/origem|veio de|campanha|utm/i);
  });
});

describe('PainelCrm · quando não dá para carregar', () => {
  const semBase = (estado: { tipo: 'carregando' } | { tipo: 'erro' }) =>
    render(
      <MemoryRouter>
        <PainelCrm
          estado={estado}
          etapas={{ tipo: 'carregando' }}
          movimento={{ tipo: 'carregando' }}
          hoje={HOJE}
        />
      </MemoryRouter>,
    );

  it('carregando diz que está carregando, e não desenha zero', () => {
    const { container } = semBase({ tipo: 'carregando' });
    expect(screen.getByText(/carregando os cadastros/i)).toBeInTheDocument();
    expect(container.textContent).not.toContain('0');
  });

  it('erro diz que falhou em vez de fingir base vazia', () => {
    semBase({ tipo: 'erro' });
    expect(screen.getByText(/não deu para carregar/i)).toBeInTheDocument();
    expect(screen.queryByText(/nenhum cadastro na base/i)).not.toBeInTheDocument();
  });
});

describe('PainelCrm · o que a busca NÃO pode mexer', () => {
  it('os números do topo contam a base inteira, mesmo com a busca ligada', async () => {
    // Na primeira versão as métricas saíam do recorte: procurar "maria" fazia
    // "Cadastros em 30 dias" virar 1 e a conversão ser recalculada sobre uma
    // pessoa só. Eles respondem "como está a operação", e essa resposta não
    // muda porque alguém digitou um nome.
    montar({ cadastros: [...base, cadastro({ id: 'c', futebol_subscription_status: 'premium' })] });
    const topo = screen.getByRole('region', { name: 'Números da operação' });
    expect(within(topo).getByLabelText('Conversão')).toHaveTextContent(/^33%$/);
    await userEvent.type(screen.getByRole('searchbox'), 'maria');
    expect(within(topo).getByLabelText('Conversão')).toHaveTextContent(/^33%$/);
  });

  it('e o funil também', async () => {
    montar({ etapas: { b: 'contatado' } });
    expect(degrau(/Novo/)).toHaveTextContent('1');
    await userEvent.type(screen.getByRole('searchbox'), 'maria');
    expect(degrau(/Contatado/)).toHaveTextContent('1');
  });
});

describe('PainelCrm · quando o movimento não carrega', () => {
  it('não monta a fila com meia informação', () => {
    // Sem os toques, todo mundo aparece como nunca tocado: a fila de primeiro
    // contato incha com gente já abordada e "parado há N dias" passa a contar
    // desde o cadastro. A tela inteira mentiria e nada acusaria.
    montar({ estadoDoMovimento: { tipo: 'erro' } });
    expect(screen.getByText(/não dá para montar a fila sem inventar/i)).toBeInTheDocument();
  });

  it('e diz que o funil não pôde ser montado', () => {
    montar({ estadoDoMovimento: { tipo: 'erro' } });
    expect(screen.getByText(/não deu para montar o funil/i)).toBeInTheDocument();
  });

  it('a contagem de apostas falhando não derruba o resto', () => {
    // Ela é um sinal a menos no gancho, e não motivo para a tela sumir.
    montar({ estadoDoMovimento: { tipo: 'pronto', movimento: { toques: {}, apostas: null } } });
    expect(screen.getByRole('region', { name: 'Funil' })).toBeInTheDocument();
  });
});
