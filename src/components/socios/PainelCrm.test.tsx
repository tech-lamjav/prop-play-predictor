import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PainelCrm } from './PainelCrm';
import { cadastroDeTeste as cadastro } from './crm-cadastro-de-teste';
import type { Cadastro } from './crm-lista';

const HOJE = '2026-09-10';

const base = [
  cadastro({ id: 'a', name: 'Maria Silva', email: 'maria@exemplo.com' }),
  cadastro({
    id: 'b',
    name: 'João Souza',
    email: 'joao@exemplo.com',
    created_at: '2026-09-08T12:00:00Z',
    futebol_subscription_status: 'premium',
  }),
];

const pronto = (cadastros: Cadastro[] = base, totalNaBase = cadastros.length) =>
  render(<PainelCrm estado={{ tipo: 'pronto', cadastros, totalNaBase }} hoje={HOJE} />);

/**
 * O valor exato de um contador.
 *
 * `toHaveTextContent('1')` casa por SUBSTRING, então ele fica verde com 1, 10 e
 * 21. Uma mutação que multiplicava os contadores por dez passou por aqui sem
 * acender nada — daí a âncora.
 */
const contador = (rotulo: string) =>
  within(screen.getByRole('region', { name: 'Resumo da base' })).getByLabelText(rotulo);

describe('PainelCrm', () => {
  it('agrupa os cadastros por dia, do mais recente para o mais antigo', () => {
    pronto();
    const dias = screen.getAllByRole('heading', { level: 2 });
    expect(dias[0]).toHaveTextContent(/10\/09/);
    expect(dias[1]).toHaveTextContent(/08\/09/);
  });

  it('mostra os contadores do topo', () => {
    pronto();
    expect(contador('Cadastros hoje')).toHaveTextContent(/^1$/);
    expect(contador('Cadastros na semana')).toHaveTextContent(/^2$/);
    expect(contador('Assinantes')).toHaveTextContent(/^1$/);
  });

  it('marca quem assina e não marca quem não assina', () => {
    pronto();
    const lista = screen.getByRole('region', { name: 'Cadastros por dia' });
    expect(within(lista).getAllByText(/assinante/i)).toHaveLength(1);
  });

  it('a busca filtra a lista e os contadores juntos', async () => {
    // Os dois vivem na mesma tela. Filtrar um e não o outro deixaria dois
    // números discordando sem explicação nenhuma.
    pronto();
    await userEvent.type(screen.getByRole('searchbox'), 'maria');
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.queryByText('João Souza')).not.toBeInTheDocument();
    expect(contador('Assinantes')).toHaveTextContent(/^0$/);
    expect(contador('Cadastros hoje')).toHaveTextContent(/^1$/);
  });

  it('busca sem resultado diz isso em vez de mostrar uma lista vazia', async () => {
    pronto();
    await userEvent.type(screen.getByRole('searchbox'), 'ninguem');
    expect(screen.getByText(/nenhum cadastro encontrado/i)).toBeInTheDocument();
  });

  it('cadastro sem nome aparece pelo e-mail, e não como linha em branco', () => {
    pronto([cadastro({ id: 'c', name: null, email: 'anonimo@exemplo.com' })]);
    expect(screen.getByText('anonimo@exemplo.com')).toBeInTheDocument();
  });

  it('base vazia é dita com palavra, sem contadores zerados em cima', () => {
    // Três zeros grandes acima de "nenhum cadastro" são o mesmo zero solto que
    // a tela evita em todo lugar: parecem um dado, e não a ausência dele.
    pronto([]);
    expect(screen.getByText(/nenhum cadastro na base/i)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Resumo da base' })).not.toBeInTheDocument();
  });

  it('quando a base passa do teto da consulta, a tela avisa', () => {
    // Sem o aviso, os contadores contariam só a fatia trazida e ninguém teria
    // como desconfiar: a lista continua parecendo completa.
    pronto(base, 5000);
    expect(screen.getByText(/passou do teto/i)).toBeInTheDocument();
    expect(screen.getByText(/de 5000/)).toBeInTheDocument();
  });

  it('sem truncamento, nenhum aviso aparece', () => {
    pronto();
    expect(screen.queryByText(/passou do teto/i)).not.toBeInTheDocument();
  });

  it('enquanto carrega, diz que está carregando e não desenha zero', () => {
    // Zero é resposta possível e assustadora: uma tela que pisca "0 cadastros"
    // antes de carregar parece base vazia. E um galho que não desenha NADA
    // passaria por um teste que só nega o zero — daí as duas asserções.
    const { container } = render(<PainelCrm estado={{ tipo: 'carregando' }} hoje={HOJE} />);
    expect(screen.getByText(/carregando os cadastros/i)).toBeInTheDocument();
    expect(container.textContent).not.toContain('0');
  });

  it('quando a consulta falha, diz que falhou em vez de fingir base vazia', () => {
    render(<PainelCrm estado={{ tipo: 'erro' }} hoje={HOJE} />);
    expect(screen.getByText(/não deu para carregar/i)).toBeInTheDocument();
    expect(screen.queryByText(/nenhum cadastro na base/i)).not.toBeInTheDocument();
  });

  it('não promete saber de onde a pessoa veio', () => {
    // Não existe campo de origem, campanha ou UTM em lugar nenhum do banco —
    // isso só existe no PostHog. Uma coluna com esse rótulo estaria vazia para
    // sempre, e uma coluna vazia é lida como "essa pessoa não veio de lugar
    // nenhum", que é diferente de "a gente não sabe".
    //
    // A asserção é sobre o HTML, e não sobre o texto visível: rótulo de campo
    // mora em `placeholder` e `aria-label`, e um teste que só lê o texto passa
    // por cima justamente de onde essa palavra apareceria.
    const { container } = pronto();
    expect(container.innerHTML).not.toMatch(/origem|veio de|campanha|utm|fonte/i);
  });
});
