import { describe, expect, it } from 'vitest';
import { getRedirectTarget } from './post-login';
import { onboardingFrom, ONBOARDING_SRC_LP_FUTEBOL } from '@/utils/onboarding-return';

// Esta é a METADE QUE ENTREGA o destino. A outra metade — o onboarding, que o
// recebe e obedece — está coberta em utils/onboarding-return.test.ts e em
// pages/Onboarding.test.tsx. Sem os testes daqui, quebrar a entrega deixava
// tudo verde e a pessoa voltava calada para o hub.
describe('getRedirectTarget', () => {
  it('sem origem declarada, usa o destino padrão do chamador', () => {
    expect(getRedirectTarget(null, '/onboarding?src=signup')).toBe('/onboarding?src=signup');
    expect(getRedirectTarget(undefined, '/inicio')).toBe('/inicio');
    expect(getRedirectTarget({}, '/inicio')).toBe('/inicio');
  });

  it('a origem declarada vence o destino padrão', () => {
    expect(getRedirectTarget({ from: { pathname: '/bolao' } }, '/inicio')).toBe('/bolao');
  });

  it('CARREGA A QUERY JUNTO — é nela que viajam a origem e o destino', () => {
    // Se algum dia isto devolver só o pathname, a landing do futebol perde o
    // destino no cadastro e a pessoa termina o onboarding no hub.
    expect(
      getRedirectTarget({ from: { pathname: '/onboarding', search: '?src=lp-futebol&return=%2Ffutebol' } }, '/inicio'),
    ).toBe('/onboarding?src=lp-futebol&return=%2Ffutebol');
  });

  it('o recado que a landing do futebol monta chega inteiro do outro lado', () => {
    const from = onboardingFrom(ONBOARDING_SRC_LP_FUTEBOL, '/futebol');
    expect(getRedirectTarget({ from }, '/inicio')).toBe('/onboarding?src=lp-futebol&return=%2Ffutebol');
  });

  it('recusa destino externo e cai no padrão', () => {
    expect(getRedirectTarget({ from: { pathname: '//evil.com' } }, '/inicio')).toBe('/inicio');
    expect(getRedirectTarget({ from: { pathname: 'https://evil.com' } }, '/inicio')).toBe('/inicio');
  });
});
