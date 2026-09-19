import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ACESSO_ANONIMO, useFaixaDeAcesso } from './use-faixa-de-acesso';
import type { FutebolAccess } from '@/services/futebol-data.service';

// ============================================================================
// A faixa de acesso decide o espaço dela NA PRIMEIRA PINTURA
// ============================================================================
// Ela nascia depois que o `get_futebol_access` respondia, e ao nascer empurrava
// o raio-x, o destaque e os cartões para baixo: 0,060 de CLS medido na home,
// em cima de quem já estava lendo.
//
// Esperar só a sessão do navegador não resolveu — são ~460ms entre a página
// pintar e a sessão resolver, e o empurrão acontecia dentro dessa janela. A
// saída é não perguntar: a resposta de ontem fica guardada, e a de hoje é quase
// sempre igual.
// ============================================================================

const assinante: FutebolAccess = { ...ACESSO_ANONIMO, state: 'subscribed', unlocked: true };
const expirado: FutebolAccess = { ...ACESSO_ANONIMO, state: 'expired' };
const emTeste: FutebolAccess = { ...ACESSO_ANONIMO, state: 'trial', unlocked: true, hours_left: 20 };

describe('useFaixaDeAcesso', () => {
  beforeEach(() => localStorage.clear());

  it('devolve a resposta de verdade assim que ela chega', () => {
    const { result } = renderHook(() => useFaixaDeAcesso(assinante));
    expect(result.current).toBe(assinante);
  });

  // Sem memória também não há sessão — as duas moram no mesmo armazenamento.
  // Então "primeira visita" não é chute: é a definição de visitante anônimo.
  it('sem nada guardado, mostra o convite', () => {
    const { result } = renderHook(() => useFaixaDeAcesso(undefined));
    expect(result.current).toEqual(ACESSO_ANONIMO);
  });

  it('depois de ver um assinante, a próxima visita já não reserva a faixa', () => {
    renderHook(() => useFaixaDeAcesso(assinante));
    const { result } = renderHook(() => useFaixaDeAcesso(undefined));
    expect(result.current).toBeUndefined();
  });

  // Quem está em teste também não vê faixa — o chip do cabeçalho cuida disso.
  it('teste em dia é lembrado como "não mostra"', () => {
    renderHook(() => useFaixaDeAcesso(emTeste));
    const { result } = renderHook(() => useFaixaDeAcesso(undefined));
    expect(result.current).toBeUndefined();
  });

  it('depois de ver um expirado, a faixa volta a ser reservada', () => {
    renderHook(() => useFaixaDeAcesso(expirado));
    const { result } = renderHook(() => useFaixaDeAcesso(undefined));
    expect(result.current).toEqual(ACESSO_ANONIMO);
  });

  // A memória é lida UMA vez, na montagem. Se a leitura acompanhasse a escrita,
  // a faixa poderia sumir no meio da visita — que é o empurrão de volta, ao
  // contrário.
  it('a resposta que chega no meio da visita não tira a faixa da tela sozinha', () => {
    const { result, rerender } = renderHook(
      ({ a }: { a: FutebolAccess | undefined }) => useFaixaDeAcesso(a),
      { initialProps: { a: undefined as FutebolAccess | undefined } },
    );
    expect(result.current).toEqual(ACESSO_ANONIMO);
    rerender({ a: assinante });
    // Agora a resposta manda, e ela é quem esconde — não a memória.
    expect(result.current).toBe(assinante);
  });
});
