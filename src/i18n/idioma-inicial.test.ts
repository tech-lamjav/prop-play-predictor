import { describe, expect, it } from 'vitest';
import { idiomaInicial } from './idioma-inicial';
import { IDIOMA_PADRAO } from './idiomas';

// ============================================================================
// Qual idioma o site abre (#536)
// ============================================================================
// Esta é a função que decide, e ela é PURA de propósito: não lê armazenamento,
// não lê `navigator`, não toca no i18next. Quem tem esses efeitos passa os
// valores para cá. É o que permite testar a regra sem navegador e sem tela.
//
// A ordem é: o que a pessoa escolheu ganha do que o navegador dela diz, que
// ganha do padrão da casa. E ela tem uma consequência que vale escrever: NÃO
// existe redirecionamento por idioma presumido. O Google desaconselha
// explicitamente, e além disso não há para onde redirecionar — o produto não
// tem prefixo de caminho por idioma. O que esta função decide é só com que
// idioma a primeira pintura acontece.
// ============================================================================

describe('idiomaInicial · a escolha da pessoa ganha de tudo', () => {
  it('usa o que foi guardado, mesmo contra o navegador', () => {
    expect(idiomaInicial('es', ['pt-BR', 'pt'])).toBe('es');
    expect(idiomaInicial('pt', ['es-PE', 'es'])).toBe('pt');
  });

  it('aceita o guardado em qualquer caixa', () => {
    // Um valor gravado por uma versão antiga, ou por um humano curioso no
    // console, não deveria derrubar a escolha por causa de maiúscula.
    expect(idiomaInicial('ES', ['pt-BR'])).toBe('es');
  });
});

describe('idiomaInicial · sem escolha guardada, o navegador fala', () => {
  it('entende o idioma com região', () => {
    // É o caso real: o navegador de um peruano diz `es-PE`, e não `es`.
    expect(idiomaInicial(null, ['es-PE', 'es', 'en-US'])).toBe('es');
    expect(idiomaInicial(null, ['es-AR'])).toBe('es');
    expect(idiomaInicial(null, ['es-MX'])).toBe('es');
    expect(idiomaInicial(null, ['es-CL'])).toBe('es');
  });

  it('respeita a ORDEM da lista do navegador', () => {
    // A lista é uma preferência ordenada, não um conjunto. Quem põe português
    // na frente quer português, mesmo tendo espanhol depois.
    expect(idiomaInicial(null, ['pt-BR', 'es-PE'])).toBe('pt');
    expect(idiomaInicial(null, ['es-PE', 'pt-BR'])).toBe('es');
  });

  it('pula idioma que o produto não fala em vez de desistir', () => {
    // Um navegador em inglês com espanhol em segundo lugar deve abrir em
    // espanhol, e não cair no padrão só porque o primeiro item não serve.
    expect(idiomaInicial(null, ['en-US', 'es-PE'])).toBe('es');
    expect(idiomaInicial(null, ['fr-FR', 'de-DE', 'es'])).toBe('es');
  });
});

describe('idiomaInicial · quando não há sinal nenhum', () => {
  it('cai no padrão da casa', () => {
    expect(idiomaInicial(null, [])).toBe(IDIOMA_PADRAO);
    expect(idiomaInicial(null, undefined)).toBe(IDIOMA_PADRAO);
    expect(idiomaInicial(undefined, undefined)).toBe(IDIOMA_PADRAO);
  });

  it('cai no padrão quando o navegador só fala o que não falamos', () => {
    expect(idiomaInicial(null, ['en-US', 'fr-FR'])).toBe(IDIOMA_PADRAO);
  });
});

describe('idiomaInicial · lixo guardado não derruba o navegador', () => {
  it('trata valor desconhecido como ausência, e não como escolha', () => {
    // Uma versão antiga gravou `en`, que o produto não fala mais. Se isso
    // vencesse, um peruano com navegador em espanhol abriria em português por
    // causa de um resto de outra época. Valor que não reconhecemos é ausência.
    expect(idiomaInicial('en', ['es-PE'])).toBe('es');
    expect(idiomaInicial('', ['es-PE'])).toBe('es');
    expect(idiomaInicial('klingon', ['es-PE'])).toBe('es');
  });

  it('com lixo guardado E navegador inútil, ainda cai no padrão', () => {
    expect(idiomaInicial('en', ['en-US'])).toBe(IDIOMA_PADRAO);
  });
});
