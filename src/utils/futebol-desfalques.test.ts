import { describe, expect, it } from 'vitest';
import { estaEmDuvida, motivoDoDesfalque } from './futebol-desfalques';

describe('o motivo do desfalque em português', () => {
  it('traduz a lesão dizendo QUAL é', () => {
    // O tradutor antigo colapsava tudo em "Lesão" com um `/injury/i`. Perder a
    // parte do corpo custa: quem lê pesa diferente uma panturrilha e um joelho.
    expect(motivoDoDesfalque('Muscle Injury')).toBe('Lesão muscular');
    expect(motivoDoDesfalque('Knee Injury')).toBe('Lesão no joelho');
    expect(motivoDoDesfalque('Hamstring Injury')).toBe('Lesão na posterior da coxa');
  });

  it('cartão vira suspensão, que é o que muda para quem aposta', () => {
    expect(motivoDoDesfalque('Yellow Cards')).toBe('Suspenso');
    expect(motivoDoDesfalque('Red Card')).toBe('Suspenso');
  });

  it('cobre os motivos que não são lesão', () => {
    expect(motivoDoDesfalque('Inactive')).toBe('Inativo');
    expect(motivoDoDesfalque('Illness')).toBe('Doença');
    expect(motivoDoDesfalque('Health problems')).toBe('Problema de saúde');
    expect(motivoDoDesfalque('Broken Leg')).toBe('Perna quebrada');
  });

  it('lesão desconhecida ainda diz que é lesão', () => {
    // Rede de segurança para a parte do corpo que a fonte inventar amanhã.
    expect(motivoDoDesfalque('Elbow Injury')).toBe('Lesão');
  });

  it('motivo que não conhecemos sai como veio, e não vazio', () => {
    // Some ou inventa é pior: cru, ao menos dá para procurar e traduzir depois.
    expect(motivoDoDesfalque('Something New')).toBe('Something New');
  });

  it('sem motivo, não inventa um', () => {
    expect(motivoDoDesfalque(null)).toBeNull();
    expect(motivoDoDesfalque('')).toBeNull();
  });
});

describe('dúvida contra fora', () => {
  it('só "Questionable" é dúvida', () => {
    expect(estaEmDuvida('Questionable')).toBe(true);
  });

  it('o resto é fora, inclusive o que a fonte mandar de novo', () => {
    // Os dois únicos valores na base hoje são "Missing Fixture" e "Questionable".
    // O desconhecido cai em FORA de propósito: anunciar dúvida sobre quem está
    // fora é o erro que custa, e não o contrário.
    expect(estaEmDuvida('Missing Fixture')).toBe(false);
    expect(estaEmDuvida('Algo Novo')).toBe(false);
    expect(estaEmDuvida(null)).toBe(false);
  });
});
