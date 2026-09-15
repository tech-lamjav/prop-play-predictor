import { describe, expect, it } from 'vitest';
import { comando, lerMigration } from './crm-migration-de-teste';
import { PLANOS_A_VENDER } from './crm-vocabulario';

// ============================================================================
// Registro de dinheiro é o lugar onde não se pode errar em silêncio
// ============================================================================
// O Stripe não vende por Pix, e boa parte dos clientes paga por Pix. Essa
// receita acontecia fora do gateway e não tinha registro em lugar nenhum: o
// sócio recebia o Pix de um mês e no seguinte não sabia se aquela pessoa tinha
// pagado.
//
// Os guardas aqui são os mais duros do CRM, e é de propósito. Um número de
// dinheiro errado é pior que número nenhum, porque o sócio age em cima dele:
// cobra quem já pagou, ou deixa de cobrar quem não pagou.
// ============================================================================

const MIGRATION = lerMigration('20260916160000_141_crm_pagamento.sql');

const REGISTRAR = comando(
  MIGRATION,
  /create or replace function public\.crm_registrar_pagamento/,
  '$function$;',
);
const ESTORNAR = comando(
  MIGRATION,
  /create or replace function public\.crm_estornar_pagamento/,
  '$function$;',
);

describe('a tabela de pagamentos', () => {
  it('guarda o mês de competência, o valor e a origem', () => {
    expect(MIGRATION).toMatch(/create table if not exists public\.crm_pagamento/);
    expect(MIGRATION).toMatch(/competencia date not null/);
    expect(MIGRATION).toMatch(/valor numeric\(10, 2\) not null check \(valor > 0\)/);
    expect(MIGRATION).toMatch(/origem text not null check \(origem in \(/);
  });

  it('a competência é sempre o dia 1º, e o banco cobra isso', () => {
    // "Setembro" tem de ser UM valor. Se o dia variar, o mesmo mês existe com
    // dois nomes, e o índice único deixa lançar duas vezes: "pagou setembro"
    // contado em dobro porque um registro ficou no dia 3 e outro no dia 1º.
    expect(MIGRATION).toMatch(/check \(competencia = date_trunc\('month', competencia\)::date\)/);
  });

  it('competência e dia do pagamento são campos diferentes', () => {
    // Um Pix que cai em 2 de outubro pagando setembro tem competência em
    // setembro e `pago_em` em outubro. Guardar só a data do Pix perderia a
    // distinção — e é ela que responde qual mês está em aberto.
    expect(MIGRATION).toMatch(/pago_em date not null/);
  });

  it('um mês é pago uma vez, e o estorno libera ele de novo', () => {
    // O índice é PARCIAL de propósito: sem o `where`, um lançamento errado
    // estornado travaria o mês para sempre, e o certo nunca poderia entrar.
    expect(MIGRATION).toMatch(
      /create unique index[\s\S]*?on public\.crm_pagamento\(assinatura_id, competencia\)[\s\S]*?where estornado_em is null/,
    );
  });

  it('só sócio lê', () => {
    expect(MIGRATION).toMatch(/alter table public\.crm_pagamento enable row level security/);
    const politicas = MIGRATION.match(/create policy [^;]*?on public\.crm_pagamento[^;]*;/g) ?? [];
    expect(politicas.length).toBeGreaterThan(0);
    for (const p of politicas) expect(p).toMatch(/public\.eh_socio\(\)/);
  });

  it('não há política de escrita: pagamento só se escreve pelas funções', () => {
    // ⚠️ Com uma política `for all`, o sócio conseguia apagar ou editar um
    // pagamento direto pela API, e o estorno com motivo existiria só na tela.
    // As funções são `security definer` e não precisam de política para
    // escrever. O `drop` fica para tirar a política de quem já tinha.
    const politicas = MIGRATION.match(/create policy [^;]*?on public\.crm_pagamento[^;]*;/g) ?? [];
    for (const p of politicas) expect(p).toMatch(/for select/);
    expect(MIGRATION).toMatch(/drop policy if exists "Socios gerenciam os pagamentos"/);
  });

  it('a assinatura ganha valor mensal, e ele pode ser nulo', () => {
    // Nulo quer dizer sem cobrança. As que já existem foram dadas sem valor
    // combinado, e inventar um número para elas criaria receita que ninguém
    // recebeu.
    expect(MIGRATION).toMatch(/add column if not exists valor_mensal numeric\(10, 2\)/);
    expect(MIGRATION).not.toMatch(/valor_mensal numeric\(10, 2\) not null/);
  });

  it('a origem já aceita stripe, mesmo sem ninguém escrever ainda', () => {
    // Quando o webhook entrar, os pagamentos dele cabem sem migration nova, e
    // o total passa a ser consolidado sem mudar o modelo.
    const check = MIGRATION.match(/origem text not null check \(origem in \(([^)]*)\)/)![1];
    expect(check).toContain("'pix'");
    expect(check).toContain("'stripe'");
  });
});

describe('crm_registrar_pagamento', () => {
  it('existe, com portão e search_path travado', () => {
    expect(REGISTRAR).not.toBeNull();
    expect(REGISTRAR).toMatch(/if not public\.eh_socio\(\)/);
    expect(REGISTRAR).toMatch(/security definer/);
    expect(REGISTRAR).toMatch(/set search_path to ''/);
  });

  it('não é executável por quem não está logado', () => {
    expect(MIGRATION).toMatch(/revoke execute on function public\.crm_registrar_pagamento/);
    expect(MIGRATION).toMatch(/revoke execute on function public\.crm_estornar_pagamento/);
  });

  it('recusa valor zerado ou negativo', () => {
    // A restrição da tabela já recusaria, mas o erro dela fala de `check
    // constraint`. Este fala de valor.
    expect(REGISTRAR).toMatch(/raise exception 'valor invalido'/);
  });

  it('normaliza a competência para o dia 1º antes de gravar', () => {
    // Sem isto, a restrição da tabela derruba a gravação quando a tela mandar
    // qualquer dia que não seja o primeiro — e a tela manda um mês, não um dia.
    expect(REGISTRAR).toMatch(/date_trunc\('month', p_competencia\)::date/);
  });

  it('recusa assinatura encerrada', () => {
    // Lançar pagamento em assinatura encerrada é receita entrando para um
    // acordo que já acabou, e ninguém descobriria pela tela.
    expect(REGISTRAR).toMatch(/and a\.encerrada_em is null/);
    expect(REGISTRAR).toMatch(/raise exception 'assinatura nao encontrada ou ja encerrada'/);
  });

  it('o autor vem do banco, e não dos parâmetros', () => {
    const assinatura = MIGRATION.match(/crm_registrar_pagamento\(([\s\S]*?)\)\nreturns/)![1];
    expect(assinatura).not.toMatch(/por|autor|quem/i);
    expect(REGISTRAR).toMatch(/\(select auth\.uid\(\)\)/);
  });

  it('empurra o acesso pelo MAIOR entre o que já tinha e o mês pago', () => {
    // Quem paga adiantado não pode perder o que já tinha, e quem paga
    // atrasado não ganha um mês extra por ter atrasado. `greatest` é o que diz
    // as duas coisas de uma vez.
    expect(REGISTRAR).toMatch(/set vence_em = greatest\(vence_em,/);
    expect(REGISTRAR).not.toMatch(/set vence_em = \(current_date/);
  });

  it('libera o acesso do plano, seguindo a mesma escada', () => {
    for (const plano of PLANOS_A_VENDER) {
      expect(REGISTRAR, plano).toContain(`'${plano}'`);
    }
    expect(REGISTRAR).toMatch(/raise exception 'plano desconhecido ao registrar pagamento/);
  });

  it('deixa registro na linha do tempo, com mês, origem e valor', () => {
    // Daqui a três meses alguém pergunta por que o acesso dessa pessoa foi até
    // tal dia, e a resposta tem de estar junto do resto da conversa.
    expect(REGISTRAR).toMatch(/insert into public\.crm_anotacao/);
    expect(REGISTRAR).toMatch(/'acesso'/);
    expect(REGISTRAR).toMatch(/p_origem/);
  });

  it('não monta SQL com texto vindo de fora', () => {
    expect(REGISTRAR).not.toMatch(/execute\s+(format|'|")/i);
    expect(REGISTRAR).not.toMatch(/quote_ident/);
  });

  it('só escreve nas colunas de acesso e de prazo', () => {
    const escritas = REGISTRAR?.match(/update public\.users[\s\S]*?where/g) ?? [];
    expect(escritas.length).toBeGreaterThan(0);
    for (const escrita of escritas) {
      expect(escrita).not.toMatch(/is_socio/);
      expect(escrita).not.toMatch(/stripe_/);
      expect(escrita).not.toMatch(/\bemail\b/);
    }
  });
});

describe('crm_estornar_pagamento', () => {
  it('existe, com portão e search_path travado', () => {
    expect(ESTORNAR).not.toBeNull();
    expect(ESTORNAR).toMatch(/if not public\.eh_socio\(\)/);
    expect(ESTORNAR).toMatch(/security definer/);
    expect(ESTORNAR).toMatch(/set search_path to ''/);
  });

  it('marca em vez de apagar', () => {
    // Um registro de dinheiro que alguém apaga é um registro que ninguém
    // consegue auditar.
    expect(ESTORNAR).toMatch(/set estornado_em = now\(\)/);
    expect(ESTORNAR).not.toMatch(/delete from/i);
  });

  it('exige motivo, e não aceita espaço em branco', () => {
    expect(ESTORNAR).toMatch(/btrim\(coalesce\(p_motivo, ''\)\)/);
    expect(ESTORNAR).toMatch(/raise exception 'estorno sem motivo'/);
  });

  it('NÃO recua o acesso', () => {
    // O acesso já foi dado e a pessoa já usou. Tirar por causa de um erro de
    // lançamento castiga quem não errou. Cortar acesso é o encerramento, que é
    // decisão separada e explícita.
    expect(ESTORNAR).not.toMatch(/vence_em/);
    expect(ESTORNAR).not.toMatch(/subscription_status/);
  });

  it('recusa estornar duas vezes', () => {
    expect(ESTORNAR).toMatch(/and estornado_em is null/);
    expect(ESTORNAR).toMatch(/raise exception 'pagamento nao encontrado ou ja estornado'/);
  });

  it('o estorno também vai para a linha do tempo, dizendo que o acesso ficou', () => {
    expect(ESTORNAR).toMatch(/insert into public\.crm_anotacao/);
    expect(ESTORNAR).toMatch(/NAO foi recuado/);
  });
});
