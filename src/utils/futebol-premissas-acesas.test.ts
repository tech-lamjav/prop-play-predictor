import { describe, expect, it } from 'vitest';
import { premissasAcesasDaLeitura } from './futebol-motivos';

// ============================================================================
// O lado positivo dos motivos, num lugar só (#332)
// ============================================================================
// O resumo do jogo e o painel da lista montavam esta lista cada um por conta, e
// NÃO do mesmo jeito: cortes diferentes, filtro de peso diferente, um com
// fallback de histórico e outro sem. Não era duplicação — eram dois
// comportamentos.
//
// A diferença vira PARÂMETRO aqui, de propósito. Ela desaparece sozinha no #334,
// quando o contrato virar a fonte e os itens passarem a ser os mesmos nos dois
// lugares. Unificar agora seria mudar tela dentro de um ticket que promete não
// mudar nada.
//
// Os pesos usados nos casos são os reais do catálogo de Gols, para o teste
// quebrar se alguém recalibrar sem olhar aqui:
//   defesas_firmes 14 · defesas_vazaveis 12 · ataque_combinado 12
//   xg_baixo_combinado 10 · ataques_fracos 3 · ambos_vazam 0 · ritmo_alto 0
// ============================================================================

const GOLS = 'goals_over_under';

/** Como o resumo do jogo chama hoje. */
const COMO_O_RESUMO = { max: 3, incluirPesoZero: true };

/** Como o painel da lista chama hoje. */
const COMO_O_PAINEL = { max: 4, incluirPesoZero: false };

const semContexto = {
  numeros: undefined,
  historico: undefined,
  lado: null,
  linha: null,
};

const slugs = (itens: { premissa: { slug: string } }[]) => itens.map((i) => i.premissa.slug);

describe('premissasAcesasDaLeitura', () => {
  it('sem premissa acesa, não devolve item nenhum', () => {
    expect(
      premissasAcesasDaLeitura({ mercado: GOLS, acesas: [], ...semContexto }, COMO_O_RESUMO),
    ).toEqual([]);
  });

  it('ordena por peso, do maior para o menor', () => {
    const itens = premissasAcesasDaLeitura(
      {
        mercado: GOLS,
        acesas: ['ataques_fracos', 'defesas_firmes', 'xg_baixo_combinado'],
        ...semContexto,
      },
      COMO_O_RESUMO,
    );

    expect(slugs(itens)).toEqual(['defesas_firmes', 'xg_baixo_combinado', 'ataques_fracos']);
  });

  it('corta no máximo pedido, mantendo os de maior peso', () => {
    const itens = premissasAcesasDaLeitura(
      {
        mercado: GOLS,
        acesas: ['defesas_firmes', 'defesas_vazaveis', 'xg_baixo_combinado', 'ataques_fracos'],
        ...semContexto,
      },
      COMO_O_RESUMO,
    );

    expect(slugs(itens)).toEqual(['defesas_firmes', 'defesas_vazaveis', 'xg_baixo_combinado']);
  });

  it('com menos acesas que o corte, devolve todas', () => {
    const itens = premissasAcesasDaLeitura(
      { mercado: GOLS, acesas: ['defesas_firmes'], ...semContexto },
      COMO_O_RESUMO,
    );

    expect(slugs(itens)).toEqual(['defesas_firmes']);
  });

  it('ignora slug que não existe no catálogo daquele mercado', () => {
    const itens = premissasAcesasDaLeitura(
      { mercado: GOLS, acesas: ['nao_existe', 'defesas_firmes'], ...semContexto },
      COMO_O_RESUMO,
    );

    expect(slugs(itens)).toEqual(['defesas_firmes']);
  });

  // A diferença que existe hoje entre as duas telas, e que o #334 dissolve.
  describe('premissa de peso zero', () => {
    const acesas = ['ambos_vazam', 'ritmo_alto', 'defesas_firmes'];

    it('entra quando a tela pede, como o resumo do jogo faz', () => {
      const itens = premissasAcesasDaLeitura({ mercado: GOLS, acesas, ...semContexto }, COMO_O_RESUMO);
      expect(slugs(itens)).toContain('ambos_vazam');
    });

    it('fica de fora quando a tela não pede, como o painel da lista faz', () => {
      const itens = premissasAcesasDaLeitura({ mercado: GOLS, acesas, ...semContexto }, COMO_O_PAINEL);
      expect(slugs(itens)).toEqual(['defesas_firmes']);
    });
  });

  describe('evidência', () => {
    it('vem nula quando não há número nem histórico', () => {
      const [item] = premissasAcesasDaLeitura(
        { mercado: GOLS, acesas: ['defesas_firmes'], ...semContexto },
        COMO_O_RESUMO,
      );
      expect(item.evidencia).toBeNull();
    });

    // Sem número do jogo, a evidência cai no histórico do time. Isto é sempre
    // tentado, e não uma opção: quem não a quer passa histórico vazio, e aí ela
    // é nula de qualquer jeito. A primeira versão deste teste passava histórico
    // VAZIO e afirmava que "não caía" — passaria com a opção ligada ou
    // desligada, e não testava nada.
    it('cai no histórico do time quando não há número do jogo', () => {
      const jogo = (side: 'home' | 'away', xg: number) =>
        ({
          side,
          em_casa: side === 'home',
          xg,
          xg_contra: null,
          team_name: side === 'home' ? 'Casa' : 'Fora',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any;

      const [item] = premissasAcesasDaLeitura(
        {
          mercado: GOLS,
          acesas: ['xg_baixo_combinado'],
          numeros: undefined,
          historico: [jogo('home', 0.5), jogo('home', 0.5), jogo('away', 0.6), jogo('away', 0.6)],
          lado: 'home',
          linha: null,
        },
        COMO_O_RESUMO,
      );

      expect(item.evidencia).not.toBeNull();
      expect(item.evidencia?.texto).toContain('gols esperados');
    });

    it('com histórico vazio, a evidência segue nula', () => {
      const [item] = premissasAcesasDaLeitura(
        {
          mercado: GOLS,
          acesas: ['xg_baixo_combinado'],
          numeros: undefined,
          historico: [],
          lado: 'home',
          linha: null,
        },
        COMO_O_RESUMO,
      );
      expect(item.evidencia).toBeNull();
    });
  });

  it('o item devolve a premissa inteira, para a tela decidir como escrever', () => {
    const [item] = premissasAcesasDaLeitura(
      { mercado: GOLS, acesas: ['defesas_firmes'], ...semContexto },
      COMO_O_RESUMO,
    );

    expect(item.premissa.slug).toBe('defesas_firmes');
    expect(item.premissa.label).toBe('Defesas firmes dos dois lados');
  });
});
