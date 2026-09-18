import { describe, expect, it } from 'vitest';
import { comando, lerMigration } from './crm-migration-de-teste';

// ============================================================================
// O expand da ADR 0004: o pagamento ganha dono, e o Stripe ganha lugar
// ============================================================================
// Esta migration não entrega nada visível. Ela é o que separa "o webhook pode
// gravar pagamento" de "não podia", e por isso os guardas aqui são de FORMA:
// se o esquema sair errado, quem descobre é o deploy, não o teste.
//
// O risco específico que estes testes cobrem é o de um conserto pela metade —
// abrir espaço para o Stripe e esquecer de soltar a regra que o impediria de
// entrar, ou soltar a regra e deixar o lado manual sem guarda nenhum.
// ============================================================================

const MIGRATION = lerMigration('20260917220000_151_crm_pagamento_com_dono.sql');

const REGISTRAR = comando(
  MIGRATION,
  /create or replace function public\.crm_registrar_pagamento/,
  '$function$;',
);

describe('o dono do pagamento', () => {
  it('a pessoa entra como coluna, apontando para users', () => {
    expect(MIGRATION).toMatch(
      /add column if not exists user_id uuid references public\.users\(id\) on delete cascade/,
    );
  });

  it('as linhas que já existem são preenchidas a partir da assinatura', () => {
    // Sem isto o `set not null` derruba a migration, porque toda linha antiga
    // nasceria sem dono.
    expect(MIGRATION).toMatch(/update public\.crm_pagamento p[\s\S]*?set user_id = a\.user_id/);
    expect(MIGRATION).toMatch(/from public\.crm_assinatura_manual a/);
  });

  it('e só DEPOIS o dono vira obrigatório', () => {
    // ⚠️ A ordem é o conteúdo deste teste. `add column ... not null` numa
    // tabela com linhas falha de cara; e um `set not null` antes do
    // preenchimento falharia igual. O preenchimento tem de estar no meio.
    const posBackfill = MIGRATION.indexOf('set user_id = a.user_id');
    const posNotNull = MIGRATION.indexOf('alter column user_id set not null');
    expect(posBackfill).toBeGreaterThan(0);
    expect(posNotNull).toBeGreaterThan(posBackfill);
  });

  it('o dono é buscável direto, sem passar pela assinatura', () => {
    // A ficha soma as duas origens de uma pessoa, e essa passa a ser a leitura
    // mais comum das telas.
    expect(MIGRATION).toMatch(
      /create index if not exists idx_crm_pagamento_pessoa[\s\S]*?on public\.crm_pagamento\(user_id, competencia desc\)/,
    );
  });
});

describe('o lugar do Stripe', () => {
  it('a assinatura manual vira vínculo opcional', () => {
    // Pagamento do Stripe não tem acordo feito na mão, e nunca vai ter: a
    // assinatura do gateway mora nas colunas de users que o webhook mantém.
    expect(MIGRATION).toMatch(/alter column assinatura_id drop not null/);
  });

  it('a fatura do Stripe é guardada, e é única', () => {
    // O Stripe reentrega evento de propósito. Sem a unicidade, a mesma fatura
    // entra duas vezes e o total infla sozinho.
    expect(MIGRATION).toMatch(/add column if not exists stripe_invoice_id text/);
    expect(MIGRATION).toMatch(
      /create unique index if not exists idx_crm_pagamento_fatura_unica[\s\S]*?on public\.crm_pagamento\(stripe_invoice_id\)/,
    );
  });

  it('⚠️ o índice da fatura NÃO é parcial, senão o upsert do webhook falha', () => {
    // Este teste já afirmou o contrário, e a versão anterior estava errada por
    // dois motivos de uma vez.
    //
    // O `where ... is not null` parecia proteger o lado manual, que não tem
    // fatura. Não protegia nada: no Postgres, índice único trata cada NULO como
    // distinto, então várias linhas sem fatura sempre couberam.
    //
    // E quebrava o que importa: o Postgres só aceita um índice PARCIAL como
    // árbitro de `ON CONFLICT` se a cláusula repetir o predicado, e o PostgREST
    // não tem como mandá-lo. O upsert do webhook falharia com 42P10, o erro
    // cairia num log e o evento responderia 200 — dinheiro do gateway sumindo
    // calado.
    const indice = comando(
      MIGRATION,
      /create unique index if not exists idx_crm_pagamento_fatura_unica/,
    );
    expect(indice).not.toMatch(/where/);
  });
});

describe('o mês único passa a valer só para a origem manual', () => {
  it('o índice antigo é derrubado antes de ser recriado', () => {
    // `create ... if not exists` não altera um índice que já existe: sem o
    // drop, a regra nova simplesmente não entraria, em silêncio.
    const posDrop = MIGRATION.indexOf('drop index if exists public.idx_crm_pagamento_mes_unico');
    const posCreate = MIGRATION.indexOf('create unique index if not exists idx_crm_pagamento_mes_unico');
    expect(posDrop).toBeGreaterThan(0);
    expect(posCreate).toBeGreaterThan(posDrop);
  });

  it('continua proibindo dois pagamentos manuais no mesmo mês', () => {
    // "Pagou setembro" é um fato que acontece uma vez. O estorno continua
    // liberando o mês, pelo `estornado_em is null`.
    const indice = comando(MIGRATION, /create unique index if not exists idx_crm_pagamento_mes_unico/);
    expect(indice).toMatch(/on public\.crm_pagamento\(assinatura_id, competencia\)/);
    expect(indice).toMatch(/estornado_em is null/);
  });

  it('e deixa o Stripe cobrar duas vezes no mesmo mês, porque é legítimo', () => {
    // ⚠️ É o que acontece numa troca de plano com proporcional. Sem esta
    // cláusula o banco RECUSA a segunda fatura, e o webhook perde dinheiro de
    // verdade sem ninguém ver.
    const indice = comando(MIGRATION, /create unique index if not exists idx_crm_pagamento_mes_unico/);
    expect(indice).toMatch(/assinatura_id is not null/);
  });
});

describe('a situação crua do Stripe', () => {
  it('ganha coluna própria em users', () => {
    expect(MIGRATION).toMatch(/add column if not exists stripe_subscription_status text/);
  });

  it('NÃO tem restrição de valores', () => {
    // Quem define a lista de estados é o Stripe. Uma restrição nossa quebraria
    // no dia em que ele criasse um estado novo — e quebraria gravando, que é o
    // pior momento.
    expect(MIGRATION).not.toMatch(/stripe_subscription_status text[^;]*check/i);
  });

  it('não encosta nas colunas de acesso por produto', () => {
    // ⚠️ Elas são PORTÃO e só entendem premium e free. Escrever past_due ali
    // daria ou tiraria acesso de alguém. Esta migration não muda quem entra.
    expect(MIGRATION).not.toMatch(/alter column (betinho|futebol|analytics)_subscription_status/);
    expect(MIGRATION).not.toMatch(/drop column/i);
  });

  it('não reaproveita a subscription_status da 009', () => {
    // A restrição dela aceita só free, premium e disabled: recusaria
    // justamente o past_due, que é o motivo desta coluna existir.
    expect(MIGRATION).not.toMatch(/alter column subscription_status/);
  });
});

describe('crm_registrar_pagamento', () => {
  it('passa a gravar o dono', () => {
    // Sem isto a migration sobe e o primeiro Pix lançado pela tela quebra,
    // porque a coluna virou obrigatória.
    expect(REGISTRAR).not.toBeNull();
    expect(REGISTRAR).toMatch(/insert into public\.crm_pagamento\s*\(user_id, assinatura_id/);
    expect(REGISTRAR).toMatch(/values\s*\(v_user_id, p_assinatura_id/);
  });

  it('o dono vem da assinatura, e nunca dos parâmetros', () => {
    const assinatura = MIGRATION.match(/crm_registrar_pagamento\(([\s\S]*?)\)\nreturns/)![1];
    expect(assinatura).not.toMatch(/user_id/);
    expect(REGISTRAR).toMatch(/select a\.user_id/);
  });

  it('continua com portão de sócio e search_path travado', () => {
    expect(REGISTRAR).toMatch(/if not public\.eh_socio\(\)/);
    expect(REGISTRAR).toMatch(/security definer/);
    expect(REGISTRAR).toMatch(/set search_path to ''/);
  });

  it('revoga de public E de anon antes de conceder', () => {
    // ⚠️ No Supabase revogar de PUBLIC não fecha o anônimo: o schema public dá
    // EXECUTE direto a anon e a authenticated.
    expect(MIGRATION).toMatch(
      /revoke execute on function public\.crm_registrar_pagamento\(uuid, date, numeric, text, date\) from public/,
    );
    expect(MIGRATION).toMatch(
      /revoke execute on function public\.crm_registrar_pagamento\(uuid, date, numeric, text, date\) from anon/,
    );
    expect(MIGRATION).toMatch(
      /grant\s+execute on function public\.crm_registrar_pagamento\(uuid, date, numeric, text, date\) to authenticated/,
    );
  });

  it('não muda comportamento: vitalício continua sem ganhar data', () => {
    // O corpo é o da 142. A única razão da redefinição é o dono novo, e este
    // teste é o que impede a redefinição de trazer carona.
    expect(REGISTRAR).toMatch(/if not v_vitalicio then/);
    expect(REGISTRAR).toMatch(/set vence_em = greatest\(vence_em,/);
  });

  it('não monta SQL com texto vindo de fora', () => {
    expect(REGISTRAR).not.toMatch(/execute\s+(format|'|")/i);
    expect(REGISTRAR).not.toMatch(/quote_ident/);
  });
});
