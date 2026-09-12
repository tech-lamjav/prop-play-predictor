import { describe, expect, it } from 'vitest';
import { lerMigration } from './crm-migration-de-teste';
import { ETAPAS } from './crm-vocabulario';

// ============================================================================
// O vocabulário do banco e o da tela não podem se separar
// ============================================================================
// A restrição vigente é a da migration 133, que substituiu a da 128, que já
// tinha substituído a da 123. O guarda mora aqui e acompanha a vigente
// justamente por isso: apontar para uma restrição antiga deixaria o teste verde
// guardando um vocabulário aposentado.
// ============================================================================

const MIGRATION = lerMigration('20260914100000_133_crm_primeiro_contato.sql');

describe('as etapas da venda', () => {
  it('a restrição do banco lista exatamente as etapas do glossário', () => {
    const restricao = MIGRATION.match(/check\s*\(\s*etapa in \(([\s\S]*?)\)\s*\)/);
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
    const restricao = MIGRATION.match(/check\s*\(\s*etapa in \(([\s\S]*?)\)\s*\)/)![1];
    // `contatado` entra na lista porque virou `primeiro_contato` na 133:
    // "contatado" não diz se foi a primeira vez ou a quinta, e o funil precisa
    // do primeiro toque como marco. `em_teste` nunca foi etapa e não pode
    // voltar a ser: é etiqueta da pessoa, não altura da conversa.
    const mortas = [
      'conversando',
      'proposta',
      'assinou',
      'trial_ativo',
      'convertido',
      "'contatado'",
      'em_teste',
    ];
    for (const morta of mortas) {
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

/**
 * Cada rename converte os dados que ELE aposentou.
 *
 * Este bloco olha uma migration por vez, e não a vigente: a 128 tinha três
 * etapas para converter e a 133 tem uma, então cobrar as três da 133 é cobrar
 * dela um trabalho que não é dela. O que se guarda é o par — quem aposentou um
 * valor converteu aquele valor.
 *
 * Uma linha nova aqui a cada rename de etapa. É de propósito que seja manual:
 * escrever o nome do arquivo é o momento em que alguém confere se a conversão
 * está completa.
 */
describe('quem aposentou um valor converteu aquele valor', () => {
  const RENAMES = [
    {
      arquivo: '20260911200000_128_crm_etapas_da_venda.sql',
      aposentadas: ['conversando', 'proposta', 'assinou'],
    },
    { arquivo: '20260914100000_133_crm_primeiro_contato.sql', aposentadas: ['contatado'] },
  ];

  for (const { arquivo, aposentadas } of RENAMES) {
    const sql = lerMigration(arquivo);
    const update = sql.match(/update public\.crm_etapa[\s\S]*?;/)![0];

    it(`${arquivo.slice(15, 18)} converte todas as que ela aposentou`, () => {
      // Reduzir o `where` a um valor só deixa o teste de ordem verde e derruba
      // o `add constraint` em produção, na primeira linha que sobrou no velho.
      for (const aposentada of aposentadas) {
        expect(update, aposentada).toContain(`'${aposentada}'`);
      }
    });

    it(`${arquivo.slice(15, 18)} converte para um valor que a restrição dela aceita`, () => {
      // Converter para um valor que a própria restrição recusa é o mesmo erro
      // com outra roupa: o update passa e o `add constraint` morre logo depois.
      const destino = update.match(/set etapa = '([^']+)'/)![1];
      const restricao = sql.match(/check\s*\(\s*etapa in \(([\s\S]*?)\)\s*\)/)![1];
      expect(restricao).toContain(`'${destino}'`);
    });
  }

  it('a última da lista é a que define o vocabulário de hoje', () => {
    // Sem isto, somar um rename novo sem trocar o MIGRATION do topo deixaria o
    // guarda do glossário olhando para a restrição de antes.
    expect(RENAMES[RENAMES.length - 1].arquivo).toBe('20260914100000_133_crm_primeiro_contato.sql');
    const daVigente = MIGRATION.match(/check\s*\(\s*etapa in \(([\s\S]*?)\)\s*\)/)![1];
    const daUltima = lerMigration(RENAMES[RENAMES.length - 1].arquivo).match(
      /check\s*\(\s*etapa in \(([\s\S]*?)\)\s*\)/,
    )![1];
    expect(daVigente).toBe(daUltima);
  });
});
