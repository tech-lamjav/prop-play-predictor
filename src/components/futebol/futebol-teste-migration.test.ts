import { describe, expect, it } from 'vitest';
import { comando, lerMigration } from '../socios/crm-migration-de-teste';

// ============================================================================
// O teste grátis do futebol passa de 7 dias para 48 horas
// ============================================================================
// A duração era um número solto repetido em cinco lugares do servidor, e cada
// cópia decidia sozinha quem ainda tinha acesso. Esta migration materializa o
// FIM do teste numa coluna, gravada no instante em que o relógio começa, e faz
// todo mundo passar a ler essa coluna.
//
// O corte é o que a coluna guarda: quem já tinha relógio correndo foi
// preenchido com início + 7 dias, porque foi isso que a página prometeu para
// essa pessoa. Quem ainda não abriu o módulo recebe 48 horas quando abrir,
// independente de quando se cadastrou.
//
// O ganho é que a decisão passa a ser tomada uma vez, na largada, e nunca mais:
// não sobra data de corte pendurada no código, e as consultas de alerta acertam
// as duas coortes sem saber que existem duas.
// ============================================================================

const MIGRATION = lerMigration('20260914200000_136_futebol_teste_48_horas.sql');

const ACESSO = comando(
  MIGRATION,
  /create or replace function public\.get_futebol_access/i,
  '$function$;',
);
const DURACAO = comando(
  MIGRATION,
  /create or replace function public\.futebol_trial_duracao/i,
  '$function$;',
);
const TESTE_NA_MAO = comando(
  MIGRATION,
  /create or replace function public\.crm_definir_teste_do_futebol/i,
  '$function$;',
);

describe('a coluna que guarda o fim do teste', () => {
  it('nasce na tabela de usuários', () => {
    expect(MIGRATION).toMatch(
      /alter table public\.users[\s\S]*?add column if not exists futebol_trial_ends_at timestamptz/i,
    );
  });

  it('se explica na própria coluna', () => {
    expect(MIGRATION).toMatch(/comment on column public\.users\.futebol_trial_ends_at/i);
  });
});

describe('o corte entre as duas coortes', () => {
  it('dá sete dias para quem já tinha o relógio correndo', () => {
    // O corte é medido pelo relógio, não pela data de cadastro: o teste começa
    // na primeira vez que a pessoa abre o módulo, então quem se cadastrou há
    // meses e nunca abriu NÃO é da coorte antiga.
    const backfill = comando(MIGRATION, /update public\.users[\s\S]*?futebol_trial_ends_at =/i);
    expect(backfill).toMatch(/futebol_trial_started_at \+ interval '7 days'/i);
    expect(backfill).toMatch(/where[\s\S]*futebol_trial_started_at is not null/i);
  });

  it('não reescreve um fim que já esteja gravado', () => {
    // Rodar a migration duas vezes não pode esticar o teste de ninguém.
    const backfill = comando(MIGRATION, /update public\.users[\s\S]*?futebol_trial_ends_at =/i);
    expect(backfill).toMatch(/futebol_trial_ends_at is null/i);
  });
});

describe('a duração nova mora num lugar só', () => {
  it('existe como função', () => {
    expect(DURACAO).not.toBeNull();
  });

  it('são 48 horas', () => {
    expect(DURACAO).toMatch(/interval '48 hours'/i);
  });

  it('é imutável, para o planejador poder embutir', () => {
    expect(DURACAO).toMatch(/immutable/i);
  });
});

describe('get_futebol_access', () => {
  it('existe', () => {
    expect(ACESSO).not.toBeNull();
  });

  it('lê o fim gravado na coluna, em vez de recalcular', () => {
    expect(ACESSO).toMatch(/futebol_trial_ends_at/i);
  });

  it('não carrega mais a duração escrita na mão', () => {
    // O bug que isto evita: manter `v_trial_days int := 7` aqui faria a função
    // discordar da coluna, e a tela mostraria acesso para um teste vencido.
    expect(ACESSO).not.toMatch(/v_trial_days/i);
    expect(ACESSO).not.toMatch(/interval '7 days'/i);
  });

  it('grava o fim no mesmo instante em que larga o relógio', () => {
    // Início e fim são gravados juntos, na mesma escrita: se o fim ficasse para
    // depois, uma linha com início e sem fim seria um teste de duração
    // indefinida, e é justamente essa a linha que não pode existir.
    const largada = comando(ACESSO ?? '', /update public\.users set futebol_trial_started_at/i);
    expect(largada).toMatch(/futebol_trial_ends_at\s*=/i);
    expect(largada).toMatch(/public\.futebol_trial_duracao\(\)/i);
  });

  it('devolve as horas que faltam, não só os dias', () => {
    // Com 48 horas, "2 dias" e depois "1 dia" é a única coisa que a tela
    // conseguiria dizer, e é o oposto da urgência que motivou encurtar.
    expect(ACESSO).toMatch(/'hours_left'/);
  });

  it('mantém days_left no contrato', () => {
    // A tela ainda lê days_left. Tirar agora quebraria o gate antes da fatia
    // que ensina a tela a falar em horas.
    expect(ACESSO).toMatch(/'days_left'/);
  });

  it('segue rodando como dono do banco, com search_path travado', () => {
    expect(ACESSO).toMatch(/security definer/i);
    expect(ACESSO).toMatch(/set search_path to ''/i);
  });
});

describe('as consultas que decidem quem recebe alerta', () => {
  const NOMES = [
    'get_opportunity_recipients',
    'get_futebol_publication_alert_recipients',
    'claim_futebol_publication_alert_deliveries',
  ];

  const corpo = (nome: string) =>
    comando(MIGRATION, new RegExp(`create or replace function public\\.${nome}`, 'i'), '$function$;');

  it.each(NOMES)('%s passa a ler o fim do teste', (nome) => {
    const fn = corpo(nome);
    expect(fn).not.toBeNull();
    expect(fn).toMatch(/futebol_trial_ends_at > now\(\)/i);
  });

  it.each(NOMES)('%s não deixa sobrar a conta antiga', (nome) => {
    expect(corpo(nome)).not.toMatch(/futebol_trial_started_at \+ interval '7 days'/i);
  });

  it.each(NOMES)('%s continua fora do alcance de quem está logado', (nome) => {
    // O grant é conferido por string, e não por regex montada: num template
    // literal `\(\)` perde a barra e `()` vira grupo vazio, então o guarda
    // passaria a exigir o grant SEM os parênteses e ficaria vermelho com o
    // SQL certo.
    expect(MIGRATION).toMatch(new RegExp(`revoke execute on function public\\.${nome}`, 'i'));
    expect(MIGRATION.toLowerCase()).toContain(
      `grant execute on function public.${nome}() to service_role`,
    );
  });
});

describe('o teste dado na mão pelo sócio', () => {
  it('grava as duas colunas', () => {
    // Sem isto, o sócio liga o teste na ficha, a coluna de fim fica nula, e a
    // pessoa cai como vencida na hora — acesso concedido que não acontece.
    expect(TESTE_NA_MAO).toMatch(/futebol_trial_started_at\s*=/i);
    expect(TESTE_NA_MAO).toMatch(/futebol_trial_ends_at\s*=/i);
  });

  it('usa a mesma duração do produto', () => {
    expect(TESTE_NA_MAO).toMatch(/public\.futebol_trial_duracao\(\)/i);
  });

  it('limpa as duas quando o sócio encerra', () => {
    expect(TESTE_NA_MAO).toMatch(/v_fim\s+timestamptz/i);
  });

  it('segue só para sócio', () => {
    expect(TESTE_NA_MAO).toMatch(/if not public\.eh_socio\(\)/i);
    expect(MIGRATION).toMatch(/revoke execute on function public\.crm_definir_teste_do_futebol/i);
  });
});
