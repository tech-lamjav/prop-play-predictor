import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { ultimoJogoNoIdioma } from './ultimo-jogo';

// Um `t` de mentira que devolve a chave e os valores, para o teste não depender
// do catálogo carregado.
const t = ((chave: string, valores?: Record<string, unknown>) =>
  valores ? `${chave}:${JSON.stringify(valores)}` : chave) as unknown as TFunction<'nba'>;

describe('a frase do último jogo, que chega pronta do banco', () => {
  it('em espanhol, a forma medida vira a frase traduzida', () => {
    expect(ultimoJogoNoIdioma('Ultimo Jogo: 14 dias atras', 'es', t)).toBe(
      'jogador.ultimoJogoHaDias:{"count":14}',
    );
  });

  it('aceita com e sem acento, e o singular', () => {
    expect(ultimoJogoNoIdioma('Último jogo: 1 dia atrás', 'es', t)).toBe('jogador.ultimoJogoHaDias:{"count":1}');
  });

  it('em português devolve o texto do banco intocado', () => {
    // Regra da migração: em português nada muda.
    expect(ultimoJogoNoIdioma('Ultimo Jogo: 14 dias atras', 'pt', t)).toBe('Ultimo Jogo: 14 dias atras');
  });

  it('o que não reconhece volta como veio — nunca fica pior do que estava', () => {
    expect(ultimoJogoNoIdioma('Algo novo do pipeline', 'es', t)).toBe('Algo novo do pipeline');
  });

  it('vazio continua vazio', () => {
    expect(ultimoJogoNoIdioma('', 'es', t)).toBeNull();
    expect(ultimoJogoNoIdioma(null, 'es', t)).toBeNull();
  });
});
