import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PerfilDeAposta } from './PerfilDeAposta';
import { montarPerfil, type PerfilDoBanco } from './crm-perfil';
import type { EstadoDoPerfil } from '@/hooks/use-perfil-de-aposta';

const linha = (over: Partial<PerfilDoBanco> = {}): PerfilDoBanco => ({
  total: 10,
  liquidadas: 8,
  primeira: '2026-01-10T12:00:00Z',
  ultima: '2026-09-01T12:00:00Z',
  apostado: '800.00',
  lucro: '-64.00',
  por_esporte: [{ nome: 'Futebol', n: 9, apostado: '700', lucro: '-60' }],
  por_mercado: [{ nome: 'Over/Under', n: 7, apostado: '500', lucro: '-40' }],
  por_faixa_de_odd: [{ nome: '1.50 a 1.99', n: 6, apostado: '400', lucro: '-30', ordem: 2 }],
  ...over,
});

const pronto = (over: Partial<PerfilDoBanco> = {}): EstadoDoPerfil => ({
  tipo: 'pronto',
  perfil: montarPerfil(linha(over)),
});

const montar = (estado: EstadoDoPerfil = pronto()) => render(<PerfilDeAposta estado={estado} />);

describe('os números de cima', () => {
  it('mostra quantas apostas, quantas liquidaram e quanto foi apostado', () => {
    montar();
    const bloco = screen.getByRole('region', { name: 'Perfil de aposta' });
    expect(bloco).toHaveTextContent('10');
    expect(bloco).toHaveTextContent('2 em aberto');
    expect(bloco).toHaveTextContent('800,00');
  });

  it('o ROI é DELE, e a tela chama assim', () => {
    // ⚠️ Não é o nosso resultado. Nas palavras do Victor: "o ROI é de cada
    // usuário nosso, não temos culpa da performance dele". Chamar de "ROI"
    // solto na ficha faria parecer que é conta da casa.
    montar();
    expect(screen.getByText('ROI dele')).toBeInTheDocument();
    expect(screen.getByText('-8,0%')).toBeInTheDocument();
  });

  it('sem nada liquidado, traço em vez de 0%', () => {
    // Zero por cento é uma afirmação, e quem só tem aposta em aberto não
    // afirmou nada. É o caso comum: a maior parte das apostas fica em aberto.
    montar(pronto({ total: 3, liquidadas: 0, apostado: '0', lucro: '0' }));
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText(/nada liquidado ainda/)).toBeInTheDocument();
  });

  it('quem está perdendo vira conversa, e não julgamento', () => {
    // O prejuízo é a abertura para oferecer o produto que ajuda. A frase existe
    // porque um número negativo solto na ficha de um cliente é lido como
    // problema, e quem abre a ficha está prestes a falar com essa pessoa.
    montar();
    expect(screen.getByText(/por onde a conversa entra/i)).toBeInTheDocument();
  });

  it('quem está ganhando não recebe recado nenhum', () => {
    montar(pronto({ lucro: '80.00' }));
    expect(screen.queryByText(/por onde a conversa entra/i)).not.toBeInTheDocument();
    expect(screen.getByText('+10,0%')).toBeInTheDocument();
  });

  it('diz desde quando ela aposta, e quando foi a última', () => {
    montar();
    expect(screen.getByText(/Aposta desde 10\/01\/2026, a última em 01\/09\/2026/)).toBeInTheDocument();
  });
});

describe('o perfil em uma frase', () => {
  it('diz o mercado e o esporte principais, com o N junto', () => {
    // ⚠️ "Aposta mais em Over/Under" sozinho mente quando a pessoa tem três
    // apostas. Com o N, quem lê decide se aquilo é perfil ou coincidência.
    montar();
    const bloco = screen.getByRole('region', { name: 'Perfil de aposta' });
    expect(bloco).toHaveTextContent('Aposta mais em Over/Under (7 de 10)');
    expect(bloco).toHaveTextContent('Futebol (9 de 10)');
  });

  it('com poucas apostas, não chama de perfil', () => {
    montar(
      pronto({
        total: 3,
        liquidadas: 3,
        por_mercado: [{ nome: 'Resultado', n: 2, apostado: '100', lucro: '10' }],
        por_esporte: [{ nome: 'Futebol', n: 3, apostado: '150', lucro: '10' }],
      }),
    );
    expect(screen.getByText(/Poucas apostas para falar em perfil/)).toBeInTheDocument();
    expect(screen.queryByText(/Aposta mais em/)).not.toBeInTheDocument();
  });

  it('mas continua mostrando os recortes que existem', () => {
    // Esconder os números junto com a frase deixaria o sócio sem nada. O que
    // muda é a afirmação, não o dado.
    montar(
      pronto({
        total: 3,
        por_mercado: [{ nome: 'Resultado', n: 2, apostado: '100', lucro: '10' }],
      }),
    );
    expect(screen.getByText('Resultado')).toBeInTheDocument();
    expect(screen.getByText(/2 de 3/)).toBeInTheDocument();
  });
});

describe('os recortes', () => {
  it('mercado, esporte e faixa de odd, cada um com o seu', () => {
    montar();
    expect(screen.getByText('Por mercado')).toBeInTheDocument();
    expect(screen.getByText('Por esporte')).toBeInTheDocument();
    expect(screen.getByText('Por faixa de odd')).toBeInTheDocument();
    expect(screen.getByText('1.50 a 1.99')).toBeInTheDocument();
  });

  it('recorte vazio não vira cabeçalho solto', () => {
    montar(pronto({ por_faixa_de_odd: [] }));
    expect(screen.queryByText('Por faixa de odd')).not.toBeInTheDocument();
  });

  it('avisa que aposta em aberto não entra nas contas de dinheiro', () => {
    montar();
    expect(screen.getByText(/Só o que já terminou entra nas contas/)).toBeInTheDocument();
  });
});

describe('quando não há perfil', () => {
  it('quem nunca apostou recebe um texto que não parece erro', () => {
    // É o caso da maior parte da base: 110 pessoas já apostaram na história
    // toda. Um bloco em branco aqui seria lido como falha de carregamento.
    montar({ tipo: 'vazio' });
    expect(screen.getByText(/Nunca registrou aposta no Betinho/)).toBeInTheDocument();
  });

  it('e o vazio é assunto, não só ausência', () => {
    montar({ tipo: 'vazio' });
    expect(screen.getByText(/quem assina e não usa é quem cancela primeiro/i)).toBeInTheDocument();
  });

  it('carregando não é vazio', () => {
    // Dizer "nunca apostou" enquanto a consulta está no ar faria o sócio abrir
    // a conversa errada com quem aposta todo dia.
    montar({ tipo: 'carregando' });
    expect(screen.getByText(/Lendo as apostas/)).toBeInTheDocument();
  });

  it('erro é erro', () => {
    montar({ tipo: 'erro' });
    expect(screen.getByText(/Não deu para ler as apostas/)).toBeInTheDocument();
  });
});
