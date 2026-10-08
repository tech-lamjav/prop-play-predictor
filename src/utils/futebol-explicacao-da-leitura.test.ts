import { describe, expect, it } from 'vitest';
import { COPY_DO_ROTULO_DA_EXPLICACAO, explicacaoDaLeitura } from './futebol-motivos';

// ============================================================================
// Uma resposta só para "por que essa aposta" (#334)
// ============================================================================
// Antes, o resumo do jogo e o painel da lista concluíam motivo sozinhos, a
// partir das premissas acesas. A home e a bancada liam o contrato do backend.
// Duas respostas para a mesma pergunta, que hoje concordam por acaso e param de
// concordar na virada — o contrato muda e o caminho das premissas não.
//
// Agora: leitura COM preço lê o contrato; leitura SEM preço continua nas
// premissas, mas com nome próprio, porque sem preço não há aposta a favor de
// quê. Ver o glossário: motivo · porquê · o que o jogo mostra.
//
// ⚠️ O `rotulo` é um IDENTIFICADOR (`porque` / `oQueOJogoMostra`), e não a
// frase (#544). Era a frase, e o painel do jogo decidia o sufixo comparando
// contra ela — traduzir o texto quebraria a tela em espanhol sem nenhum teste
// acusar, porque em teste a interface está em português. A frase de cada rótulo
// continua pinada, num teste próprio no fim deste arquivo.
// ============================================================================

const GOLS = 'goals_over_under';

const candidato = (acesas: string[], linha: number | null = 2.5) =>
  ({
    market: GOLS,
    outcome: 'Over',
    line_value: linha,
    pts_premissas: 20,
    penalidades_pts: 0,
    acesas,
    apagadas: [],
    penalidades: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

const linhaDoContrato = (favor: string[], contra: string[] = [], linha: number | null = 2.5) =>
  ({
    market: GOLS,
    outcome: 'Over',
    line_value: linha,
    score: 55,
    favor: favor.map((id) => ({ id, tipo: 'premissa' })),
    contra: contra.map((id) => ({ id, tipo: 'premissa' })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

const semContexto = { numeros: undefined, historico: undefined, lado: null };
const opcoes = { max: 3, incluirPesoZero: false, maxContra: 2 };

const slugs = (itens: { premissa: { slug: string } }[]) => itens.map((i) => i.premissa.slug);

describe('explicacaoDaLeitura', () => {
  describe('leitura COM preço lê o contrato', () => {
    it('os itens saem do lado A favor do contrato, e não das premissas acesas', () => {
      const r = explicacaoDaLeitura(
        {
          mercado: GOLS,
          candidato: candidato(['ataques_fracos']), // acesa, mas o contrato não lista
          temPreco: true,
          contrato: [linhaDoContrato(['defesas_firmes', 'xg_baixo_combinado'])],
          ...semContexto,
        },
        opcoes,
      );

      expect(slugs(r.itens)).toEqual(['defesas_firmes', 'xg_baixo_combinado']);
      expect(slugs(r.itens)).not.toContain('ataques_fracos');
    });

    it('o rótulo é "Por quê"', () => {
      const r = explicacaoDaLeitura(
        {
          mercado: GOLS,
          candidato: candidato(['defesas_firmes']),
          temPreco: true,
          contrato: [linhaDoContrato(['defesas_firmes'])],
          ...semContexto,
        },
        opcoes,
      );
      expect(r.rotulo).toBe('porque');
    });

    // O contrato antigo ainda manda preço junto do cenário, e ele continua no ar
    // até a virada. Componente de preço não é motivo.
    it('componente de preço presente no contrato não vira motivo', () => {
      const contrato = [
        {
          market: GOLS,
          outcome: 'Over',
          line_value: 2.5,
          score: 55,
          favor: [
            { id: 'defesas_firmes', tipo: 'premissa' },
            { id: 'valor_de_mercado', tipo: 'componente_score' },
          ],
          contra: [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ];

      const r = explicacaoDaLeitura(
        { mercado: GOLS, candidato: candidato([]), temPreco: true, contrato, ...semContexto },
        opcoes,
      );

      expect(slugs(r.itens)).toEqual(['defesas_firmes']);
    });

    it('o contra vem do contrato, e não de negar premissa que não acendeu', () => {
      const r = explicacaoDaLeitura(
        {
          mercado: GOLS,
          candidato: candidato(['defesas_vazaveis']),
          temPreco: true,
          contrato: [linhaDoContrato(['defesas_vazaveis'], ['ataque_combinado'])],
          ...semContexto,
        },
        opcoes,
      );

      expect(slugs(r.contra)).toEqual(['ataque_combinado']);
    });

    // Degradação deliberada. O contrato CHEGOU e não tem linha para esta saída:
    // some com o bloco seria pior, porque antes desta mudança a tela sempre
    // tinha o que dizer. Ela cai nas premissas acesas com o rótulo mais fraco —
    // e é o rótulo que impede isso de virar motivo inventado.
    it('contrato sem a linha desta saída cai no rótulo fraco, e não inventa motivo', () => {
      const r = explicacaoDaLeitura(
        {
          mercado: GOLS,
          candidato: candidato(['defesas_firmes'], 3.5),
          temPreco: true,
          contrato: [linhaDoContrato(['ataque_combinado'], ['xg_baixo_combinado'], 2.5)],
          ...semContexto,
        },
        opcoes,
      );

      expect(r.rotulo).toBe('oQueOJogoMostra');
      expect(slugs(r.itens)).toEqual(['defesas_firmes']);
      // Nada do contrato de outra linha vaza para cá.
      expect(slugs(r.itens)).not.toContain('ataque_combinado');
      expect(r.contra).toEqual([]);
    });

    it('contrato ainda não chegou não é o mesmo que contrato sem motivo', () => {
      const r = explicacaoDaLeitura(
        {
          mercado: GOLS,
          candidato: candidato(['defesas_firmes']),
          temPreco: true,
          contrato: undefined,
          ...semContexto,
        },
        opcoes,
      );

      expect(r.itens).toEqual([]);
      expect(r.rotulo).toBe('porque');
    });
  });

  describe('leitura SEM preço continua nas premissas', () => {
    it('os itens saem das premissas acesas', () => {
      const r = explicacaoDaLeitura(
        {
          mercado: GOLS,
          candidato: candidato(['defesas_firmes', 'xg_baixo_combinado']),
          temPreco: false,
          contrato: [linhaDoContrato(['ataque_combinado'])],
          ...semContexto,
        },
        opcoes,
      );

      expect(slugs(r.itens)).toEqual(['defesas_firmes', 'xg_baixo_combinado']);
    });

    it('o rótulo tem nome próprio, porque sem preço não há aposta a favor de quê', () => {
      const r = explicacaoDaLeitura(
        {
          mercado: GOLS,
          candidato: candidato(['defesas_firmes'], null),
          temPreco: false,
          contrato: undefined,
          ...semContexto,
        },
        opcoes,
      );

      expect(r.rotulo).toBe('oQueOJogoMostra');
    });

    it('não tem contra: sem preço, não há o que pesar contra', () => {
      const r = explicacaoDaLeitura(
        {
          mercado: GOLS,
          candidato: candidato(['defesas_firmes']),
          temPreco: false,
          contrato: [linhaDoContrato(['defesas_firmes'], ['ataque_combinado'])],
          ...semContexto,
        },
        opcoes,
      );

      expect(r.contra).toEqual([]);
    });
  });

  describe('regras que valem nos dois caminhos', () => {
    it('premissa de peso zero fica de fora quando a tela não a pede', () => {
      const r = explicacaoDaLeitura(
        {
          mercado: GOLS,
          candidato: candidato([]),
          temPreco: true,
          contrato: [linhaDoContrato(['ritmo_alto', 'defesas_firmes'])],
          ...semContexto,
        },
        opcoes,
      );

      expect(slugs(r.itens)).toEqual(['defesas_firmes']);
    });

    it('respeita o corte pedido pela tela', () => {
      const r = explicacaoDaLeitura(
        {
          mercado: GOLS,
          candidato: candidato([]),
          temPreco: true,
          contrato: [
            linhaDoContrato([
              'defesas_firmes',
              'defesas_vazaveis',
              'ataque_combinado',
              'xg_baixo_combinado',
            ]),
          ],
          ...semContexto,
        },
        { max: 2, incluirPesoZero: false, maxContra: 2 },
      );

      expect(r.itens).toHaveLength(2);
    });

    it('ordena por peso, para o item mais forte aparecer primeiro', () => {
      const r = explicacaoDaLeitura(
        {
          mercado: GOLS,
          candidato: candidato([]),
          temPreco: true,
          contrato: [linhaDoContrato(['ataques_fracos', 'defesas_firmes'])],
          ...semContexto,
        },
        opcoes,
      );

      expect(slugs(r.itens)).toEqual(['defesas_firmes', 'ataques_fracos']);
    });
  });
});

describe('a linha casa com folga, porque ela vem em float', () => {
  // A home comparava a linha do contrato com `===` estrito. Linha vem em float,
  // e 2.5 de uma fonte não é necessariamente 2.5 da outra: a tela podia não
  // casar e mostrar o texto de fallback em vez dos motivos. Era bug vivo até
  // ela passar a usar esta função, que compara com folga.
  it('casa apesar do resíduo de ponto flutuante', () => {
    const r = explicacaoDaLeitura(
      {
        mercado: GOLS,
        candidato: candidato(['defesas_firmes'], 0.1 + 0.2), // 0.30000000000000004
        temPreco: true,
        contrato: [linhaDoContrato(['ataque_combinado'], [], 0.3)],
        ...semContexto,
      },
      opcoes,
    );

    expect(r.rotulo).toBe('porque');
    expect(slugs(r.itens)).toEqual(['ataque_combinado']);
  });

  it('não casa linhas que são de fato diferentes', () => {
    const r = explicacaoDaLeitura(
      {
        mercado: GOLS,
        candidato: candidato(['defesas_firmes'], 2.5),
        temPreco: true,
        contrato: [linhaDoContrato(['ataque_combinado'], [], 3.5)],
        ...semContexto,
      },
      opcoes,
    );

    expect(r.rotulo).toBe('oQueOJogoMostra');
    expect(slugs(r.itens)).toEqual(['defesas_firmes']);
  });
});

describe('a frase de cada rótulo é a do glossário', () => {
  // O identificador é o que atravessa o código; a FRASE é vocabulário de
  // produto, e continua pinada aqui para uma reescrita descuidada não passar
  // em silêncio só porque o resto do arquivo compara identificadores.
  it('porquê e o que o jogo mostra, escritos como o glossário escreve', () => {
    expect(COPY_DO_ROTULO_DA_EXPLICACAO).toEqual({
      porque: 'Por quê',
      oQueOJogoMostra: 'O que o jogo mostra',
    });
  });
});
