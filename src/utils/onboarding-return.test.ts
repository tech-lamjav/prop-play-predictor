import { describe, expect, it } from 'vitest';
import {
  ehOrigemDeFutebol,
  ONBOARDING_RETURN_FALLBACK,
  ONBOARDING_SRC_LP_FUTEBOL,
  onboardingFrom,
  onboardingHref,
  resolveOnboardingReturn,
} from './onboarding-return';

describe('resolveOnboardingReturn', () => {
  it('aceita as rotas internas da lista', () => {
    expect(resolveOnboardingReturn('/futebol/oportunidades')).toBe('/futebol/oportunidades');
    expect(resolveOnboardingReturn('/settings')).toBe('/settings');
    expect(resolveOnboardingReturn('/inicio')).toBe('/inicio');
  });

  it('ignora barra final e espaços em volta', () => {
    expect(resolveOnboardingReturn('  /futebol/oportunidades/  ')).toBe('/futebol/oportunidades');
  });

  it('descarta query e hash antes de comparar', () => {
    expect(resolveOnboardingReturn('/futebol/oportunidades?dia=hoje#topo')).toBe('/futebol/oportunidades');
  });

  it('cai na rota segura quando não há destino', () => {
    expect(resolveOnboardingReturn(null)).toBe(ONBOARDING_RETURN_FALLBACK);
    expect(resolveOnboardingReturn(undefined)).toBe(ONBOARDING_RETURN_FALLBACK);
    expect(resolveOnboardingReturn('')).toBe(ONBOARDING_RETURN_FALLBACK);
  });

  it('recusa rota interna que não está na lista', () => {
    expect(resolveOnboardingReturn('/admin')).toBe(ONBOARDING_RETURN_FALLBACK);
    expect(resolveOnboardingReturn('/futebol/oportunidades/extra')).toBe(ONBOARDING_RETURN_FALLBACK);
  });

  it('recusa destino externo', () => {
    expect(resolveOnboardingReturn('https://evil.com')).toBe(ONBOARDING_RETURN_FALLBACK);
    expect(resolveOnboardingReturn('//evil.com')).toBe(ONBOARDING_RETURN_FALLBACK);
    expect(resolveOnboardingReturn('/\\evil.com')).toBe(ONBOARDING_RETURN_FALLBACK);
    expect(resolveOnboardingReturn('javascript:alert(1)')).toBe(ONBOARDING_RETURN_FALLBACK);
    expect(resolveOnboardingReturn('futebol/oportunidades')).toBe(ONBOARDING_RETURN_FALLBACK);
  });
});

describe('onboardingHref', () => {
  it('monta a rota existente com origem e retorno codificados', () => {
    expect(onboardingHref('alertas-futebol', '/futebol/oportunidades')).toBe(
      '/onboarding?src=alertas-futebol&return=%2Ffutebol%2Foportunidades',
    );
  });

  it('mantém o onboarding genérico quando não há retorno', () => {
    expect(onboardingHref('configuracoes')).toBe('/onboarding?src=configuracoes');
  });
});

describe('ehOrigemDeFutebol', () => {
  it('reconhece as três portas do futebol', () => {
    expect(ehOrigemDeFutebol('alertas-futebol')).toBe(true);
    expect(ehOrigemDeFutebol('lp-futebol')).toBe(true);
    expect(ehOrigemDeFutebol('gate-futebol')).toBe(true);
  });

  it('não reconhece origem de fora do futebol, nem ausência de origem', () => {
    expect(ehOrigemDeFutebol('signup')).toBe(false);
    expect(ehOrigemDeFutebol('configuracoes')).toBe(false);
    expect(ehOrigemDeFutebol(null)).toBe(false);
    expect(ehOrigemDeFutebol(undefined)).toBe(false);
    expect(ehOrigemDeFutebol('')).toBe(false);
  });
});

describe('onboardingFrom', () => {
  it('separa caminho e query, que é o formato do state.from do login', () => {
    // Literal cru de propósito: comparar com a constante que está sob teste
    // passaria verde mesmo se a rota mudasse.
    expect(onboardingFrom(ONBOARDING_SRC_LP_FUTEBOL, '/futebol')).toEqual({
      pathname: '/onboarding',
      search: '?src=lp-futebol&return=%2Ffutebol',
    });
  });

  it('sem retorno, leva só a origem', () => {
    expect(onboardingFrom('configuracoes')).toEqual({
      pathname: '/onboarding',
      search: '?src=configuracoes',
    });
  });

  // A garantia que importa: o destino que a landing manda tem que sobreviver à
  // lista fechada do onboarding. Se alguém tirar /futebol da lista, este teste
  // cai — e não a pessoa, calada, no hub.
  it('o destino que a landing do futebol manda sobrevive à lista permitida', () => {
    const { search } = onboardingFrom(ONBOARDING_SRC_LP_FUTEBOL, '/futebol');
    const enviado = new URLSearchParams(search).get('return');
    expect(resolveOnboardingReturn(enviado)).toBe('/futebol');
    expect(resolveOnboardingReturn(enviado)).not.toBe(ONBOARDING_RETURN_FALLBACK);
  });
});
