import { describe, expect, it } from 'vitest';
import {
  emReais,
  formatarMes,
  lerValorDigitado,
  mesesEmAberto,
  montarPagamentos,
  receitaRecebida,
  situacaoDaReceita,
  TETO_DE_MESES_EM_ABERTO,
  type PagamentoDoBanco,
} from './crm-receita';

const HOJE = '2026-09-15';

const linha = (over: Partial<PagamentoDoBanco> = {}): PagamentoDoBanco => ({
  id: 'p1',
  competencia: '2026-09-01',
  valor: '39.90',
  origem: 'pix',
  pago_em: '2026-09-03',
  estornado_em: null,
  motivo_do_estorno: null,
  ...over,
});

describe('montarPagamentos', () => {
  it('a competência vira mês, e o dia do pagamento fica separado', () => {
    // Um Pix que cai em 2 de outubro pagando setembro tem competência em
    // setembro e caiu em outubro. Juntar os dois perderia a distinção que
    // responde qual mês está em aberto.
    const [p] = montarPagamentos([linha({ competencia: '2026-09-01', pago_em: '2026-10-02' })]);
    expect(p.mes).toBe('2026-09');
    expect(p.pagoEm).toBe('2026-10-02');
  });

  it('o valor vira número, mesmo vindo como texto do banco', () => {
    // `numeric` chega como string no PostgREST. Somar string concatena, e o
    // total apareceria como "39.9039.90".
    const [p] = montarPagamentos([linha({ valor: '39.90' })]);
    expect(p.valor).toBe(39.9);
  });

  it('do mês mais novo para o mais antigo', () => {
    const meses = montarPagamentos([
      linha({ id: 'a', competencia: '2026-07-01' }),
      linha({ id: 'b', competencia: '2026-09-01' }),
      linha({ id: 'c', competencia: '2026-08-01' }),
    ]).map((p) => p.mes);
    expect(meses).toEqual(['2026-09', '2026-08', '2026-07']);
  });

  it('estorno chega marcado, com o motivo', () => {
    const [p] = montarPagamentos([
      linha({ estornado_em: '2026-09-10T12:00:00Z', motivo_do_estorno: 'lancei no mês errado' }),
    ]);
    expect(p.estornado).toBe(true);
    expect(p.motivoDoEstorno).toBe('lancei no mês errado');
  });
});

describe('receitaRecebida', () => {
  it('soma o que entrou', () => {
    const pagos = montarPagamentos([
      linha({ id: 'a', competencia: '2026-08-01', valor: '39.90' }),
      linha({ id: 'b', competencia: '2026-09-01', valor: '39.90' }),
    ]);
    expect(receitaRecebida(pagos)).toBeCloseTo(79.8);
  });

  it('estornado não conta', () => {
    // É o ponto de existir estorno: um lançamento errado sai da soma sem sair
    // da tabela. Se contasse, a receita mentiria e ninguém teria como corrigir.
    const pagos = montarPagamentos([
      linha({ id: 'a', competencia: '2026-08-01', valor: '39.90' }),
      linha({
        id: 'b',
        competencia: '2026-09-01',
        valor: '39.90',
        estornado_em: '2026-09-10T12:00:00Z',
      }),
    ]);
    expect(receitaRecebida(pagos)).toBeCloseTo(39.9);
  });

  it('sem pagamento, zero e não NaN', () => {
    expect(receitaRecebida([])).toBe(0);
  });
});

describe('mesesEmAberto', () => {
  it('o mês corrente é devido', () => {
    // A cobrança é no começo do mês. Quem paga no dia 20 aparece devendo do
    // dia 1º ao 20, e é isso que faz a cobrança acontecer.
    expect(mesesEmAberto('2026-09-01', 39.9, [], HOJE)).toEqual(['2026-09']);
  });

  it('o mês pago sai da lista', () => {
    const pagos = montarPagamentos([linha({ competencia: '2026-09-01' })]);
    expect(mesesEmAberto('2026-09-01', 39.9, pagos, HOJE)).toEqual([]);
  });

  it('conta todos os meses desde o começo, do mais antigo primeiro', () => {
    expect(mesesEmAberto('2026-07-01', 39.9, [], HOJE)).toEqual(['2026-07', '2026-08', '2026-09']);
  });

  it('um mês pago no meio não tira os outros', () => {
    const pagos = montarPagamentos([linha({ competencia: '2026-08-01' })]);
    expect(mesesEmAberto('2026-07-01', 39.9, pagos, HOJE)).toEqual(['2026-07', '2026-09']);
  });

  it('pagamento estornado volta a devendo', () => {
    const pagos = montarPagamentos([
      linha({ competencia: '2026-09-01', estornado_em: '2026-09-10T12:00:00Z' }),
    ]);
    expect(mesesEmAberto('2026-09-01', 39.9, pagos, HOJE)).toEqual(['2026-09']);
  });

  it('atravessa a virada do ano', () => {
    // Dezembro para janeiro é onde a conta de mês costuma quebrar.
    expect(mesesEmAberto('2025-11-01', 39.9, [], '2026-01-15')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
    ]);
  });

  it('sem valor mensal não tem mês em aberto', () => {
    // Quem não combinou pagar não deve nada. Chamar isso de dívida encheria a
    // fila de cobrança de gente que não tem o que pagar.
    expect(mesesEmAberto('2026-01-01', null, [], HOJE)).toEqual([]);
  });

  it('assinatura que começa no futuro não deve nada', () => {
    expect(mesesEmAberto('2026-12-01', 39.9, [], HOJE)).toEqual([]);
  });

  it('uma assinatura muito antiga não vira lista de dois anos', () => {
    // Sem teto, a tela listaria vinte e tantos meses devidos, e uma lista assim
    // não é cobrança, é ruído. O teto mantém os mais recentes.
    const abertos = mesesEmAberto('2023-01-01', 39.9, [], HOJE);
    expect(abertos).toHaveLength(TETO_DE_MESES_EM_ABERTO);
    expect(abertos[abertos.length - 1]).toBe('2026-09');
  });
});

describe('situacaoDaReceita', () => {
  it('sem cobrança é estado próprio, e não inadimplência', () => {
    expect(situacaoDaReceita('2026-01-01', null, [], HOJE)).toEqual({ tipo: 'sem_cobranca' });
  });

  it('em dia quando não falta mês', () => {
    const pagos = montarPagamentos([linha({ competencia: '2026-09-01' })]);
    expect(situacaoDaReceita('2026-09-01', 39.9, pagos, HOJE)).toEqual({ tipo: 'em_dia' });
  });

  it('devendo diz quantos meses e quanto', () => {
    // O total é o que decide se vale insistir ou encerrar.
    const situacao = situacaoDaReceita('2026-07-01', 39.9, [], HOJE);
    expect(situacao.tipo).toBe('devendo');
    if (situacao.tipo === 'devendo') {
      expect(situacao.meses).toBe(3);
      expect(situacao.total).toBeCloseTo(119.7);
    }
  });
});

describe('lerValorDigitado', () => {
  it('vírgula é o decimal, que é como se digita aqui', () => {
    expect(lerValorDigitado('39,90')).toBe(39.9);
  });

  it('ponto também, que é o que sai de teclado numérico', () => {
    expect(lerValorDigitado('39.90')).toBe(39.9);
  });

  it('com vírgula presente, o ponto é separador de milhar', () => {
    // "1.500,00" é mil e quinhentos, e "1.500" sozinho é mil e quinhentos
    // também para quem digitou. A regra segue a vírgula: ela é quem decide.
    expect(lerValorDigitado('1.500,00')).toBe(1500);
  });

  it('em branco é nulo, que quer dizer sem cobrança', () => {
    // Nulo é uma escolha, e não ausência de resposta: existe assinatura dada
    // sem valor combinado, e ela não tem o que cobrar.
    expect(lerValorDigitado('')).toBeNull();
    expect(lerValorDigitado('   ')).toBeNull();
  });

  it('texto que não é número é inválido, e NÃO nulo', () => {
    // ⚠️ O erro que este retorno existe para impedir: devolver nulo aqui
    // gravaria "sem cobrança" para quem digitou o preço errado, e essa pessoa
    // nunca mais apareceria numa fila de cobrança.
    expect(lerValorDigitado('trinta e nove')).toBe('invalido');
    expect(lerValorDigitado('39,90,10')).toBe('invalido');
  });

  it('zero e negativo são inválidos', () => {
    // Zero não é sem cobrança: seria receita de R$ 0,00 somada num total, e
    // meses em aberto de valor nenhum numa fila de inadimplente.
    expect(lerValorDigitado('0')).toBe('invalido');
    expect(lerValorDigitado('-39,90')).toBe('invalido');
  });

  it('arredonda para duas casas, como o banco', () => {
    // `numeric(10, 2)` guardaria outro número, e a tela mostraria um valor e o
    // banco outro.
    expect(lerValorDigitado('39,999')).toBe(40);
  });

  it('aguenta o R$ colado, que é como se copia de um recado', () => {
    expect(lerValorDigitado('R$ 39,90')).toBe(39.9);
  });
});

describe('como os números aparecem', () => {
  it('o mês em português', () => {
    expect(formatarMes('2026-09')).toBe('09/2026');
  });

  it('o valor em reais, com centavos', () => {
    // Centavo faltando num número de dinheiro é o tipo de coisa que faz o
    // sócio desconfiar de todos os outros.
    expect(emReais(39.9).replace(/\u00a0/g, ' ')).toBe('R$ 39,90');
    expect(emReais(0).replace(/\u00a0/g, ' ')).toBe('R$ 0,00');
  });
});
