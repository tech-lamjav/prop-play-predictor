import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  FRACAO_VISIVEL,
  PERMANENCIA_MS,
  jaFoiImpressa,
  reiniciarImpressoes,
  useImpressaoDeOportunidade,
} from './use-impressao-de-oportunidade';

// ============================================================================
// Impressão é "foi exibida", não "foi renderizada"
// ============================================================================
// A lista de oportunidades monta dezenas de linhas de uma vez, e a maioria
// nasce muito abaixo da dobra. Contar render como impressão infla o
// denominador do funil: a taxa de abertura despenca quando alguém mexe na
// paginação, e não quando o produto piora.
//
// A régua tem DOIS lados, e os dois precisam de teste. Só área não basta —
// rolagem rápida atravessa a lista inteira e marcaria tudo. Só tempo não basta
// — um cartão parado logo abaixo da dobra ficaria "visível" para sempre.
// ============================================================================

/** Dublê do observador: o jsdom não implementa `IntersectionObserver`. */
class ObservadorFalso {
  static ultimo: ObservadorFalso | null = null;
  readonly observados: Element[] = [];
  desconectado = false;

  constructor(
    private readonly callback: IntersectionObserverCallback,
    readonly opcoes?: IntersectionObserverInit,
  ) {
    ObservadorFalso.ultimo = this;
  }

  observe(el: Element) {
    this.observados.push(el);
  }
  unobserve() {}
  disconnect() {
    this.desconectado = true;
  }

  /** Simula o elemento entrando (ou saindo) da tela. */
  emitir(fracao: number) {
    this.callback(
      [
        {
          isIntersecting: fracao > 0,
          intersectionRatio: fracao,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }
}

function montar(chave: string, aoAparecer: () => void) {
  return renderHook(() =>
    useImpressaoDeOportunidade({ chave, ativo: true, aoAparecer }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  reiniciarImpressoes();
  ObservadorFalso.ultimo = null;
  vi.stubGlobal('IntersectionObserver', ObservadorFalso);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('a régua dos dois lados', () => {
  it('meio cartão por um segundo conta', () => {
    const aoAparecer = vi.fn();
    const { result } = montar('123|match_winner|Home|', aoAparecer);
    result.current(document.createElement('div'));

    ObservadorFalso.ultimo!.emitir(FRACAO_VISIVEL);
    expect(aoAparecer).not.toHaveBeenCalled();

    vi.advanceTimersByTime(PERMANENCIA_MS);
    expect(aoAparecer).toHaveBeenCalledTimes(1);
  });

  it('aparecer e sumir antes de um segundo NÃO conta', () => {
    // É a rolagem rápida: a pessoa passou por cima, não viu.
    const aoAparecer = vi.fn();
    const { result } = montar('123|match_winner|Home|', aoAparecer);
    result.current(document.createElement('div'));

    ObservadorFalso.ultimo!.emitir(FRACAO_VISIVEL);
    vi.advanceTimersByTime(PERMANENCIA_MS - 100);
    ObservadorFalso.ultimo!.emitir(0);
    vi.advanceTimersByTime(PERMANENCIA_MS);

    expect(aoAparecer).not.toHaveBeenCalled();
  });

  it('o cronômetro recomeça do zero na volta', () => {
    // Não acumula: 600ms agora mais 600ms daqui a pouco não são "um segundo
    // visto". Quem viu meio segundo duas vezes não leu o cartão.
    const aoAparecer = vi.fn();
    const { result } = montar('1|m|Home|', aoAparecer);
    result.current(document.createElement('div'));

    ObservadorFalso.ultimo!.emitir(FRACAO_VISIVEL);
    vi.advanceTimersByTime(600);
    ObservadorFalso.ultimo!.emitir(0);
    ObservadorFalso.ultimo!.emitir(FRACAO_VISIVEL);
    vi.advanceTimersByTime(600);

    expect(aoAparecer).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(aoAparecer).toHaveBeenCalledTimes(1);
  });

  it('observa no limiar de metade do cartão', () => {
    const { result } = montar('1|m|Home|', vi.fn());
    result.current(document.createElement('div'));

    expect(ObservadorFalso.ultimo!.opcoes?.threshold).toEqual([FRACAO_VISIVEL]);
  });
});

describe('uma impressão por oportunidade, por carregamento', () => {
  it('não conta duas vezes a mesma oportunidade', () => {
    // A lista tem versão de desktop e de celular no MESMO DOM. As duas podem
    // vencer o cronômetro, e sem a guarda a oportunidade contaria em dobro.
    const aoAparecer = vi.fn();
    const chave = '123|match_winner|Home|';

    const a = montar(chave, aoAparecer);
    a.result.current(document.createElement('div'));
    ObservadorFalso.ultimo!.emitir(FRACAO_VISIVEL);
    vi.advanceTimersByTime(PERMANENCIA_MS);

    const b = montar(chave, aoAparecer);
    b.result.current(document.createElement('div'));
    // O segundo nem chega a observar: a chave já está marcada.
    vi.advanceTimersByTime(PERMANENCIA_MS);

    expect(aoAparecer).toHaveBeenCalledTimes(1);
  });

  it('oportunidades diferentes contam cada uma', () => {
    const aoAparecer = vi.fn();

    const a = montar('1|m|Home|', aoAparecer);
    a.result.current(document.createElement('div'));
    ObservadorFalso.ultimo!.emitir(FRACAO_VISIVEL);
    vi.advanceTimersByTime(PERMANENCIA_MS);

    const b = montar('2|m|Away|', aoAparecer);
    b.result.current(document.createElement('div'));
    ObservadorFalso.ultimo!.emitir(FRACAO_VISIVEL);
    vi.advanceTimersByTime(PERMANENCIA_MS);

    expect(aoAparecer).toHaveBeenCalledTimes(2);
  });

  it('`reiniciarImpressoes` devolve a contagem — é o novo carregamento', () => {
    const aoAparecer = vi.fn();
    const chave = '1|m|Home|';

    const a = montar(chave, aoAparecer);
    a.result.current(document.createElement('div'));
    ObservadorFalso.ultimo!.emitir(FRACAO_VISIVEL);
    vi.advanceTimersByTime(PERMANENCIA_MS);
    expect(jaFoiImpressa(chave)).toBe(true);

    reiniciarImpressoes();
    expect(jaFoiImpressa(chave)).toBe(false);

    const b = montar(chave, aoAparecer);
    b.result.current(document.createElement('div'));
    ObservadorFalso.ultimo!.emitir(FRACAO_VISIVEL);
    vi.advanceTimersByTime(PERMANENCIA_MS);

    expect(aoAparecer).toHaveBeenCalledTimes(2);
  });
});

describe('quando não dá para saber', () => {
  it('sem `IntersectionObserver`, não conta e não quebra', () => {
    // Navegador antigo, ou o próprio jsdom sem o dublê. Inventar a impressão
    // aqui seria exatamente o defeito que este gancho existe para evitar.
    vi.unstubAllGlobals();
    vi.stubGlobal('IntersectionObserver', undefined);

    const aoAparecer = vi.fn();
    const { result } = montar('1|m|Home|', aoAparecer);

    expect(() => result.current(document.createElement('div'))).not.toThrow();
    vi.advanceTimersByTime(PERMANENCIA_MS * 3);
    expect(aoAparecer).not.toHaveBeenCalled();
  });

  it('elemento nulo não observa nada', () => {
    const { result } = montar('1|m|Home|', vi.fn());
    expect(() => result.current(null)).not.toThrow();
    expect(ObservadorFalso.ultimo).toBeNull();
  });

  it('inativo não observa: cartão bloqueado não é oportunidade exibida', () => {
    const aoAparecer = vi.fn();
    const { result } = renderHook(() =>
      useImpressaoDeOportunidade({ chave: '1|m|Home|', ativo: false, aoAparecer }),
    );
    result.current(document.createElement('div'));

    expect(ObservadorFalso.ultimo).toBeNull();
  });
});
