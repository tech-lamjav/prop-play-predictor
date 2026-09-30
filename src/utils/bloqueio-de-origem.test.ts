import { describe, expect, it } from 'vitest';
import {
  ROTAS_SEMPRE_ABERTAS,
  queMostrar,
  rotaSempreAberta,
  type EstadoDaPorta,
} from './bloqueio-de-origem';

/**
 * O que este arquivo protege: a tela que aparece na frente do produto inteiro.
 *
 * Dois erros, custos bem diferentes. Mostrar o produto a quem devia ser barrado
 * desfaz a restrição que sustenta o enquadramento fiscal. Mostrar o bloqueio a
 * quem devia entrar derruba um cliente pagante — e o caso mais provável disso
 * não é erro de país, é a tela decidir antes de ter resposta.
 */

const base: EstadoDaPorta = { veredito: 'entrou', pathname: '/futebol' };
const com = (mudanca: Partial<EstadoDaPorta>): EstadoDaPorta => ({ ...base, ...mudanca });

describe('rotaSempreAberta', () => {
  it('reconhece as rotas da lista', () => {
    for (const rota of ROTAS_SEMPRE_ABERTAS) {
      expect(rotaSempreAberta(rota)).toBe(true);
    }
  });

  it('reconhece uma rota filha', () => {
    expect(rotaSempreAberta('/termos/antigos')).toBe(true);
  });

  it('não confunde uma rota que só começa igual', () => {
    // Sem a comparação por segmento, `/termos-de-parceria` passaria por filha
    // de `/termos` — e uma tela do produto ficaria aberta para quem foi barrado.
    expect(rotaSempreAberta('/termos-de-parceria')).toBe(false);
    expect(rotaSempreAberta('/privacidade-total')).toBe(false);
  });

  it('não deixa o produto passar', () => {
    expect(rotaSempreAberta('/futebol')).toBe(false);
    expect(rotaSempreAberta('/')).toBe(false);
  });
});

describe('queMostrar', () => {
  it('mostra o produto para quem entrou', () => {
    expect(queMostrar(com({ veredito: 'entrou' }))).toBe('produto');
  });

  it('mostra o bloqueio para quem foi barrado', () => {
    expect(queMostrar(com({ veredito: 'barrado' }))).toBe('bloqueio');
  });

  it('mostra o produto enquanto não há resposta, e nunca bloqueia por antecipação', () => {
    // É o erro mais provável desta tela: decidir antes de saber. Bloquear por
    // antecipação poria a tela de bloqueio em cima de todo mundo a cada
    // carregamento, inclusive de quem está no Peru.
    //
    // E mostrar o produto — em vez de uma espera — é o que faz a chave
    // desligada não custar nada a ninguém: sem bloqueio ligado ninguém é
    // barrado nunca, e uma espera cobraria uma ida à rede para comprar nada.
    expect(queMostrar(com({ veredito: null }))).toBe('produto');
  });

  it('deixa Termos e Privacidade abertos mesmo para quem foi barrado', () => {
    // Quem foi barrado precisa poder ler o que mudou na relação dele com a
    // empresa. É o momento em que ele mais precisa desses dois documentos.
    expect(queMostrar(com({ veredito: 'barrado', pathname: '/termos' }))).toBe('produto');
    expect(queMostrar(com({ veredito: 'barrado', pathname: '/privacidade' }))).toBe('produto');
  });

  it('abre os documentos mesmo sem resposta do porteiro', () => {
    expect(queMostrar(com({ veredito: null, pathname: '/termos' }))).toBe('produto');
  });

  it('a rota não salva quem está no produto', () => {
    expect(queMostrar(com({ veredito: 'barrado', pathname: '/termos-de-parceria' }))).toBe(
      'bloqueio',
    );
  });
});
