import { describe, expect, it, vi } from 'vitest';
import { ehCliqueSimples, interceptarCliqueSimples } from './navegacao-por-link';

// ============================================================================
// Clique do meio abre em nova aba (issue #341)
// ============================================================================
// O módulo navegava com `<button onClick={() => navigate(...)}>`. Botão não é
// link: o navegador não tem destino nenhum para abrir, então clique do meio,
// Ctrl+clique e "abrir em nova aba" do botão direito não faziam nada.
//
// A troca por `<Link>` resolve isso de graça, porque o comportamento é do
// navegador e não nosso. Sobra um caso: a linha da lista de Jogos, onde o
// clique simples deve abrir o PAINEL (mesma página) e o clique do meio deve
// abrir a TELA DO JOGO em outra aba. Para isso o `href` aponta para o jogo e
// interceptamos apenas o clique simples.
//
// Decisão de produto (02/09/2026): clique simples NUNCA abre aba nova.
// ============================================================================

const clique = (over: Partial<Parameters<typeof ehCliqueSimples>[0]> = {}) => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...over,
});

describe('ehCliqueSimples', () => {
  it('o clique esquerdo puro é nosso', () => {
    expect(ehCliqueSimples(clique())).toBe(true);
  });

  // Cada modificador é uma intenção EXPLÍCITA do usuário sobre onde abrir.
  // Interceptar qualquer um deles é desobedecer um pedido claro.
  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
    ['Shift', { shiftKey: true }],
    ['Alt', { altKey: true }],
  ])('%s + clique é do navegador, não nosso', (_nome, mod) => {
    expect(ehCliqueSimples(clique(mod))).toBe(false);
  });

  it.each([
    ['do meio', 1],
    ['direito', 2],
  ])('o botão %s é do navegador', (_nome, button) => {
    expect(ehCliqueSimples(clique({ button }))).toBe(false);
  });
});

describe('interceptarCliqueSimples', () => {
  it('no clique simples, segura o link e roda a ação', () => {
    const acao = vi.fn();
    const preventDefault = vi.fn();
    interceptarCliqueSimples(acao)({ ...clique(), preventDefault } as never);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(acao).toHaveBeenCalledOnce();
  });

  it('no clique do meio, não faz nada — o navegador abre o href', () => {
    // O ponto inteiro do recurso. Se `preventDefault` fosse chamado aqui, a aba
    // nova não abriria, e se a ação rodasse, o painel abriria na aba de trás
    // sem ninguém ter pedido.
    const acao = vi.fn();
    const preventDefault = vi.fn();
    interceptarCliqueSimples(acao)({ ...clique({ button: 1 }), preventDefault } as never);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(acao).not.toHaveBeenCalled();
  });

  it('no Ctrl + clique, também deixa passar', () => {
    const acao = vi.fn();
    const preventDefault = vi.fn();
    interceptarCliqueSimples(acao)({ ...clique({ ctrlKey: true }), preventDefault } as never);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(acao).not.toHaveBeenCalled();
  });
});
