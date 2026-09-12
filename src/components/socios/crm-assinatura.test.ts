import { describe, expect, it } from 'vitest';
import {
  aCobrar,
  montarAssinaturas,
  type Assinatura,
  type AssinaturaDoBanco,
} from './crm-assinatura';
import { cadastroDeTeste as cadastro } from './crm-cadastro-de-teste';

const HOJE = '2026-09-12';

const linha = (over: Partial<AssinaturaDoBanco> = {}): AssinaturaDoBanco => ({
  id: 'a1',
  user_id: 'u1',
  plano: 'essencial',
  vence_em: '2026-09-20',
  valor_mensal: '39.90',
  criada_em: '2026-09-01T12:00:00Z',
  criada_por: 's1',
  ...over,
});

const base = [cadastro({ id: 'u1', name: 'Maria Silva', whatsapp_number: '5511998877665' })];

describe('montarAssinaturas', () => {
  it('junta a concessão com quem é a pessoa', () => {
    const [a] = montarAssinaturas([linha()], base);
    expect(a.pessoa).toBe('Maria Silva');
    expect(a.whatsapp).toBe('5511998877665');
    expect(a.plano).toBe('essencial');
    expect(a.venceEm).toBe('2026-09-20');
  });

  it('o valor vira número, mesmo vindo como texto do banco', () => {
    // `numeric` chega como string no PostgREST. Somar string concatena, e o
    // total da receita apareceria como "39.9039.90".
    expect(montarAssinaturas([linha({ valor_mensal: '39.90' })], base)[0].valorMensal).toBe(39.9);
  });

  it('valor nulo continua nulo, e não vira zero', () => {
    // Nulo é SEM COBRANÇA, que é uma escolha. Zero seria uma cobrança de R$
    // 0,00, e ela entraria na conta de meses em aberto como dívida de nada.
    expect(montarAssinaturas([linha({ valor_mensal: null })], base)[0].valorMensal).toBeNull();
  });

  it('data nula é vitalícia, e chega nula', () => {
    // Nulo, e não uma data de 2099: uma data inventada o resto do sistema
    // trataria como verdade, ordenando a fila por ela e um dia chegando nela.
    expect(montarAssinaturas([linha({ vence_em: null })], base)[0].venceEm).toBeNull();
  });

  it('sem nome, a linha se identifica pelo e-mail', () => {
    const semNome = [cadastro({ id: 'u1', name: null, email: 'anon@exemplo.com' })];
    expect(montarAssinaturas([linha()], semNome)[0].pessoa).toBe('anon@exemplo.com');
  });

  it('quem não está na base some da fila', () => {
    // Uma cobrança sem dono é uma cobrança que ninguém consegue mandar, e
    // mostrá-la com um identificador cru só ocuparia espaço.
    expect(montarAssinaturas([linha({ user_id: 'fantasma' })], base)).toEqual([]);
  });

  it('plano que a tela não conhece some, em vez de virar "entrada"', () => {
    // Chutar um padrão faria a tela cobrar pelo plano errado, e a mensagem
    // pronta sairia com o nome errado dentro.
    expect(montarAssinaturas([linha({ plano: 'combo-novo' })], base)).toEqual([]);
  });

  it('ordena por quem vence primeiro', () => {
    // Essa ordem É o produto desta tela: a fila lida de cima para baixo tem que
    // começar por quem está mais perto de perder o acesso.
    const cadastros = [
      cadastro({ id: 'u1', name: 'Primeira' }),
      cadastro({ id: 'u2', name: 'Segunda' }),
      cadastro({ id: 'u3', name: 'Terceira' }),
    ];
    const ordenadas = montarAssinaturas(
      [
        linha({ id: 'c', user_id: 'u3', vence_em: '2026-10-30' }),
        linha({ id: 'a', user_id: 'u1', vence_em: '2026-09-15' }),
        linha({ id: 'b', user_id: 'u2', vence_em: '2026-09-20' }),
      ],
      cadastros,
    );
    expect(ordenadas.map((a) => a.pessoa)).toEqual(['Primeira', 'Segunda', 'Terceira']);
  });

  it('empate de data desempata pelo identificador, e não pela sorte', () => {
    // Sem desempate, duas concessões do mesmo dia se reordenariam sozinhas
    // entre dois carregamentos da tela.
    const cadastros = [cadastro({ id: 'u1' }), cadastro({ id: 'u2' })];
    const ids = montarAssinaturas(
      [
        linha({ id: 'zzz', user_id: 'u2', vence_em: '2026-09-15' }),
        linha({ id: 'aaa', user_id: 'u1', vence_em: '2026-09-15' }),
      ],
      cadastros,
    ).map((a) => a.id);
    expect(ids).toEqual(['aaa', 'zzz']);
  });
});

describe('aCobrar', () => {
  const fila = (...datas: string[]): Assinatura[] =>
    montarAssinaturas(
      datas.map((d, i) => linha({ id: `a${i}`, user_id: `u${i}`, vence_em: d })),
      datas.map((_, i) => cadastro({ id: `u${i}`, name: `Pessoa ${i}` })),
    );

  it('pega quem vence dentro da janela', () => {
    const dentro = aCobrar(fila('2026-09-15', '2026-11-30'), HOJE);
    expect(dentro.map((a) => a.venceEm)).toEqual(['2026-09-15']);
  });

  it('o sétimo dia ainda entra, e o oitavo não', () => {
    const ids = aCobrar(fila('2026-09-19', '2026-09-20'), HOJE).map((a) => a.venceEm);
    expect(ids).toEqual(['2026-09-19']);
  });

  it('quem já venceu continua na fila, e vem primeiro', () => {
    // É o ponto principal: quem perdeu o acesso ontem é mais urgente que quem
    // perde daqui a seis dias. Uma fila que só olha para frente deixa essa
    // pessoa invisível justamente no dia em que ela some.
    const ids = aCobrar(fila('2026-09-15', '2026-08-30'), HOJE).map((a) => a.venceEm);
    expect(ids).toEqual(['2026-08-30', '2026-09-15']);
  });

  it('quem vence hoje está na fila', () => {
    expect(aCobrar(fila(HOJE), HOJE)).toHaveLength(1);
  });

  it('a janela dá para abrir', () => {
    expect(aCobrar(fila('2026-10-10'), HOJE)).toHaveLength(0);
    expect(aCobrar(fila('2026-10-10'), HOJE, 60)).toHaveLength(1);
  });

  it('vitalícia nunca entra na fila, nem com a janela escancarada', () => {
    // Não é esquecimento: esta fila é a de VENCIMENTO, e quem não vence não tem
    // o que vencer. Quem é vitalício e paga por mês pode ficar devendo, e essa
    // cobrança sai dos meses em aberto, que é outra fila.
    const vitalicia = montarAssinaturas([linha({ vence_em: null })], base);
    expect(aCobrar(vitalicia, HOJE)).toHaveLength(0);
    expect(aCobrar(vitalicia, HOJE, 3650)).toHaveLength(0);
  });

  it('vitalícia fica no fim da lista, e não na frente de quem vence amanhã', () => {
    const ordem = montarAssinaturas(
      [
        linha({ id: 'a1', user_id: 'u1', vence_em: null }),
        linha({ id: 'a2', user_id: 'u2', vence_em: '2026-09-13' }),
      ],
      [cadastro({ id: 'u1', name: 'Vitalicia' }), cadastro({ id: 'u2', name: 'Vence amanha' })],
    );
    expect(ordem.map((a) => a.pessoa)).toEqual(['Vence amanha', 'Vitalicia']);
  });
});
