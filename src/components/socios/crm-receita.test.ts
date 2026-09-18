import { describe, expect, it } from 'vitest';
import {
  emReais,
  formatarMes,
  lerValorDigitado,
  mesesEmAberto,
  montarPagamentos,
  recebidoNaMao,
  recebidoTotal,
  resumirMeses,
  situacaoDaReceita,
  MESES_MOSTRADOS_NA_TELA,
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

describe('recebidoNaMao e recebidoTotal', () => {
  it('soma o que entrou', () => {
    const pagos = montarPagamentos([
      linha({ id: 'a', competencia: '2026-08-01', valor: '39.90' }),
      linha({ id: 'b', competencia: '2026-09-01', valor: '39.90' }),
    ]);
    expect(recebidoNaMao(pagos)).toBeCloseTo(79.8);
    expect(recebidoTotal(pagos)).toBeCloseTo(79.8);
  });

  it('⚠️ dinheiro do gateway NÃO entra no recebido na mão', () => {
    // O defeito que este filtro impede, e ele nasceu com a #457: a ficha
    // passou a carregar pagamento por PESSOA, e o dinheiro do Stripe chega na
    // mesma lista. Sem o filtro, o rótulo "recebido na mão" passaria a incluir
    // o que ninguém recebeu na mão — e é esse número que decide de quem cobrar.
    const pagos = montarPagamentos([
      linha({ id: 'a', competencia: '2026-08-01', valor: '39.90', origem: 'pix' }),
      linha({ id: 'b', competencia: '2026-09-01', valor: '100.00', origem: 'stripe' }),
    ]);
    expect(recebidoNaMao(pagos)).toBeCloseTo(39.9);
    expect(recebidoTotal(pagos)).toBeCloseTo(139.9);
  });

  it('quem só pagou pelo gateway tem zero na mão, e não zero no total', () => {
    const pagos = montarPagamentos([
      linha({ id: 'a', competencia: '2026-09-01', valor: '100.00', origem: 'stripe' }),
    ]);
    expect(recebidoNaMao(pagos)).toBe(0);
    expect(recebidoTotal(pagos)).toBeCloseTo(100);
  });

  it('estornado não conta, nas duas somas', () => {
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
      linha({
        id: 'c',
        competencia: '2026-09-01',
        valor: '100.00',
        origem: 'stripe',
        estornado_em: '2026-09-11T12:00:00Z',
      }),
    ]);
    expect(recebidoNaMao(pagos)).toBeCloseTo(39.9);
    expect(recebidoTotal(pagos)).toBeCloseTo(39.9);
  });

  it('sem pagamento, zero e não NaN', () => {
    expect(recebidoNaMao([])).toBe(0);
    expect(recebidoTotal([])).toBe(0);
  });
});

describe('mesesEmAberto', () => {
  it('o mês corrente é devido', () => {
    // A cobrança é no começo do mês. Quem paga no dia 20 aparece devendo do
    // dia 1º ao 20, e é isso que faz a cobrança acontecer.
    expect(mesesEmAberto('2026-09-01', 39.9, [], HOJE)).toEqual(['2026-09']);
  });

  it('⚠️ fatura do cartão NÃO quita mês de assinatura manual', () => {
    // O defeito que a revisão pegou, e ele nasceu quando a ficha passou a
    // carregar pagamento por pessoa: a lista que chega aqui tem as duas
    // origens, e sem filtro uma fatura do Stripe fechava um mês do acordo feito
    // na mão.
    //
    // A consequência era duas telas se desmentindo sobre a mesma pessoa: "em
    // dia" na ficha e "devendo" na fila de inadimplentes, que descarta as
    // linhas sem assinatura de propósito.
    //
    // São dinheiros de acordos diferentes. Quem paga no cartão não está pagando
    // a mensalidade que o sócio combinou por fora.
    const doGateway = montarPagamentos([
      linha({ competencia: '2026-09-01', origem: 'stripe' }),
    ]);
    expect(mesesEmAberto('2026-09-01', 39.9, doGateway, HOJE)).toEqual(['2026-09']);
  });

  it('e o dinheiro da mão continua quitando', () => {
    // O outro lado do mesmo guarda: filtrar demais quebraria a cobrança.
    const naMao = montarPagamentos([linha({ competencia: '2026-09-01', origem: 'pix' })]);
    expect(mesesEmAberto('2026-09-01', 39.9, naMao, HOJE)).toEqual([]);
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

  it('uma assinatura muito antiga devolve TODOS os meses, sem cortar', () => {
    // ⚠️ Este teste já afirmou o CONTRÁRIO, e era o defeito. A função cortava
    // nos doze mais recentes, e quem multiplicava pelo tamanho da lista — a
    // ficha e a fila de inadimplentes — calculava a dívida em cima do recorte.
    // Quem devia dezoito meses aparecia devendo doze, em silêncio, e o sócio
    // cobrava menos do que devia sem nunca saber.
    //
    // Resumir a lista continua valendo, mas é decisão de TELA e mora noutro
    // lugar. A conta precisa da verdade.
    const abertos = mesesEmAberto('2023-01-01', 39.9, [], HOJE);
    expect(abertos).toHaveLength(45);
    expect(abertos[0]).toBe('2023-01');
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

  it('quem deve dezoito meses deve dezoito, e o total acompanha', () => {
    // ⚠️ O defeito que esta mudança conserta. O corte de doze meses vivia
    // dentro de `mesesEmAberto`, e esta função multiplica pelo TAMANHO da
    // lista que recebe — então o corte não encolhia só a lista, encolhia o
    // dinheiro. Quem devia 718,20 aparecia devendo 478,80, e a diferença
    // sumia sem nenhum aviso na tela.
    const situacao = situacaoDaReceita('2025-04-01', 39.9, [], HOJE);
    expect(situacao.tipo).toBe('devendo');
    if (situacao.tipo === 'devendo') {
      expect(situacao.meses).toBe(18);
      expect(situacao.total).toBeCloseTo(718.2);
    }
  });
});

describe('resumirMeses', () => {
  // Rótulos sintéticos, e não meses: o que estes casos exercitam é a ordem e a
  // contagem, e `m1..m18` deixa a ponta cortada óbvia na mensagem de falha.
  // Chamar isto de `meses` prometia domínio e entregava etiqueta.
  const rotulos = (n: number) => Array.from({ length: n }, (_, i) => `m${i + 1}`);

  it('lista curta não é resumida, e nada fica oculto', () => {
    expect(resumirMeses(['2026-07', '2026-08'])).toEqual({
      mostrados: ['2026-07', '2026-08'],
      ocultos: 0,
    });
  });

  it('lista vazia não inventa resumo', () => {
    expect(resumirMeses([])).toEqual({ mostrados: [], ocultos: 0 });
  });

  it('exatamente no teto ainda não resume', () => {
    // A borda importa: resumir um item só trocaria um mês por "e mais 1", que
    // ocupa o mesmo espaço e diz menos.
    const { mostrados, ocultos } = resumirMeses(rotulos(MESES_MOSTRADOS_NA_TELA));
    expect(mostrados).toHaveLength(MESES_MOSTRADOS_NA_TELA);
    expect(ocultos).toBe(0);
  });

  it('acima do teto mostra os mais ANTIGOS e DIZ quantos ficaram', () => {
    // ⚠️ `ocultos` é o que impede a tela de mentir. Sem ele a linha mostraria
    // doze meses embaixo de um selo dizendo dezoito, e os dois números na
    // mesma tela se desmentiriam.
    //
    // ⚠️ E guarda a PONTA. A primeira versão manteve os mais recentes, só
    // porque era o que o código antigo fazia, e isso quebrava duas coisas: o
    // "e mais 6" ficava no fim da frase prometendo meses POSTERIORES ao
    // último mostrado, quando os escondidos eram os anteriores; e a ficha
    // sugeria lançar o mês mais antigo, que a linha não listava.
    //
    // Numa fila que existe para decidir insistir ou encerrar, a idade da
    // dívida é justamente o que não se corta.
    const { mostrados, ocultos } = resumirMeses(rotulos(18));
    expect(mostrados).toHaveLength(12);
    expect(ocultos).toBe(6);
    expect(mostrados[0]).toBe('m1');
    expect(mostrados[mostrados.length - 1]).toBe('m12');
  });

  it('nenhum mês some da conta: mostrados mais ocultos é sempre o total', () => {
    // A propriedade que garante que resumir nunca vira truncar.
    for (const n of [0, 1, 11, 12, 13, 45]) {
      const { mostrados, ocultos } = resumirMeses(rotulos(n));
      expect(mostrados.length + ocultos, `com ${n} meses`).toBe(n);
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
