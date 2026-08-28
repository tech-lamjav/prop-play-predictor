import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_RETURN_FALLBACK,
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
