import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PainelCrm } from './PainelCrm';
import { cadastroDeTeste as cadastro } from './crm-cadastro-de-teste';
import type { Cadastro } from './crm-lista';
import type { Apostas, Toques } from './crm-painel';
import type { EstadoDoMovimento } from '@/hooks/use-painel-do-crm';
import type { EstadoDasMarcas } from '@/hooks/use-sem-whatsapp';
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
  marcados = [],
  estadoDasMarcas,
}: {
  cadastros?: Cadastro[];
  etapas?: Record<string, string>;
  toques?: Toques;
  apostas?: Apostas;
  totalNaBase?: number;
  estadoDasEtapas?: EstadoDasEtapas;
  estadoDoMovimento?: EstadoDoMovimento;
  /** Quem o sócio marcou na mão como impossível de abordar. */
  marcados?: string[];
  estadoDasMarcas?: EstadoDasMarcas;
} = {}) {
  return render(
    <MemoryRouter>
      <PainelCrm
        estado={{ tipo: 'pronto', cadastros, totalNaBase: totalNaBase ?? cadastros.length }}
        etapas={estadoDasEtapas ?? { tipo: 'pronto', etapas }}
        movimento={estadoDoMovimento ?? { tipo: 'pronto', movimento: { toques, apostas } }}
        marcas={estadoDasMarcas ?? { tipo: 'pronto', marcados: new Set(marcados) }}
        hoje={HOJE}
      />
    </MemoryRouter>,
  );
}

const funil = () => screen.getByRole('region', { name: 'Funil' });
const posicaoNoFunil = (nome: RegExp) => within(funil()).getByRole('button', { name: nome });

describe('PainelCrm · os números do topo', () => {
  it('mostra cadastros do mês, conversão e abordados', () => {
    montar({
      etapas: { b: 'primeiro_contato' },
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
  it('desenha as sete posições, inclusive as vazias', () => {
    // Degrau com zero precisa aparecer: a faixa mostra a FORMA do funil, e um
    // posição que some esconde justamente onde está o gargalo.
    montar();
    expect(within(funil()).getAllByRole('button')).toHaveLength(7);
  });

  it('marca a posição que o banco responde', () => {
    // Só "assinante". "Em teste" saiu do funil e virou etiqueta.
    montar();
    expect(within(funil()).getAllByText(/o banco responde/i)).toHaveLength(1);
  });

  it('quem assina aparece como assinante, e não na etapa manual', () => {
    // O estado calculado vence a etapa: mostrar a pessoa nos dois lugares faria
    // o funil somar duas vezes o mesmo lead.
    montar({
      cadastros: [cadastro({ id: 'a', futebol_subscription_status: 'premium' })],
      etapas: { a: 'interesse' },
    });
    expect(posicaoNoFunil(/Assinante/)).toHaveTextContent('1');
    expect(posicaoNoFunil(/Interesse/)).toHaveTextContent('0');
  });

  it('clicar numa posição filtra a lista', async () => {
    montar({ etapas: { b: 'primeiro_contato' } });
    await userEvent.click(screen.getByRole('radio', { name: /^Todos/ }));
    await userEvent.click(posicaoNoFunil(/Primeiro contato/));
    expect(screen.getByText('João Souza')).toBeInTheDocument();
    expect(screen.queryByText('Maria Silva')).not.toBeInTheDocument();
  });

  it('clicar de novo na mesma posição limpa o filtro', async () => {
    // Sem isso, sair do filtro exige achar um botão em outro canto da tela.
    montar({ etapas: { b: 'primeiro_contato' } });
    await userEvent.click(screen.getByRole('radio', { name: /^Todos/ }));
    await userEvent.click(posicaoNoFunil(/Primeiro contato/));
    await userEvent.click(posicaoNoFunil(/Primeiro contato/));
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
    expect(screen.getByRole('radio', { name: /^Precisa de atenção/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('é UMA tabela, e não uma pilha de listas', () => {
    // A primeira versão tinha três recortes, e o primeiro ainda se dividia em duas
    // tabelas por dentro: cinco listas para uma base só.
    montar({ etapas: { b: 'primeiro_contato' }, toques: { b: '2026-08-01T12:00:00Z' } });
    expect(screen.getAllByRole('table')).toHaveLength(1);
  });

  it('conversa esfriando aparece antes de lead nunca abordado', () => {
    montar({ etapas: { b: 'primeiro_contato' }, toques: { b: '2026-08-01T12:00:00Z' } });
    const linhas = screen.getAllByRole('row').slice(1);
    expect(linhas[0]).toHaveTextContent('João Souza');
  });

  it('trocar para Todos mostra a base inteira', async () => {
    montar({ etapas: { b: 'interesse' }, toques: { b: '2026-09-11T12:00:00Z' } });
    expect(screen.queryByText('João Souza')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /^Todos/ }));
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
    await userEvent.click(screen.getByRole('radio', { name: /^Todos/ }));
    expect(screen.getByText('Betinho')).toBeInTheDocument();
  });

  it('cada nome leva à ficha daquela pessoa', () => {
    montar();
    expect(screen.getByRole('link', { name: 'Maria Silva' })).toHaveAttribute('href', '/socios/crm/a');
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
          marcas={{ tipo: 'carregando' }}
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
    montar({ etapas: { b: 'primeiro_contato' } });
    expect(posicaoNoFunil(/Novo/)).toHaveTextContent('1');
    await userEvent.type(screen.getByRole('searchbox'), 'maria');
    expect(posicaoNoFunil(/Primeiro contato/)).toHaveTextContent('1');
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

  it('trocar para kanban desenha as sete posições', async () => {
    montar();
    await userEvent.click(screen.getByRole('radio', { name: 'Kanban' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Novo' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Boletada' })).toBeInTheDocument();
  });

  it('os dois desenham o MESMO recorte', async () => {
    // Trocar de vista muda a disposição, e nunca o conteúdo. Se o kanban
    // ignorasse a busca, o sócio veria gente que a tabela tinha escondido.
    montar({ etapas: { b: 'primeiro_contato' } });
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

describe('PainelCrm · o filtro de data', () => {
  const comIdades = [
    cadastro({ id: 'novo', name: 'Recente', created_at: '2026-09-10T12:00:00Z' }),
    cadastro({ id: 'velho', name: 'Antigo', created_at: '2026-06-01T12:00:00Z' }),
  ];

  it('nasce desligado, mostrando a base inteira', () => {
    montar({ cadastros: comIdades });
    expect(screen.getByRole('link', { name: 'Recente' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Antigo' })).toBeInTheDocument();
  });

  it('os últimos sete dias deixam só quem chegou agora', async () => {
    montar({ cadastros: comIdades });
    await userEvent.selectOptions(screen.getByLabelText('Período de cadastro'), '7');
    expect(screen.getByRole('link', { name: 'Recente' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Antigo' })).not.toBeInTheDocument();
  });

  it('os números do topo continuam contando a base inteira', async () => {
    // A mesma regra da busca, e ela existe porque os números respondem "como
    // está a operação" — resposta que não muda porque alguém foi olhar quem
    // chegou esta semana. A conversão sobre o recorte seria outra coisa.
    montar({ cadastros: comIdades });
    const numeros = within(screen.getByRole('region', { name: 'Números da operação' }));
    const antes = numeros.getByLabelText('Conversão').textContent;
    await userEvent.selectOptions(screen.getByLabelText('Período de cadastro'), '7');
    expect(numeros.getByLabelText('Conversão').textContent).toBe(antes);
  });

  it('os campos de data só aparecem no personalizado', async () => {
    montar({ cadastros: comIdades });
    expect(screen.queryByLabelText('Cadastrado a partir de')).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Período de cadastro'), 'personalizado');
    expect(screen.getByLabelText('Cadastrado a partir de')).toBeInTheDocument();
  });

  it('o personalizado abre sem recorte, e não herdando o atalho anterior', async () => {
    // Herdar faria o calendário abrir já filtrando por um período que o sócio
    // não escolheu, e sumindo com gente sem ele ter pedido nada.
    montar({ cadastros: comIdades });
    await userEvent.selectOptions(screen.getByLabelText('Período de cadastro'), '7');
    await userEvent.selectOptions(screen.getByLabelText('Período de cadastro'), 'personalizado');
    expect(screen.getByRole('link', { name: 'Antigo' })).toBeInTheDocument();
    expect(screen.getByLabelText('Cadastrado a partir de')).toHaveValue('');
  });

  it('vale para o kanban também, e não só para a tabela', async () => {
    // Os dois desenham o MESMO recorte. Um filtro que valesse só para um faria
    // trocar de vista mudar o conteúdo, e não só a disposição.
    montar({ cadastros: comIdades });
    await userEvent.selectOptions(screen.getByLabelText('Período de cadastro'), '7');
    await userEvent.click(screen.getByRole('radio', { name: 'Kanban' }));
    expect(screen.getByText('Recente')).toBeInTheDocument();
    expect(screen.queryByText('Antigo')).not.toBeInTheDocument();
  });
});

describe('PainelCrm · o recorte diz quanta gente ele esconde', () => {
  // Um assinante e um lead novo. O recorte padrão mostra só o segundo, e sem
  // número no botão do recorte o primeiro simplesmente não existe para quem olha.
  const base2 = [
    cadastro({ id: 'novo', name: 'Lead Novo' }),
    cadastro({ id: 'ass', name: 'Já Assina', betinho_subscription_status: 'premium' }),
  ];

  it('cada recorte mostra quantos tem', () => {
    // O pedido veio de uma confusão real: o sócio abordou gente, ela saiu da
    // fila justamente por ter sido abordada, e ele leu isso como "sumiram
    // usuários". Com o número ao lado, a fila encolher é visivelmente o
    // trabalho andando, e não gente desaparecendo.
    montar({ cadastros: base2 });
    expect(screen.getByRole('radio', { name: /^Precisa de atenção 1$/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Todos 2$/ })).toBeInTheDocument();
  });

  it('o número segue os outros filtros, e não a base crua', async () => {
    // Ele responde "quantos eu veria se clicasse aqui". Contar a base inteira
    // com a busca ligada prometeria gente que o clique não traria.
    montar({ cadastros: base2 });
    await userEvent.type(screen.getByLabelText('Buscar cadastro'), 'Já Assina');
    expect(screen.getByRole('radio', { name: /^Todos 1$/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Precisa de atenção 0$/ })).toBeInTheDocument();
  });

  it('zero na fila é dito, e não escondido', () => {
    // "Precisa de atenção 0" é uma boa notícia legível. Sem o número, a lista
    // vazia parece defeito.
    montar({ cadastros: [cadastro({ id: 'ass', betinho_subscription_status: 'premium' })] });
    expect(screen.getByRole('radio', { name: /^Precisa de atenção 0$/ })).toBeInTheDocument();
  });
});

describe('PainelCrm · o recorte de quem não tem WhatsApp', () => {
  // "leads sem whatsapp, esses eu nao consigo fazer nada". Eles ficavam
  // misturados na fila de atenção, onde o sócio só descobria o problema depois
  // de abrir a ficha e não achar botão nenhum.

  const comESem = [
    cadastro({ id: 'com', name: 'Tem Numero', whatsapp_number: '5511998877665' }),
    cadastro({ id: 'sem', name: 'Sem Numero', whatsapp_number: null }),
    // Cinco dígitos não viram telefone. O celular brasileiro sem o 55 NÃO entra
    // mais aqui: a gente completa o código do país e ele volta a ser abordável.
    cadastro({ id: 'lixo', name: 'Campo Estragado', whatsapp_number: '11999' }),
  ];

  it('mostra só quem não dá para abordar', async () => {
    montar({ cadastros: comESem });
    await userEvent.click(screen.getByRole('radio', { name: /^Sem WhatsApp/ }));
    expect(screen.getByText('Sem Numero')).toBeInTheDocument();
    expect(screen.getByText('Campo Estragado')).toBeInTheDocument();
    expect(screen.queryByText('Tem Numero')).not.toBeInTheDocument();
  });

  it('conta quantos são, como os outros recortes', () => {
    // Sem o número, o sócio teria que clicar para descobrir se vale a pena.
    montar({ cadastros: comESem });
    expect(screen.getByRole('radio', { name: /^Sem WhatsApp 2$/ })).toBeInTheDocument();
  });

  it('base inteira com número diz isso, em vez de parecer defeito', async () => {
    montar({ cadastros: [comESem[0]] });
    await userEvent.click(screen.getByRole('radio', { name: /^Sem WhatsApp 0$/ }));
    expect(screen.getByText(/número que abre conversa/)).toBeInTheDocument();
  });
});

describe('PainelCrm · esconder quem não dá para abordar', () => {
  // "Esses eu não consigo fazer nada." O interruptor nasce LIGADO na fila, que
  // é onde o sócio age, e desligado em "Todos", que é onde ele confere a base.

  const filaMista = [
    cadastro({ id: 'falavel', name: 'Da Para Falar' }),
    cadastro({ id: 'mudo', name: 'Sem Numero', whatsapp_number: null }),
  ];

  const interruptor = () => screen.getByRole('checkbox', { name: /esconder quem não tem whatsapp/i });

  it('a fila já abre sem eles', () => {
    montar({ cadastros: filaMista });
    expect(screen.getByText('Da Para Falar')).toBeInTheDocument();
    expect(screen.queryByText('Sem Numero')).not.toBeInTheDocument();
    expect(interruptor()).toBeChecked();
  });

  it('em Todos eles continuam visíveis', async () => {
    // Conferir a base é outro trabalho: lá esconder gente seria esconder o
    // problema em vez de mostrá-lo.
    montar({ cadastros: filaMista });
    await userEvent.click(screen.getByRole('radio', { name: /^Todos/ }));
    expect(screen.getByText('Sem Numero')).toBeInTheDocument();
    expect(interruptor()).not.toBeChecked();
  });

  it('desligar traz eles de volta para a fila', async () => {
    montar({ cadastros: filaMista });
    await userEvent.click(interruptor());
    expect(screen.getByText('Sem Numero')).toBeInTheDocument();
  });

  it('a escolha num recorte não mexe no outro', async () => {
    // ⚠️ Ele escolheu um PADRÃO POR RECORTE: ligado onde se age, desligado onde
    // se confere a base. A primeira versão fazia a escolha valer nos dois assim
    // que ele mexesse em um — decisão minha, não dele —, e aí desligar uma vez
    // para conferir a base voltava a encher a fila de trabalho.
    montar({ cadastros: filaMista });

    await userEvent.click(interruptor()); // desliga na fila
    expect(screen.getByText('Sem Numero')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /^Todos/ }));
    expect(interruptor()).not.toBeChecked(); // "Todos" já nascia desligado
    await userEvent.click(interruptor()); // liga só aqui
    expect(screen.queryByText('Sem Numero')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /^Precisa de atenção/ }));
    expect(interruptor()).not.toBeChecked(); // a fila ficou como ele deixou
    expect(screen.getByText('Sem Numero')).toBeInTheDocument();

    // ⚠️ E os CONTADORES seguem cada um o seu recorte, não o recorte aberto.
    // Sem esta parte o teste não tinha dentes: olhando só a lista e o
    // interruptor, "o esconder do recorte aberto" e "o esconder de cada
    // recorte" dão exatamente o mesmo resultado, porque os dois coincidem
    // justamente onde se está. A diferença só aparece no número do OUTRO
    // botão — e é ele que promete o que o clique entrega.
    expect(screen.getByRole('radio', { name: /^Precisa de atenção 2$/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Todos 1$/ })).toBeInTheDocument();
  });

  it('o funil conta só quem está visível', () => {
    // ⚠️ Achado da revisão. Os dois leads são "novo", e com o esconder ligado o
    // funil dizia "Novo 2" enquanto o clique trazia 1 — sem nada explicando o
    // sumiço. Número ao lado de um botão promete o que o clique entrega.
    //
    // Ele continua ignorando a BUSCA, que é outra coisa: procurar um nome não
    // muda como está a operação.
    montar({ cadastros: filaMista });
    expect(posicaoNoFunil(/Novo/)).toHaveTextContent('1');
  });

  it('e o funil volta a contar todo mundo quando o esconder desliga', async () => {
    montar({ cadastros: filaMista });
    await userEvent.click(interruptor());
    expect(posicaoNoFunil(/Novo/)).toHaveTextContent('2');
  });

  it('o número de cada recorte segue o esconder daquele recorte', () => {
    // O número promete "quantos eu veria se clicasse aqui". Com uma conta só
    // para os dois, o contador de "Todos" mostraria a conta da fila.
    montar({ cadastros: filaMista });
    expect(screen.getByRole('radio', { name: /^Precisa de atenção 1$/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Todos 2$/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Sem WhatsApp 1$/ })).toBeInTheDocument();
  });

  it('a marca na mão esconde quem tem número bom', async () => {
    // O caso que o cadastro não enxerga: o número existe, está bem formado, e
    // não leva à pessoa.
    montar({ cadastros: filaMista, marcados: ['falavel'] });
    expect(screen.queryByText('Da Para Falar')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /^Sem WhatsApp/ }));
    expect(screen.getByText('Da Para Falar')).toBeInTheDocument();
  });

  it('dentro de Sem WhatsApp o interruptor some, porque a pilha É a lista', async () => {
    montar({ cadastros: filaMista });
    await userEvent.click(screen.getByRole('radio', { name: /^Sem WhatsApp/ }));
    expect(
      screen.queryByRole('checkbox', { name: /esconder quem não tem whatsapp/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Sem Numero')).toBeInTheDocument();
  });

  it('com o esconder ligado na mão, a pilha continua mostrando todo mundo', async () => {
    // ⚠️ O caso que trocar de recorte sozinho NÃO cobre. Enquanto o sócio não
    // mexe no interruptor, o padrão de cada recorte já resolve; o buraco é ele
    // LIGAR o esconder na fila e depois ir olhar a pilha. Sem o guarda que
    // isenta este recorte, o esconder se aplicaria à lista que o botão existe
    // para mostrar, e ela viria vazia sem nada explicando.
    montar({ cadastros: filaMista });
    await userEvent.click(interruptor()); // desliga
    await userEvent.click(interruptor()); // liga de novo, agora por escolha explícita
    await userEvent.click(screen.getByRole('radio', { name: /^Sem WhatsApp/ }));
    expect(screen.getByText('Sem Numero')).toBeInTheDocument();
  });

  it('marcas que não carregam não derrubam a tela, e a tela diz o que sabe', () => {
    // ⚠️ Esta consulta NÃO segura o painel: sem ela o pior que acontece é
    // aparecer alguém que devia estar escondido, e mostrar demais é o lado
    // seguro do erro. Mas calar sobre isso faria a lista parecer completa.
    montar({ cadastros: filaMista, estadoDasMarcas: { tipo: 'erro' } });
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(/só pelo número/i)).toBeInTheDocument();
    // O esconder pelo número continua valendo.
    expect(screen.queryByText('Sem Numero')).not.toBeInTheDocument();
  });
});

describe('PainelCrm · o teste gratuito é eixo separado do funil', () => {
  // `HOJE` é 2026-09-11 e o teste termina no dia 12: sobram hoje e amanhã, que
  // é o corte de "vencendo".
  const emTeste = cadastro({
    id: 'teste',
    name: 'Está Testando',
    futebol_trial_started_at: '2026-09-06T15:00:00Z',
    futebol_trial_ends_at: '2026-09-12T15:00:00Z',
  });
  const semTeste = cadastro({ id: 'seco', name: 'Nunca Testou' });

  it('quem está em teste mostra a etapa da conversa no funil', () => {
    // O ponto de toda a mudança. Antes "Em teste" era posição e vencia a
    // etapa, então a conversa dessas pessoas ficava invisível — e são as mais
    // quentes que existem.
    montar({ cadastros: [emTeste], etapas: { teste: 'nutrindo' } });
    expect(posicaoNoFunil(/Nutrindo/)).toHaveTextContent('1');
  });

  it('o funil não tem mais posição de teste', () => {
    montar({ cadastros: [emTeste] });
    expect(within(funil()).queryByText(/Em teste/)).not.toBeInTheDocument();
  });

  it('a faixa do teste conta quem está nele', () => {
    montar({ cadastros: [emTeste, semTeste] });
    const faixa = screen.getByRole('region', { name: 'Teste gratuito' });
    expect(within(faixa).getByRole('button', { name: /Teste vencendo/ })).toHaveTextContent('1');
  });

  it('a faixa some quando ninguém está em teste', () => {
    // Três zeros lado a lado seriam três perguntas sem assunto.
    montar({ cadastros: [semTeste] });
    expect(screen.queryByRole('region', { name: 'Teste gratuito' })).not.toBeInTheDocument();
  });

  it('o filtro da etiqueta SOMA com o do funil, em vez de trocar', async () => {
    // "Quem está em teste e ainda está em nutrindo" é a pergunta que não dava
    // para fazer quando os dois eixos eram um só.
    const outroEmTeste = cadastro({
      id: 'outro',
      name: 'Outro Testando',
      futebol_trial_started_at: '2026-09-06T15:00:00Z',
      futebol_trial_ends_at: '2026-09-12T15:00:00Z',
    });
    montar({
      cadastros: [emTeste, outroEmTeste],
      etapas: { teste: 'nutrindo', outro: 'interesse' },
    });

    // "Todos" porque a fila de atenção esconde quem já tem etapa e foi tocado,
    // e aqui o assunto é o cruzamento dos filtros, não a fila.
    await userEvent.click(screen.getByRole('radio', { name: /^Todos/ }));
    const faixa = screen.getByRole('region', { name: 'Teste gratuito' });
    await userEvent.click(within(faixa).getByRole('button', { name: /Teste vencendo/ }));
    await userEvent.click(posicaoNoFunil(/Nutrindo/));

    expect(screen.getByRole('link', { name: 'Está Testando' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Outro Testando' })).not.toBeInTheDocument();
  });
});
