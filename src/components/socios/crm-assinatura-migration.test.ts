import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { comando, lerMigration } from './crm-migration-de-teste';
import { PLANOS_A_VENDER } from './crm-vocabulario';

// ============================================================================
// A assinatura dada na mão vira uma coisa que se acompanha
// ============================================================================
// Até aqui o CRM ligava produtos soltos e não guardava que aquilo tinha sido
// dado na mão. A consequência prática é que ninguém sabia a quem cobrar: a
// assinatura manual não renova sozinha, ela vence, e alguém precisa falar com a
// pessoa ANTES disso.
//
// Esta migration cria a tabela que registra a concessão como um fato próprio
// (quem, qual plano, até quando) e a função que concede o plano inteiro de uma
// vez, seguindo a escada cumulativa.
// ============================================================================

const MIGRATION = lerMigration('20260913100000_131_crm_assinatura_manual.sql');

const DAR = comando(
  MIGRATION,
  /create or replace function public\.crm_dar_assinatura_manual/,
  '$function$;',
);
const ENCERRAR = comando(
  MIGRATION,
  /create or replace function public\.crm_encerrar_assinatura_manual/,
  '$function$;',
);

describe('a tabela', () => {
  it('existe e aponta para a pessoa', () => {
    expect(MIGRATION).toMatch(/create table if not exists public\.crm_assinatura_manual/);
    expect(MIGRATION).toMatch(/user_id uuid not null references public\.users\(id\)/);
  });

  it('guarda o plano e a data de fim', () => {
    // Sem os dois não há cobrança possível: a tela nova existe para dizer
    // "fulano está no Essencial e vence sexta".
    expect(MIGRATION).toMatch(/plano text not null/);
    expect(MIGRATION).toMatch(/vence_em date not null/);
  });

  it('guarda quem deu, e não aceita isso do cliente', () => {
    expect(MIGRATION).toMatch(/criada_por uuid/);
    expect(DAR).toMatch(/\(select auth\.uid\(\)\)/);
    const assinatura = MIGRATION.match(/crm_dar_assinatura_manual\(([^)]*)\)/);
    expect(assinatura![1]).not.toMatch(/por|autor|quem/i);
  });

  it('encerrar é marcar, e não apagar', () => {
    // O histórico é o que responde "quantas cortesias a gente deu este mês" e
    // "esta pessoa já teve uma antes". Deletar joga fora as duas respostas.
    expect(MIGRATION).toMatch(/encerrada_em timestamptz/);
    expect(ENCERRAR).toMatch(/update public\.crm_assinatura_manual/);
    expect(ENCERRAR).not.toMatch(/delete from/i);
  });

  it('uma pessoa não tem duas assinaturas manuais abertas', () => {
    // Com duas abertas, a tela de cobrança mostraria a mesma pessoa duas vezes
    // com datas diferentes, e ninguém saberia qual vale.
    expect(MIGRATION).toMatch(
      /create unique index[\s\S]*?on public\.crm_assinatura_manual[\s\S]*?where encerrada_em is null/,
    );
  });

  it('só sócio lê e escreve', () => {
    expect(MIGRATION).toMatch(
      /alter table public\.crm_assinatura_manual enable row level security/,
    );
    const politicas =
      MIGRATION.match(/create policy [^;]*?on public\.crm_assinatura_manual[^;]*;/g) ?? [];
    expect(politicas.length).toBeGreaterThan(0);
    for (const politica of politicas) expect(politica).toMatch(/public\.eh_socio\(\)/);
  });
});

describe('crm_dar_assinatura_manual', () => {
  it('existe', () => {
    expect(DAR).not.toBeNull();
  });

  it('confere o portão por dentro', () => {
    expect(DAR).toMatch(/if not public\.eh_socio\(\)/);
  });

  it('roda como dono do banco, com search_path travado', () => {
    expect(DAR).toMatch(/security definer/);
    expect(DAR).toMatch(/set search_path to ''/);
  });

  it('não é executável por quem não está logado', () => {
    expect(MIGRATION).toMatch(/revoke execute on function public\.crm_dar_assinatura_manual/);
    expect(MIGRATION).toMatch(/revoke execute on function public\.crm_encerrar_assinatura_manual/);
  });

  it('recusa plano fora da lista', () => {
    expect(DAR).toMatch(/raise exception 'plano desconhecido/);
  });

  it('trata os três planos que a tela oferece', () => {
    for (const plano of PLANOS_A_VENDER) {
      expect(DAR, plano).toContain(`'${plano}'`);
    }
  });

  it('não monta SQL com texto vindo de fora', () => {
    expect(DAR).not.toMatch(/execute\s+(format|'|")/i);
    expect(DAR).not.toMatch(/quote_ident/);
  });

  it('só escreve nas colunas de acesso e no tipo do plano', () => {
    const escritas = DAR?.match(/update public\.users[\s\S]*?where/g) ?? [];
    expect(escritas.length).toBeGreaterThan(0);
    for (const escrita of escritas) {
      expect(escrita).not.toMatch(/is_socio/);
      expect(escrita).not.toMatch(/stripe_/);
      expect(escrita).not.toMatch(/\bemail\b/);
    }
  });

  it('deixa registro na linha do tempo', () => {
    expect(DAR).toMatch(/insert into public\.crm_anotacao/);
    expect(DAR).toMatch(/'acesso'/);
  });

  it('encerra a anterior antes de abrir a nova', () => {
    // Renovar é dar de novo. Sem encerrar a anterior, o índice único derruba a
    // gravação e o sócio vê um erro de banco sem entender o que fez de errado.
    expect(DAR).toMatch(/update public\.crm_assinatura_manual[\s\S]*?set encerrada_em/);
  });
});

describe('a escada de planos não pode divergir do Stripe', () => {
  /**
   * `shared/concessoes.ts` é a fonte da verdade e roda em Deno; a migration
   * roda no Postgres. Não há módulo que os dois importem, então a escada está
   * escrita duas vezes por necessidade — exatamente o caso que este guarda
   * existe para vigiar. Se as duas divergirem, um assinante manual do Essencial
   * ganha um acesso a menos que um assinante pagante do mesmo plano.
   */
  const CONCESSOES = readFileSync(
    resolve(__dirname, '../../../supabase/functions/shared/concessoes.ts'),
    'utf8',
  );

  /** As colunas que `concessoes.ts` dá a um plano. */
  function noStripe(plano: string): string[] {
    const trecho = CONCESSOES.slice(CONCESSOES.indexOf(`${plano}: [`));
    const lista = trecho.slice(0, trecho.indexOf(']'));
    return [...lista.matchAll(/"([a-z_]+_subscription_status)"/g)].map((m) => m[1]).sort();
  }

  /** As colunas que o ramo do plano na migration escreve. */
  function naMigration(plano: string): string[] {
    const ramo = DAR?.slice(DAR.indexOf(`p_plano = '${plano}'`)) ?? '';
    const ate = ramo.indexOf('where id = p_user_id');
    return [...ramo.slice(0, ate).matchAll(/([a-z_]+_subscription_status)/g)]
      .map((m) => m[1])
      .filter((c, i, todas) => todas.indexOf(c) === i)
      .sort();
  }

  for (const plano of PLANOS_A_VENDER) {
    it(`${plano} concede o mesmo dos dois lados`, () => {
      const doStripe = noStripe(plano);
      expect(doStripe.length).toBeGreaterThan(0);
      expect(naMigration(plano)).toEqual(doStripe);
    });
  }

  it('a escada é cumulativa, e o guarda acima notaria se deixasse de ser', () => {
    // Prova que as listas acima têm tamanhos diferentes: se o parser estivesse
    // devolvendo a mesma coisa para os três, os testes passariam sem guardar
    // nada. Entrada dá um acesso, Essencial dois, Completo três.
    expect(noStripe('entrada')).toHaveLength(1);
    expect(noStripe('essencial')).toHaveLength(2);
    expect(noStripe('completo')).toHaveLength(3);
  });
});
