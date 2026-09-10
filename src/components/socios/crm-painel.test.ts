import { describe, expect, it } from 'vitest';
import {
  contarPorPosicao,
  DIAS_PARA_ESTAR_PARADO,
  filaDeTrabalho,
  metricasDeNegocio,
  montarLeads,
  type Toques,
} from './crm-painel';
import { cadastroDeTeste as cadastro } from './crm-cadastro-de-teste';
import type { EtapasGravadas } from './crm-funil';

const HOJE = '2026-09-11';

const monta = (
  cadastros = [cadastro()],
  etapas: EtapasGravadas = {},
  toques: Toques = {},
  apostas: Record<string, number> = {},
) => montarLeads(cadastros, etapas, toques, apostas, HOJE);

describe('montarLeads', () => {
  it('junta cadastro, etapa e gancho numa linha só', () => {
    const [lead] = monta(
      [cadastro({ id: 'a', name: 'Maria Silva' })],
      { a: 'contatado' },
      {},
      { a: 12 },
    );
    expect(lead.nome).toBe('Maria Silva');
    expect(lead.etapa).toBe('contatado');
    expect(lead.gancho.tipo).toBe('betinho');
  });

  it('sem nome, a linha se identifica pelo e-mail', () => {
    const [lead] = monta([cadastro({ id: 'a', name: null, email: 'anon@exemplo.com' })]);
    expect(lead.nome).toBe('anon@exemplo.com');
  });

  it('quem nunca foi tocado conta o tempo desde o cadastro', () => {
    // "Parado há 2 dias" para quem se cadastrou há dois dias e nunca recebeu
    // nada é a informação certa: o relógio do lead começa a correr no cadastro,
    // não no primeiro contato que nunca houve.
    const [lead] = monta([cadastro({ id: 'a', created_at: '2026-09-09T12:00:00Z' })]);
    expect(lead.ultimoToque).toBeNull();
    expect(lead.diasParado).toBe(2);
  });

  it('quem foi tocado conta o tempo desde o último toque', () => {
    const [lead] = monta(
      [cadastro({ id: 'a', created_at: '2026-08-01T12:00:00Z' })],
      { a: 'contatado' },
      { a: '2026-09-10T12:00:00Z' },
    );
    expect(lead.diasParado).toBe(1);
  });

  it('sem data de cadastro e sem toque, não inventa dias parados', () => {
    const [lead] = monta([cadastro({ id: 'a', created_at: null })]);
    expect(lead.diasParado).toBeNull();
  });
});

describe('contarPorPosicao', () => {
  it('conta as oito posições, inclusive as vazias', () => {
    // Posição com zero precisa aparecer: a faixa do funil desenha a FORMA do
    // funil, e um degrau que some faz o desenho mentir sobre onde está o
    // gargalo.
    const contagem = contarPorPosicao(
      monta([cadastro({ id: 'a' }), cadastro({ id: 'b' })], { b: 'interesse' }),
    );
    expect(contagem.novo).toBe(1);
    expect(contagem.interesse).toBe(1);
    expect(contagem.boletada).toBe(0);
    expect(Object.keys(contagem)).toHaveLength(8);
  });

  it('quem assina aparece como assinante, e não na etapa manual', () => {
    // O estado calculado vence: quem já assina não está sentado em
    // "interesse", e mostrar ele nos dois lugares faria o funil somar duas
    // vezes a mesma pessoa.
    const contagem = contarPorPosicao(
      monta([cadastro({ id: 'a', futebol_subscription_status: 'premium' })], { a: 'interesse' }),
    );
    expect(contagem.assinante).toBe(1);
    expect(contagem.interesse).toBe(0);
  });

  it('quem está no teste gratuito aparece como em teste', () => {
    const contagem = contarPorPosicao(
      monta([cadastro({ id: 'a', futebol_trial_started_at: '2026-09-09T12:00:00Z' })]),
    );
    expect(contagem.em_teste).toBe(1);
    expect(contagem.novo).toBe(0);
  });

  it('teste vencido não segura ninguém em em teste', () => {
    // Sete dias e acabou. Sem isso, a coluna vira depósito de gente que testou
    // meses atrás e nunca mais voltou.
    const contagem = contarPorPosicao(
      monta([cadastro({ id: 'a', futebol_trial_started_at: '2026-07-01T12:00:00Z' })]),
    );
    expect(contagem.em_teste).toBe(0);
    expect(contagem.novo).toBe(1);
  });
});

describe('metricasDeNegocio', () => {
  const base = [
    cadastro({ id: 'a', created_at: '2026-09-10T12:00:00Z' }),
    cadastro({ id: 'b', created_at: '2026-07-01T12:00:00Z', futebol_subscription_status: 'premium' }),
    cadastro({ id: 'c', created_at: '2026-07-01T12:00:00Z' }),
    cadastro({ id: 'd', created_at: '2026-07-01T12:00:00Z' }),
  ];

  it('conta os cadastros dos últimos trinta dias', () => {
    expect(metricasDeNegocio(monta(base), HOJE).cadastrosNoMes).toBe(1);
  });

  it('a conversão é a fatia da base que assina', () => {
    expect(metricasDeNegocio(monta(base), HOJE).conversao).toBe(25);
  });

  it('base vazia não vira divisão por zero', () => {
    // Um "NaN%" na primeira dobra do painel é o tipo de coisa que faz o sócio
    // desconfiar de todos os outros números da tela.
    const m = metricasDeNegocio([], HOJE);
    expect(m.conversao).toBe(0);
    expect(m.abordados).toBe(0);
  });

  it('abordados é quem já saiu de novo', () => {
    // É a métrica de esforço, e não de resultado: mede quanto da base a gente
    // conseguiu tocar, que na fase de MVP é o gargalo real.
    const leads = monta(base, { b: 'interesse', c: 'contatado' });
    expect(metricasDeNegocio(leads, HOJE).abordados).toBe(50);
  });
});

describe('filaDeTrabalho', () => {
  it('novo sem contato é quem nunca saiu da primeira etapa', () => {
    const fila = filaDeTrabalho(monta([cadastro({ id: 'a' }), cadastro({ id: 'b' })], { b: 'contatado' }));
    expect(fila.novosSemContato.map((l) => l.id)).toEqual(['a']);
  });

  it('parado é quem está no meio do funil e não recebe nada há uma semana', () => {
    const leads = monta(
      [cadastro({ id: 'a' }), cadastro({ id: 'b' })],
      { a: 'contatado', b: 'contatado' },
      { a: '2026-09-01T12:00:00Z', b: '2026-09-10T12:00:00Z' },
    );
    expect(fila(leads).parados.map((l) => l.id)).toEqual(['a']);
  });

  it('quem assina ou não respondeu não é cobrança pendente', () => {
    // As duas são pontas do funil. Deixá-las na fila de parados enche a lista
    // de casos fechados e o sócio para de olhar a fila.
    const antigo = { a: '2026-01-01T12:00:00Z', b: '2026-01-01T12:00:00Z' };
    const leads = monta(
      [cadastro({ id: 'a', futebol_subscription_status: 'premium' }), cadastro({ id: 'b' })],
      { a: 'interesse', b: 'sem_resposta' },
      antigo,
    );
    expect(fila(leads).parados).toEqual([]);
  });

  it('o mais parado aparece primeiro', () => {
    const leads = monta(
      [cadastro({ id: 'a' }), cadastro({ id: 'b' })],
      { a: 'nutrindo', b: 'nutrindo' },
      { a: '2026-08-01T12:00:00Z', b: '2026-08-20T12:00:00Z' },
    );
    expect(fila(leads).parados.map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('o corte é declarado, e não um número solto no meio do código', () => {
    expect(DIAS_PARA_ESTAR_PARADO).toBe(7);
  });
});

const fila = (leads: ReturnType<typeof monta>) => filaDeTrabalho(leads);

describe('montarLeads · quando a contagem de apostas falha', () => {
  it('o gancho se declara incompleto em vez de dizer que ninguém apostou', () => {
    // Mapa nulo é a RPC que falhou. Tratar isso como zero vira "conferi, não
    // apostou" — e a aposta é o primeiro sinal da fila do gancho, então o
    // palpite abaixo dela pode estar apontando para o lado errado.
    const [lead] = montarLeads([cadastro({ id: 'a' })], {}, {}, null, HOJE);
    expect(lead.gancho.apostasDesconhecidas).toBe(true);
  });

  it('com a contagem respondendo, zero é zero mesmo', () => {
    const [lead] = montarLeads([cadastro({ id: 'a' })], {}, {}, {}, HOJE);
    expect(lead.gancho.apostasDesconhecidas).toBe(false);
  });
});
