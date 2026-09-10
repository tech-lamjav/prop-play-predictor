import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BlocoDeComportamento } from './BlocoDeComportamento';
import type { Comportamento } from './crm-comportamento';

const CHEIO: Comportamento = {
  primeiroEvento: '2026-09-01T12:00:00Z',
  ultimoEvento: '2026-09-09T12:00:00Z',
  eventos: 40,
  sessoes: 5,
  segundosDeTela: 8100,
  paginas: [
    { caminho: '/futebol', vezes: 12 },
    { caminho: '/planos', vezes: 3 },
  ],
};

const montar = (
  estado: Parameters<typeof BlocoDeComportamento>[0]['estado'],
  cadastradoEm: string | null = '2026-09-01T10:00:00Z',
) => render(<BlocoDeComportamento estado={estado} cadastradoEm={cadastradoEm} />);

describe('BlocoDeComportamento', () => {
  it('mostra visitas, tempo somado e última visita', () => {
    montar({ tipo: 'pronto', comportamento: CHEIO });
    expect(screen.getByLabelText('Sessões')).toHaveTextContent('5');
    expect(screen.getByLabelText('Tempo de tela')).toHaveTextContent('2h 15min');
    expect(screen.getByLabelText('Última visita')).toHaveTextContent('09/09/2026');
  });

  it('lista as páginas mais vistas', () => {
    montar({ tipo: 'pronto', comportamento: CHEIO });
    expect(screen.getByText('/futebol')).toBeInTheDocument();
  });

  it('zero visita é informação, e das boas', () => {
    // A pessoa se cadastrou e nunca voltou. Dizer isso é diferente de deixar o
    // bloco vazio, que seria lido como "não sabemos".
    montar({ tipo: 'pronto', comportamento: { ...CHEIO, sessoes: 0, paginas: [] } });
    expect(screen.getByText(/se cadastrou e não voltou/i)).toBeInTheDocument();
  });

  it('avisa quando o PostHog só guarda parte da história', () => {
    // "5 visitas" para quem se cadastrou em março parece abandono, e pode ser
    // só retenção de dados do plano.
    montar({ tipo: 'pronto', comportamento: CHEIO }, '2026-03-05T12:00:00Z');
    expect(screen.getByText(/não de sempre/i)).toBeInTheDocument();
  });

  it('sem truncamento, nenhum aviso aparece', () => {
    montar({ tipo: 'pronto', comportamento: CHEIO });
    expect(screen.queryByText(/não de sempre/i)).not.toBeInTheDocument();
  });

  it('chave não configurada é dito com essas palavras', () => {
    // É problema de ambiente, e a frase precisa mandar o sócio para o lugar
    // certo em vez de sugerir que a pessoa não usou o produto.
    montar({ tipo: 'erro', motivo: 'Error: sem_chave' });
    expect(screen.getByText(/chave de consulta do PostHog não está configurada/i)).toBeInTheDocument();
  });

  it('outra falha não vira "sem chave"', () => {
    montar({ tipo: 'erro', motivo: 'Error: posthog_falhou' });
    expect(screen.getByText(/não deu para consultar/i)).toBeInTheDocument();
  });

  it('carregando não é o mesmo que zero', () => {
    const { container } = montar({ tipo: 'carregando' });
    expect(screen.getByText(/consultando o PostHog/i)).toBeInTheDocument();
    expect(container.textContent).not.toContain('0');
  });
});

describe('BlocoDeComportamento · zero que não é da pessoa', () => {
  it('projeto mudo é dito como problema de configuração', () => {
    // Zero na pessoa E zero no projeto inteiro não é a pessoa: é a função
    // perguntando no lugar errado. Dizer "não voltou ao site" aí seria uma
    // afirmação sobre alguém feita com base numa falha de configuração — foi
    // exatamente o que a tela fez na primeira tentativa.
    montar({
      tipo: 'pronto',
      comportamento: { ...CHEIO, sessoes: 0, eventos: 0, paginas: [], eventosNoProjetoNaSemana: 0 },
    });
    expect(screen.getByText(/problema é de configuração/i)).toBeInTheDocument();
    expect(screen.queryByText(/não voltou ao site/i)).not.toBeInTheDocument();
  });

  it('projeto com movimento e pessoa sem evento é a pessoa mesmo', () => {
    montar({
      tipo: 'pronto',
      comportamento: {
        ...CHEIO,
        sessoes: 0,
        eventos: 0,
        paginas: [],
        eventosNoProjetoNaSemana: 5000,
      },
    });
    expect(screen.getByText(/não voltou ao site/i)).toBeInTheDocument();
  });
});
