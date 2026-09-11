import { describe, expect, it } from 'vitest';
import { comando, lerMigration } from './crm-migration-de-teste';
import { ETAPA_PADRAO } from './crm-vocabulario';

// ============================================================================
// Mudar de etapa são DUAS escritas, e elas não podem se separar
// ============================================================================
// A linha atual em `crm_etapa` e o evento em `crm_etapa_evento`. Feitas do
// navegador não são uma transação: a segunda pode falhar sozinha, a etapa anda
// sem a linha do tempo registrar, e nada dá erro — a tela mostra a etapa nova.
// O buraco só aparece meses depois, quando alguém for medir quanto tempo cada
// lead ficou parado onde.
// ============================================================================

const MIGRATION = lerMigration('20260911100000_125_crm_mudar_etapa.sql');
const FUNCAO = comando(
  MIGRATION,
  /create or replace function public\.crm_mudar_etapa/,
  '$function$;',
);

describe('crm_mudar_etapa', () => {
  it('existe', () => {
    expect(FUNCAO).not.toBeNull();
  });

  it('grava a etapa e o evento na mesma função', () => {
    expect(FUNCAO).toMatch(/insert into public\.crm_etapa\b/);
    expect(FUNCAO).toMatch(/insert into public\.crm_etapa_evento\b/);
  });

  it('o autor do evento é quem chamou, e não o próprio lead', () => {
    // A mutação que sobreviveu à primeira versão deste guarda: trocar `v_quem`
    // por `p_user_id` no insert. A linha do tempo passaria a dizer que cada
    // lead moveu a si mesmo, e o teste antigo — que só procurava `auth.uid()`
    // em qualquer lugar do arquivo — ficava verde.
    const evento = comando(FUNCAO ?? '', /insert into public\.crm_etapa_evento/);
    expect(evento).toMatch(/\(p_user_id, v_de, p_etapa, v_quem\)/);
    expect(FUNCAO).toMatch(/v_quem uuid := \(select auth\.uid\(\)\)/);
  });

  it('o autor nunca vem do cliente', () => {
    // `por` como parâmetro deixaria qualquer sócio registrar uma mudança em
    // nome de outro.
    const assinatura = MIGRATION.match(/crm_mudar_etapa\(([^)]*)\)/);
    expect(assinatura![1]).not.toMatch(/por|quem|autor/i);
  });

  it('a linha atual carimba QUANDO mudou', () => {
    // Sem `atualizada_em` no `on conflict`, a segunda mudança de um lead deixa
    // a data da primeira — e a coluna passa a mentir em silêncio.
    const upsert = comando(FUNCAO ?? '', /insert into public\.crm_etapa\b/);
    expect(upsert).toMatch(/atualizada_em = excluded\.atualizada_em/);
    expect(upsert).toMatch(/atualizada_por = excluded\.atualizada_por/);
  });

  it('confere o portão por dentro', () => {
    expect(FUNCAO).toMatch(/if not public\.eh_socio\(\)/);
    expect(FUNCAO).toMatch(/raise exception/);
  });

  it('roda como dono do banco, com search_path travado', () => {
    expect(FUNCAO).toMatch(/security definer/);
    expect(FUNCAO).toMatch(/set search_path to ''/);
  });

  it('não é executável por quem não está logado', () => {
    expect(MIGRATION).toMatch(/revoke execute on function public\.crm_mudar_etapa/);
  });

  it('reescolher a mesma etapa não vira evento', () => {
    // Encheria a linha do tempo de eventos que não aconteceram, e a medida de
    // tempo parado em cada etapa é justamente o que isso estragaria.
    expect(FUNCAO).toMatch(/if v_de = p_etapa then/);
  });

  it('assume a etapa padrão quando não há linha, igual à tela', () => {
    expect(FUNCAO).toContain(`coalesce(v_de, '${ETAPA_PADRAO}')`);
  });

  it('nunca apaga nem reescreve a linha do tempo', () => {
    expect(FUNCAO).not.toMatch(/update public\.crm_etapa_evento\b/);
    expect(FUNCAO).not.toMatch(/delete from public\.crm_etapa_evento\b/);
  });
});
