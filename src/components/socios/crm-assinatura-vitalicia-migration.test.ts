import { describe, expect, it } from 'vitest';
import { comando, lerMigration } from './crm-migration-de-teste';
import { PLANOS_A_VENDER } from './crm-vocabulario';

// ============================================================================
// A concessão passa a combinar valor, e a data de fim passa a poder não existir
// ============================================================================
// Duas coisas acontecem aqui, e elas parecem uma só:
//
// 1. A 141 criou `valor_mensal` e construiu a tabela de pagamentos em cima
//    dela, mas NINGUÉM ESCREVIA a coluna: quem concede era a função da 131, que
//    recebe plano e data e mais nada. Toda assinatura nascia sem valor, e sem
//    valor não há mês em aberto, nem inadimplente, nem receita para somar.
//
// 2. `vence_em` era obrigatório, e vitalício não cabia. A saída que o modelo
//    oferecia era digitar 2099: um número falso que o resto do sistema trataria
//    como verdade e que um dia chegaria.
//
// ⚠️ Os dois nulos NÃO querem dizer a mesma coisa, e é a distinção que estes
// guardas protegem: `vence_em` nulo é vitalício, `valor_mensal` nulo é sem
// cobrança. As quatro combinações existem na prática.
// ============================================================================

const MIGRATION = lerMigration('20260916180000_142_crm_assinatura_vitalicia.sql');

const DAR = comando(
  MIGRATION,
  /create or replace function public\.crm_dar_assinatura_manual/,
  '$function$;',
);
const REGISTRAR = comando(
  MIGRATION,
  /create or replace function public\.crm_registrar_pagamento/,
  '$function$;',
);

describe('a coluna de vencimento', () => {
  it('deixa de ser obrigatória', () => {
    expect(MIGRATION).toMatch(
      /alter table public\.crm_assinatura_manual\s+alter column vence_em drop not null/,
    );
  });

  it('e o comentário diz o que o nulo quer dizer', () => {
    // Quem abrir o banco daqui a um ano vê uma coluna de data anulável e não
    // tem como adivinhar que o nulo é uma escolha, e não dado faltando.
    const nota = comando(MIGRATION, /comment on column public\.crm_assinatura_manual\.vence_em/);
    expect(nota).toMatch(/vitalicio/i);
  });
});

describe('crm_dar_assinatura_manual', () => {
  it('a função antiga é derrubada antes, e não só substituída', () => {
    // O parâmetro novo muda a assinatura, então `create or replace` criaria uma
    // SEGUNDA função. Com as duas no banco, uma chamada de três argumentos fica
    // ambígua e o Postgres recusa: o sócio veria "function is not unique" ao
    // tentar dar uma assinatura.
    const drop = MIGRATION.indexOf('drop function if exists public.crm_dar_assinatura_manual');
    const cria = MIGRATION.indexOf('create or replace function public.crm_dar_assinatura_manual');
    expect(drop).toBeGreaterThan(-1);
    expect(drop).toBeLessThan(cria);
  });

  it('recebe o valor mensal, e grava ele na linha', () => {
    // É o conserto do furo da 141: sem esta gravação, a coluna existe e fica
    // sempre nula, e a metade financeira do CRM não tem de onde sair.
    expect(DAR).toMatch(/p_valor_mensal numeric default null/);
    expect(DAR).toMatch(/insert into public\.crm_assinatura_manual[\s\S]*?valor_mensal/);
    expect(DAR).toMatch(/values[\s\S]*?p_valor_mensal/);
  });

  it('recusa valor zerado ou negativo, mas aceita nulo', () => {
    // Zero não é "sem cobrança": sem cobrança é NULO. Um zero gravado viraria
    // receita de R$ 0,00 somada num total, e meses em aberto de valor nenhum
    // numa fila de inadimplente.
    expect(DAR).toMatch(/p_valor_mensal is not null and p_valor_mensal <= 0/);
    expect(DAR).toMatch(/raise exception 'valor mensal invalido'/);
  });

  it('não recusa mais data nula, que é o vitalício', () => {
    // A 131 tinha `raise exception 'sem data de vencimento'`, e estava certa
    // enquanto vitalício não existia. Se a linha voltar, o vitalício morre.
    expect(DAR).not.toMatch(/sem data de vencimento/);
  });

  it('em vitalício as colunas de prazo ficam nulas, e não com uma data longe', () => {
    // O acesso é decidido pelo `status`; o prazo é só exibido. Nulo aparece
    // como "sem data de renovação", que é a verdade. Uma data de 2099 seria
    // mentira que o front mostraria para o próprio cliente.
    expect(DAR).toMatch(/betinho_subscription_period_end = p_vence_em/);
    expect(DAR).not.toMatch(/2099|interval '100 year/);
  });

  it('a anotação diz as duas coisas, separadas', () => {
    // Daqui a três meses alguém pergunta por que se está cobrando tanto dessa
    // pessoa, e é esta linha que responde.
    expect(DAR).toMatch(/vitalicio/);
    expect(DAR).toMatch(/valido ate/);
    expect(DAR).toMatch(/sem cobranca/);
    expect(DAR).toMatch(/por mes/);
  });

  it('continua com portão, search_path travado e autor vindo do banco', () => {
    expect(DAR).toMatch(/if not public\.eh_socio\(\)/);
    expect(DAR).toMatch(/security definer/);
    expect(DAR).toMatch(/set search_path to ''/);
    expect(DAR).toMatch(/\(select auth\.uid\(\)\)/);
    const assinatura = MIGRATION.match(/crm_dar_assinatura_manual\(([\s\S]*?)\)\nreturns/)![1];
    expect(assinatura).not.toMatch(/por|autor|quem/i);
  });

  it('continua fechada para quem não está logado', () => {
    // ⚠️ O `revoke` precisa citar a assinatura NOVA. Um revoke apontado para a
    // antiga não erra e não fecha nada: a função de quatro parâmetros nasceria
    // executável por PUBLIC, que inclui `anon`.
    expect(MIGRATION).toMatch(
      /revoke execute on function public\.crm_dar_assinatura_manual\(uuid, text, date, numeric\) from public/,
    );
    expect(MIGRATION).toMatch(
      /grant execute on function public\.crm_dar_assinatura_manual\(uuid, text, date, numeric\) to authenticated/,
    );
  });

  it('continua tratando os três planos e recusando o resto', () => {
    for (const plano of PLANOS_A_VENDER) {
      expect(DAR, plano).toContain(`'${plano}'`);
    }
    expect(DAR).toMatch(/raise exception 'plano desconhecido/);
  });

  it('continua encerrando a anterior antes de abrir a nova', () => {
    expect(DAR).toMatch(/update public\.crm_assinatura_manual[\s\S]*?set encerrada_em/);
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
});

describe('registrar pagamento não pode matar o vitalício', () => {
  it('só empurra a data quando existe data', () => {
    // ⚠️ O bug que esta migration conserta: em Postgres `greatest` IGNORA nulo
    // e devolve o outro valor. A 141 fazia `greatest(vence_em, fim_do_mes)` sem
    // condição, então lançar um pagamento numa assinatura vitalícia DAVA uma
    // data de fim a quem não tinha, e o vitalício virava mensal sem ninguém
    // pedir.
    expect(REGISTRAR).toMatch(/if not v_vitalicio then[\s\S]*?set vence_em = greatest/);
  });

  it('sabe se é vitalícia antes de decidir', () => {
    expect(REGISTRAR).toMatch(/a\.vence_em is null/);
    expect(REGISTRAR).toMatch(/v_vitalicio boolean/);
  });

  it('a anotação do pagamento não promete uma data que não existe', () => {
    // "Acesso pago até " com data nula sairia como frase truncada na linha do
    // tempo, e o sócio leria como dado faltando.
    expect(REGISTRAR).toMatch(/case when v_vitalicio then/);
    expect(REGISTRAR).toMatch(/vitalicia, sem data de fim/i);
  });

  it('continua com portão, search_path travado e revoke', () => {
    expect(REGISTRAR).toMatch(/if not public\.eh_socio\(\)/);
    expect(REGISTRAR).toMatch(/security definer/);
    expect(REGISTRAR).toMatch(/set search_path to ''/);
    expect(MIGRATION).toMatch(/revoke execute on function public\.crm_registrar_pagamento/);
  });

  it('continua recusando valor zerado e assinatura encerrada', () => {
    // O corpo é recriado inteiro, então cada guarda da 141 tem que estar aqui
    // de novo. Um `create or replace` que esquece uma linha apaga a proteção
    // sem nenhum sinal.
    expect(REGISTRAR).toMatch(/raise exception 'valor invalido'/);
    expect(REGISTRAR).toMatch(/and a\.encerrada_em is null/);
    expect(REGISTRAR).toMatch(/raise exception 'assinatura nao encontrada ou ja encerrada'/);
    expect(REGISTRAR).toMatch(/date_trunc\('month', p_competencia\)::date/);
  });
});
