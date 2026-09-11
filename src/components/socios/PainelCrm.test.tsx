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
    montar({
      etapas: { b: 'contatado' },
      cadastros: [...base, cadastro({ id: 'c', futebol_subscription_status: 'premium' })],
    });
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
    await userEvent.click(screen.getByRole('radio', { name: 'Todos' }));
    await userEvent.click(degrau(/Contatado/));
    expect(screen.getByText('João Souza')).toBeInTheDocument();
    expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
  });

  it('clicar de novo no mesmo degrau limpa o filtro', async () => {
    // Sem isso, sair do filtro exige achar um botão em outro canto da tela.
    montar({ etapas: { b: 'contatado' } });
    await userEvent.click(screen.getByRole('radio', { name: 'Todos' }));
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

describe('PainelCrm · a lista', () => {
  it('abre no recorte de quem precisa de atenção, e não na base inteira', () => {
    // A lista é a resposta para "com quem eu falo agora". Abrir na base
    // inteira faria a tela voltar a ser um registro do que aconteceu.
    montar();
    expect(screen.getByRole('radio', { name: 'Precisa de atenção' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('é UMA tabela, e não uma pilha de listas', () => {
    // A primeira versão tinha três abas, e a primeira ainda se dividia em duas
    // tabelas por dentro: cinco listas para uma base só.
    montar({ etapas: { b: 'contatado' }, toques: { b: '2026-08-01T12:00:00Z' } });
    expect(screen.getAllByRole('table')).toHaveLength(1);
  });

  it('conversa esfriando aparece antes de lead nunca abordado', () => {
    montar({ etapas: { b: 'contatado' }, toques: { b: '2026-08-01T12:00:00Z' } });
    const linhas = screen.getAllByRole('row').slice(1);
    expect(linhas[0]).toHaveTextContent('João Souza');
  });

  it('trocar para Todos mostra a base inteira', async () => {
    montar({ etapas: { b: 'interesse' }, toques: { b: '2026-09-11T12:00:00Z' } });
    expect(screen.queryByText('João Souza')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Todos' }));
    expect(screen.getByText('João Souza')).toBeInTheDocument();
  });

  it('agrupar por dia é uma chave à parte, que se combina com o recorte', async () => {
    montar();
    await userEvent.click(screen.getByRole('checkbox', { name: /agrupar por dia/i }));
    expect(screen.getByText(/10\/09\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/08\/09\/2026/)).toBeInTheDocument();
  });

  it('lista vazia de atenção é boa notícia, e a frase diz isso', async () => {
    montar({
      etapas: { a: 'interesse', b: 'interesse' },
      toques: { a: '2026-09-11T12:00:00Z', b: '2026-09-11T12:00:00Z' },
    });
    expect(screen.getByText(/ninguém esperando/i)).toBeInTheDocument();
  });
});

describe('PainelCrm · a base', () => {
  it('a busca filtra a lista', async () => {
    montar();
    await userEvent.type(screen.getByRole('searchbox'), 'maria');
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.queryByText('João Souza')).not.toBeInTheDocument();
  });

  it('o gancho aparece na tabela, porque é o que decide a abordagem', async () => {
    // É a razão de o CRM existir: um assinante do Essencial cujo olho brilhou
    // no Betinho precisa ser abordado por Betinho.
    montar({ apostas: { a: 12 } });
    await userEvent.click(screen.getByRole('radio', { name: 'Todos' }));
    expect(screen.getByText('Betinho')).toBeInTheDocument();
  });

  it('cada nome leva à ficha daquela pessoa', () => {
    montar();
    expect(screen.getByRole('link', { name: 'Maria Silva' })).toHaveAttribute('href', '/socios/a');
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
    expect(screen.getByText(/não dá para montar a lista sem inventar/i)).toBeInTheDocument();
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

describe('PainelCrm · tabela e kanban', () => {
  it('abre na tabela', () => {
    montar();
    expect(screen.getByRole('radio', { name: 'Tabela' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('trocar para kanban desenha as oito colunas', async () => {
    montar();
    await userEvent.click(screen.getByRole('radio', { name: 'Kanban' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Novo' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Boletada' })).toBeInTheDocument();
  });

  it('os dois desenham o MESMO recorte', async () => {
    // Trocar de vista muda a disposição, e nunca o conteúdo. Se o kanban
    // ignorasse a busca, o sócio veria gente que a tabela tinha escondido.
    montar({ etapas: { b: 'contatado' } });
    await userEvent.type(screen.getByRole('searchbox'), 'maria');
    await userEvent.click(screen.getByRole('radio', { name: 'Kanban' }));
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.queryByText('João Souza')).not.toBeInTheDocument();
  });

  it('agrupar por dia some no kanban, onde a coluna já é o agrupamento', async () => {
    montar();
    expect(screen.getByRole('checkbox', { name: /agrupar por dia/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Kanban' }));
    expect(screen.queryByRole('checkbox', { name: /agrupar por dia/i })).not.toBeInTheDocument();
  });

  it('o kanban marca as colunas que o banco responde', async () => {
    // O formato promete arrastar, e para essas duas não dá: quem move é o
    // banco. Dizer isso onde a promessa é mais forte importa mais.
    montar();
    await userEvent.click(screen.getByRole('radio', { name: 'Kanban' }));
    expect(screen.getAllByText(/o banco responde/i).length).toBeGreaterThanOrEqual(2);
  });
});

