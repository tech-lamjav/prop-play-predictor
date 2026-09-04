import { afterEach, describe, expect, it, vi } from 'vitest';
import { alinharAbaixoDoCabecalho } from './rolagem';

// ============================================================================
// O elemento sobe até encostar no cabeçalho — nem mais, nem menos
// ============================================================================
// A conta tem três partes que erram sozinhas se alguém mexer sem olhar:
//
//   1. a altura do cabeçalho é MEDIDA, porque muda entre celular e desktop;
//   2. o `top` dele entra na soma, porque a barra nem sempre está colada no
//      zero — com a faixa de ambiente local por cima, ela começa 24px abaixo;
//   3. a rolagem acontece DEPOIS da pintura, senão o conteúdo que acabou de
//      abrir ainda não tem altura e o destino sai errado.
//
// Nenhuma delas aparece na tela quando quebra: o que aparece é o título da
// premissa escondido atrás da barra, que é o defeito que isto veio consertar.
// ============================================================================

function cabecalho(altura: number, top = 0): HTMLElement {
  const nav = document.createElement('nav');
  nav.getBoundingClientRect = () => ({ height: altura, top, bottom: top + altura, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) });
  document.body.appendChild(nav);
  return nav;
}

function elementoEm(top: number): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ height: 0, top, bottom: top, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) });
  document.body.appendChild(el);
  return el;
}

/** Executa o que foi agendado para o quadro seguinte. */
function pintaOQuadro() {
  const agendado = vi.mocked(window.requestAnimationFrame).mock.calls.at(-1)?.[0];
  agendado?.(0);
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('alinharAbaixoDoCabecalho', () => {
  it('desconta a altura do cabeçalho da posição de destino', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('scrollY', 1000);
    cabecalho(95);

    alinharAbaixoDoCabecalho(elementoEm(400));
    pintaOQuadro();

    // 1000 de rolagem + 400 do elemento − 95 do cabeçalho − 8 de respiro.
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 1297 }));
  });

  it('soma o deslocamento do cabeçalho quando ele não está colado no topo', () => {
    // É o caso da faixa de ambiente local: a barra começa 24px abaixo, e sem
    // isso o título da premissa termina escondido atrás dela.
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('scrollY', 0);
    cabecalho(95, 24);

    alinharAbaixoDoCabecalho(elementoEm(400));
    pintaOQuadro();

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 400 - 95 - 24 - 8 }));
  });

  it('nunca rola para antes do começo da página', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('scrollY', 0);
    cabecalho(95);

    alinharAbaixoDoCabecalho(elementoEm(10));
    pintaOQuadro();

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });

  it('não rola no mesmo quadro do clique', () => {
    // O conteúdo que abriu ainda não tem altura, e o card que fecha acima muda
    // a página inteira de lugar. Medir agora é medir o layout velho.
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    cabecalho(95);

    alinharAbaixoDoCabecalho(elementoEm(400));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('sem elemento, não faz nada', () => {
    const raf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);

    alinharAbaixoDoCabecalho(null);

    expect(raf).not.toHaveBeenCalled();
  });

  it('quem pediu menos movimento no sistema rola sem animação', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('scrollY', 0);
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    cabecalho(95);

    alinharAbaixoDoCabecalho(elementoEm(400));
    pintaOQuadro();

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
  });
});
