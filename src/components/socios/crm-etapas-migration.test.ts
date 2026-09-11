import { describe, expect, it } from 'vitest';
import { lerMigration } from './crm-migration-de-teste';
import { ETAPAS } from './crm-vocabulario';

// ============================================================================
// O vocabulário do banco e o da tela não podem se separar
// ============================================================================
// A restrição vigente é a da migration 128, que substituiu a da 123. O guarda
// mora aqui e não lá justamente por isso: apontar para a restrição antiga
// deixaria o teste verde guardando um vocabulário aposentado.
// ============================================================================

const MIGRATION = lerMigration('20260911200000_128_crm_etapas_da_venda.sql');

describe('as etapas da venda', () => {
  it('a restrição do banco lista exatamente as etapas do glossário', () => {
    const restricao = MIGRATION.match(/check \(etapa in \(([^)]*)\)\)/);
    expect(restricao).not.toBeNull();
    const noBanco = [...restricao![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(noBanco).toEqual([...ETAPAS]);
  });

  it('as etapas que saíram são convertidas antes da restrição entrar', () => {
    // Na ordem contrária, a migration morre na primeira linha que ainda
    // estiver no valor velho — e morre em produção, não aqui.
    const posicaoDoUpdate = MIGRATION.indexOf('update public.crm_etapa');
    const posicaoDaRestricao = MIGRATION.indexOf('add constraint crm_etapa_etapa_check');
    expect(posicaoDoUpdate).toBeGreaterThan(0);
    expect(posicaoDoUpdate).toBeLessThan(posicaoDaRestricao);
  });

  it('nenhuma etapa aposentada sobrevive na restrição', () => {
    const restricao = MIGRATION.match(/check \(etapa in \(([^)]*)\)\)/)![1];
    for (const morta of ['conversando', 'proposta', 'assinou', 'trial_ativo', 'convertido']) {
      expect(restricao).not.toContain(morta);
    }
  });

  it('a linha do tempo não é reescrita', () => {
    // Um evento que diz "moveu para proposta" continua verdadeiro depois de a
    // etapa deixar de existir. Reescrever o passado para caber no vocabulário
    // de hoje é o oposto de append-only.
    expect(MIGRATION).not.toMatch(/update public\.crm_etapa_evento/);
    expect(MIGRATION).not.toMatch(/delete from public\.crm_etapa_evento/);
  });
});

describe('a conversão das etapas aposentadas', () => {
  it('cobre TODAS as três que saíram, e não só uma', () => {
    // Reduzir o `where` a uma etapa só deixa o teste de ordem verde e derruba
    // o `add constraint` em produção, na primeira linha que ainda estiver em
    // 'proposta' ou 'assinou'.
    const update = MIGRATION.match(/update public\.crm_etapa[\s\S]*?;/)![0];
    for (const aposentada of ['conversando', 'proposta', 'assinou']) {
      expect(update).toContain(`'${aposentada}'`);
    }
  });

  it('converte para uma etapa que a restrição nova aceita', () => {
    // Converter para um valor que a restrição recusa é o mesmo erro com outra
    // roupa: o update passa e o `add constraint` morre logo depois.
    const update = MIGRATION.match(/update public\.crm_etapa[\s\S]*?;/)![0];
    const destino = update.match(/set etapa = '([^']+)'/)![1];
    expect([...ETAPAS]).toContain(destino);
  });
});
