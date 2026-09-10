import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Ficha } from './Ficha';
import type { Pessoa, ResumoDeApostas } from './crm-ficha';

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

const montar = (p: Pessoa = pessoa(), apostas: ResumoDeApostas | null = { total: 0, ultima: null }) =>
  render(
    <MemoryRouter>
      <Ficha estado={{ tipo: 'pronta', pessoa: p, apostas }} />
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
        <Ficha estado={{ tipo: 'nao-encontrada' }} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/não encontramos esse cadastro/i)).toBeInTheDocument();
  });

  it('tem sempre a volta para a lista', () => {
    montar();
    expect(screen.getByRole('link', { name: /voltar/i })).toHaveAttribute('href', '/socios');
  });
});
