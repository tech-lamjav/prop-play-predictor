import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Ficha } from './Ficha';
import type { Pessoa, ResumoDeApostas } from './crm-ficha';
import type { Etapa } from './crm-vocabulario';

const pessoa = (over: Partial<Pessoa> = {}): Pessoa => ({
  id: 'u1',
  name: 'Maria Silva',
  email: 'maria@exemplo.com',
  whatsapp_number: '5511998877665',
  telegram_username: 'maria',
  telegram_synced: true,
  created_at: '2026-09-01T12:00:00Z',
  subscription_product_type: 'essencial',
  betinho_subscription_status: 'premium',
  futebol_subscription_status: 'premium',
  analytics_subscription_status: 'free',
  betinho_subscription_period_end: '2026-10-01T00:00:00Z',
  analytics_subscription_period_end: null,
  futebol_trial_started_at: null,
  futebol_publication_alerts_ack_at: null,
  ...over,
});

const montar = (
  p: Pessoa = pessoa(),
  apostas: ResumoDeApostas | null = { total: 0, ultima: null },
  extras: {
    etapa?: Etapa | null;
    aoMudarEtapa?: (e: Etapa) => void;
    mudandoEtapa?: boolean;
    erroAoMudarEtapa?: boolean;
    linhaDoTempo?: React.ReactNode;
  } = {},
) =>
  render(
    <MemoryRouter>
      <Ficha
        estado={{ tipo: 'pronta', pessoa: p, apostas }}
        etapa={extras.etapa === undefined ? 'novo' : extras.etapa}
        aoMudarEtapa={extras.aoMudarEtapa ?? (() => {})}
        mudandoEtapa={extras.mudandoEtapa ?? false}
        erroAoMudarEtapa={extras.erroAoMudarEtapa ?? false}
        linhaDoTempo={extras.linhaDoTempo ?? null}
      />
    </MemoryRouter>,
  );

describe('Ficha', () => {
  it('abre pelo nome e mostra quando a pessoa se cadastrou', () => {
    montar();
    expect(screen.getByRole('heading', { level: 1, name: 'Maria Silva' })).toBeInTheDocument();
    expect(screen.getByText(/01\/09\/2026/)).toBeInTheDocument();
  });

  it('cadastro sem nome, sem WhatsApp e sem Telegram abre sem quebrar', () => {
    // É o caso mais comum da base antiga, e o que mais chance tem de derrubar
    // uma tela que assume que todo mundo preencheu tudo.
    const magro = pessoa({
      name: null,
      whatsapp_number: null,
      telegram_username: null,
      telegram_synced: false,
    });
    expect(() => montar(magro)).not.toThrow();
    expect(screen.getByRole('heading', { level: 1, name: 'maria@exemplo.com' })).toBeInTheDocument();
    const contatos = screen.getByRole('region', { name: 'Contatos' });
    expect(within(contatos).getAllByText(/não informado/i).length).toBeGreaterThan(0);
  });

  it('o futebol explica a ausência da renovação em vez de mostrar um traço', () => {
    // O banco não tem as colunas de metadados do futebol, e é deliberado. Um
    // traço ali seria lido como "não renova", que é outra coisa.
    montar();
    const acessos = screen.getByRole('region', { name: 'Planos e acessos' });
    expect(within(acessos).getByText(/o banco não guarda a renovação do futebol/i)).toBeInTheDocument();
  });

  it('mostra a renovação dos acessos que têm data, no fuso de Brasília', () => {
    // O Stripe grava 01/10 à meia-noite UTC, que é 30/09 às 21h aqui. A data
    // que o sócio lê é a daqui — ele vai falar com alguém que mora neste fuso.
    montar();
    const acessos = screen.getByRole('region', { name: 'Planos e acessos' });
    expect(within(acessos).getByText(/30\/09\/2026/)).toBeInTheDocument();
  });

  it('plano desconhecido não vira nome inventado: mostra o valor bruto', () => {
    montar(pessoa({ subscription_product_type: 'combo-novo' }));
    expect(screen.getByText(/não identificado/i)).toBeInTheDocument();
    expect(screen.getByText(/combo-novo/)).toBeInTheDocument();
  });

  it('o gancho é apresentado como palpite, com o porquê à vista', () => {
    // Um gancho que parece fato leva o sócio a abrir a conversa com a
    // confiança errada. O porquê é o que deixa ele discordar.
    montar(pessoa(), { total: 12, ultima: '2026-09-09T12:00:00Z' });
    const gancho = screen.getByRole('region', { name: 'Gancho' });
    expect(within(gancho).getByText(/palpite/i)).toBeInTheDocument();
    expect(within(gancho).getByText(/12 apostas/)).toBeInTheDocument();
  });

  it('sem sinal nenhum, o gancho admite que não sabe', () => {
    montar(
      pessoa({
        subscription_product_type: null,
        betinho_subscription_status: 'free',
        futebol_subscription_status: 'free',
        telegram_synced: false,
      }),
    );
    const gancho = screen.getByRole('region', { name: 'Gancho' });
    expect(within(gancho).getByText(/não deu sinal/i)).toBeInTheDocument();
  });

  it('mostra quando foi a última aposta, que é o que sustenta o palpite', () => {
    montar(pessoa(), { total: 12, ultima: '2026-09-09T12:00:00Z' });
    const gancho = screen.getByRole('region', { name: 'Gancho' });
    expect(within(gancho).getByText(/09\/09\/2026/)).toBeInTheDocument();
  });

  it('quando a consulta de apostas falha, o palpite se declara incompleto', () => {
    // Falha e zero caíam no mesmo lugar: o palpite dizia "não deu sinal" com a
    // cara de quem tinha conferido. A aposta é o primeiro sinal da fila.
    montar(pessoa(), null);
    const gancho = screen.getByRole('region', { name: 'Gancho' });
    expect(within(gancho).getByText(/palpite está incompleto/i)).toBeInTheDocument();
  });

  it('com a consulta respondendo, nenhum aviso de palpite manco aparece', () => {
    montar();
    expect(screen.queryByText(/palpite está incompleto/i)).not.toBeInTheDocument();
  });

  it('o lugar do comportamento está reservado, e diz que ainda não tem nada', () => {
    montar();
    const comportamento = screen.getByRole('region', { name: 'Comportamento' });
    expect(within(comportamento).getByText(/ainda não/i)).toBeInTheDocument();
  });

  it('não promete saber de onde a pessoa veio', () => {
    // Não existe campo de origem em lugar nenhum do banco. O bloco reservado
    // pode DIZER que não sabe; o que ele não pode é rotular um campo vazio.
    montar();
    const comportamento = screen.getByRole('region', { name: 'Comportamento' });
    expect(comportamento.textContent).toMatch(/ainda não aparecem aqui/i);
  });

  it('quando a pessoa não existe, diz isso em vez de uma ficha em branco', () => {
    render(
      <MemoryRouter>
        <Ficha
          estado={{ tipo: 'nao-encontrada' }}
          etapa="novo"
          aoMudarEtapa={() => {}}
          mudandoEtapa={false}
          erroAoMudarEtapa={false}
          linhaDoTempo={null}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/não encontramos esse cadastro/i)).toBeInTheDocument();
  });

  it('tem sempre a volta para a lista', () => {
    montar();
    expect(screen.getByRole('link', { name: /voltar/i })).toHaveAttribute('href', '/socios');
  });
});

describe('Ficha · etapa', () => {
  const montarComEtapa = (extras: Parameters<typeof montar>[2]) =>
    montar(pessoa(), { total: 0, ultima: null }, extras);

  it('mostra em que etapa o lead está', () => {
    montarComEtapa({ etapa: 'proposta' });
    expect(screen.getByRole('combobox', { name: /etapa/i })).toHaveValue('proposta');
  });

  it('lead nunca tocado aparece como novo', () => {
    // Sem linha na tabela, e é assim de propósito: um lead novo não deveria
    // exigir uma escrita no banco para existir.
    montarComEtapa({});
    expect(screen.getByRole('combobox', { name: /etapa/i })).toHaveValue('novo');
  });

  it('escolher outra etapa avisa quem cuida de gravar', async () => {
    const aoMudarEtapa = vi.fn();
    montarComEtapa({ etapa: 'novo', aoMudarEtapa });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /etapa/i }), 'contatado');
    expect(aoMudarEtapa).toHaveBeenCalledWith('contatado');
  });

  it('enquanto grava, o seletor não aceita outra escolha', () => {
    // Duas mudanças em voo gravariam dois eventos na linha do tempo, e o segundo
    // registraria um "de" que já não era verdade.
    montarComEtapa({ mudandoEtapa: true });
    expect(screen.getByRole('combobox', { name: /etapa/i })).toBeDisabled();
  });

  it('as seis etapas estão à escolha', () => {
    montarComEtapa({});
    const seletor = screen.getByRole('combobox', { name: /etapa/i });
    expect(within(seletor).getAllByRole('option')).toHaveLength(6);
  });
});

describe('Ficha · quando a etapa não grava', () => {
  it('avisa, em vez de deixar o seletor voltar em silêncio', () => {
    // O seletor é controlado pelo valor do servidor: numa falha ele volta
    // sozinho para a etapa antiga. Sem aviso isso parece um clique que não
    // pegou, e o rodapé ainda promete que a mudança ficou registrada.
    montar(pessoa(), { total: 0, ultima: null }, { erroAoMudarEtapa: true });
    expect(screen.getByText(/não deu para gravar a etapa/i)).toBeInTheDocument();
    expect(screen.queryByText(/fica registrada/i)).not.toBeInTheDocument();
  });

  it('enquanto as etapas não chegaram, não afirma que o lead é novo', () => {
    montar(pessoa(), { total: 0, ultima: null }, { etapa: null });
    const seletor = screen.getByRole('combobox', { name: /etapa/i });
    expect(seletor).toBeDisabled();
    expect(seletor).toHaveValue('');
  });
});

describe('Ficha · a linha do tempo entra na página', () => {
  it('o bloco recebido é desenhado dentro da ficha', () => {
    // A linha do tempo tem consulta e escrita próprias, então ela entra por
    // fora. Sem este teste, apagar a variável do corpo da ficha fazia a seção
    // inteira sumir da tela com a suíte verde.
    montar(pessoa(), { total: 0, ultima: null }, { linhaDoTempo: <p>a linha do tempo</p> });
    expect(screen.getByText('a linha do tempo')).toBeInTheDocument();
  });

  it('e não aparece quando a pessoa não foi encontrada', () => {
    render(
      <MemoryRouter>
        <Ficha
          estado={{ tipo: 'nao-encontrada' }}
          etapa="novo"
          aoMudarEtapa={() => {}}
          mudandoEtapa={false}
          erroAoMudarEtapa={false}
          linhaDoTempo={<p>a linha do tempo</p>}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText('a linha do tempo')).not.toBeInTheDocument();
  });
});

describe('Ficha · a mensagem pronta', () => {
  it('nasce com o texto do gancho e da etapa daquela pessoa', () => {
    montar(pessoa({ name: 'Maria Silva' }), { total: 12, ultima: null }, { etapa: 'novo' });
    const bloco = screen.getByRole('region', { name: 'Mensagem pronta' });
    // Gancho de Betinho, porque ela registrou apostas — e é esse o assunto que
    // a mensagem tem de puxar.
    // toHaveValue compara o valor inteiro; para trecho, é o texto na mão.
    const texto = (within(bloco).getByRole('textbox') as HTMLTextAreaElement).value;
    expect(texto).toContain('Betinho');
    expect(texto).toContain('Maria');
  });

  it('cadastro sem nome não vira "Oi, !"', () => {
    montar(pessoa({ name: null }), { total: 0, ultima: null }, { etapa: 'novo' });
    const bloco = screen.getByRole('region', { name: 'Mensagem pronta' });
    expect((within(bloco).getByRole('textbox') as HTMLTextAreaElement).value).not.toMatch(
      /,\s*[!?.]/,
    );
  });

  it('sem WhatsApp no cadastro, não oferece o link', () => {
    montar(pessoa({ whatsapp_number: null }), { total: 0, ultima: null }, { etapa: 'novo' });
    expect(screen.queryByRole('link', { name: /whatsapp/i })).not.toBeInTheDocument();
  });

  it('enquanto a etapa não chegou, a mensagem espera', () => {
    // O campo é semeado uma vez só. Nascer com a etapa errada deixaria o texto
    // desatualizado sem o sócio perceber.
    montar(pessoa(), { total: 0, ultima: null }, { etapa: null });
    expect(screen.queryByRole('region', { name: 'Mensagem pronta' })).not.toBeInTheDocument();
  });
});
