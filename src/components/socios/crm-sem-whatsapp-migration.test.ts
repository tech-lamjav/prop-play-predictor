import { describe, expect, it } from 'vitest';
import { comando, lerMigration } from './crm-migration-de-teste';

// ============================================================================
// Classificar um lead é decisão, e decisão precisa de dono e de rastro
// ============================================================================
// "Esses eu não consigo fazer nada." Um lead sem WhatsApp é quase uma
// desqualificação, e sair da lista de trabalho é o que o sócio pediu.
//
// O risco de uma marca assim é ela virar um porão: gente some da lista e
// ninguém sabe quem mandou sumir, nem por quê, nem como desfazer. Por isso a
// escrita passa por função, o autor vem do banco, e marcar e desmarcar
// aparecem na linha do tempo.
// ============================================================================

const MIGRATION = lerMigration('20260916200000_143_crm_sem_whatsapp.sql');

const MARCAR = comando(
  MIGRATION,
  /create or replace function public\.crm_marcar_sem_whatsapp/,
  '$function$;',
);

describe('a tabela da marca', () => {
  it('guarda quem, quando e por quem', () => {
    expect(MIGRATION).toMatch(/create table if not exists public\.crm_sem_whatsapp/);
    expect(MIGRATION).toMatch(/user_id uuid primary key references public\.users\(id\)/);
    expect(MIGRATION).toMatch(/marcado_em timestamptz not null default now\(\)/);
    expect(MIGRATION).toMatch(/marcado_por uuid references public\.users\(id\)/);
  });

  it('uma pessoa é marcada uma vez só', () => {
    // Chave primária no user_id. Sem isso, marcar duas vezes criaria duas
    // linhas e desmarcar deixaria uma para trás — a pessoa continuaria sumida
    // da lista sem nada na tela explicando.
    expect(MIGRATION).toMatch(/user_id uuid primary key/);
  });

  it('não existe coluna de motivo', () => {
    // ⚠️ A revisão pegou: a primeira versão tinha motivo ponta a ponta — coluna,
    // parâmetro e opção do hook — e NENHUMA tela mandava nada. Campo pela
    // metade promete um dado que ninguém preenche, e alguém lendo a tabela
    // daqui a um ano concluiria que os sócios nunca justificam. Se fizer falta,
    // volta junto com a tela que o escreve.
    // A asserção é sobre a COLUNA e o PARÂMETRO, e não sobre a palavra solta:
    // o comentário acima da tabela explica justamente por que o campo não
    // existe, e proibir a palavra proibiria a explicação.
    expect(MIGRATION).not.toMatch(/^\s*motivo\s+text/m);
    expect(MIGRATION).not.toMatch(/p_motivo/);
    expect(MIGRATION).not.toMatch(/v_motivo/);
  });

  it('some junto com a pessoa', () => {
    expect(MIGRATION).toMatch(/on delete cascade/);
  });

  it('só sócio lê', () => {
    expect(MIGRATION).toMatch(/alter table public\.crm_sem_whatsapp enable row level security/);
    const politicas = MIGRATION.match(/create policy [^;]*?on public\.crm_sem_whatsapp[^;]*;/g) ?? [];
    expect(politicas.length).toBeGreaterThan(0);
    for (const p of politicas) expect(p).toMatch(/public\.eh_socio\(\)/);
  });

  it('não há política de escrita: a marca só se escreve pela função', () => {
    // ⚠️ Com uma política `for all`, o sócio marcaria direto pela API, sem
    // autor carimbado e sem linha do tempo — e a tela seria o único lugar onde
    // o registro existiria. Mesma decisão da 141 para os pagamentos.
    const politicas = MIGRATION.match(/create policy [^;]*?on public\.crm_sem_whatsapp[^;]*;/g) ?? [];
    for (const p of politicas) expect(p).toMatch(/for select/);
  });
});

describe('crm_marcar_sem_whatsapp', () => {
  it('existe, com portão e search_path travado', () => {
    expect(MARCAR).not.toBeNull();
    expect(MARCAR).toMatch(/if not public\.eh_socio\(\)/);
    expect(MARCAR).toMatch(/security definer/);
    expect(MARCAR).toMatch(/set search_path to ''/);
  });

  it('não é executável por quem não está logado, nem pelo anônimo', () => {
    // ⚠️ Os dois revokes. No Supabase o schema `public` dá EXECUTE direto a
    // `anon`, e esse grant sobrevive ao revoke de PUBLIC: só o primeiro
    // deixaria um visitante deslogado chamando uma função que roda com
    // privilégio de dono do banco.
    expect(MIGRATION).toMatch(
      /revoke execute on function public\.crm_marcar_sem_whatsapp\(uuid, boolean\) from public/,
    );
    expect(MIGRATION).toMatch(
      /revoke execute on function public\.crm_marcar_sem_whatsapp\(uuid, boolean\) from anon/,
    );
    expect(MIGRATION).toMatch(
      /grant\s+execute on function public\.crm_marcar_sem_whatsapp\(uuid, boolean\) to authenticated/,
    );
  });

  it('o autor vem do banco, e não dos parâmetros', () => {
    const assinatura = MIGRATION.match(/crm_marcar_sem_whatsapp\(([\s\S]*?)\)\nreturns/)![1];
    expect(assinatura).not.toMatch(/por|autor|quem/i);
    expect(MARCAR).toMatch(/\(select auth\.uid\(\)\)/);
  });

  it('marcar e desmarcar entram na linha do tempo', () => {
    // Daqui a dois meses alguém pergunta por que essa pessoa nunca aparece na
    // fila. A resposta tem de estar junto do resto da conversa, e não só na
    // tabela.
    const anotacoes = MARCAR?.match(/insert into public\.crm_anotacao/g) ?? [];
    expect(anotacoes.length).toBe(2);
    expect(MARCAR).toMatch(/Marcado como sem WhatsApp/);
    expect(MARCAR).toMatch(/Desmarcado/);
  });

  it('usa um tipo de anotação que o banco aceita', () => {
    // A 129 ampliou o check para anotacao, feedback, objecao e acesso. Um tipo
    // fora dessa lista faz a função inteira falhar no insert — e como marcar e
    // registrar são a mesma transação, a marca também não acontece.
    const tipos = MARCAR?.match(/'(anotacao|feedback|objecao|acesso)'/g) ?? [];
    expect(tipos.length).toBe(2);
  });

  it('desmarcar apaga a linha, porque marca não é histórico', () => {
    // O histórico é a linha do tempo. A tabela responde "está marcado agora",
    // e uma marca desfeita que continua na tabela esconderia a pessoa para
    // sempre.
    expect(MARCAR).toMatch(/delete from public\.crm_sem_whatsapp/);
  });

  it('remarcar quem já está marcado não escreve nada', () => {
    // Mesma regra da 125 quando alguém reescolhe a etapa que já valia: encher
    // a linha do tempo de mudanças que não aconteceram estraga justamente a
    // leitura dela. Sem motivo para atualizar, remarcar não tem o que fazer.
    expect(MARCAR).toMatch(/v_ja/);
    expect(MARCAR).toMatch(/if p_marcado and not v_ja then/);
    expect(MARCAR).not.toMatch(/update public\.crm_sem_whatsapp/);
  });

  it('desmarcar quem não estava marcado não escreve nada', () => {
    // Sem o guarda, cada clique em "desmarcar" num lead limpo deixaria um
    // "voltou para as listas" na linha do tempo de alguém que nunca saiu.
    expect(MARCAR).toMatch(/elsif not p_marcado and v_ja then/);
  });

  it('não monta SQL com texto vindo de fora', () => {
    expect(MARCAR).not.toMatch(/execute\s+(format|'|")/i);
    expect(MARCAR).not.toMatch(/quote_ident/);
  });

  it('não encosta no acesso nem no cadastro da pessoa', () => {
    // Marcar é classificação de trabalho, e não punição: ninguém perde produto
    // por não ter WhatsApp.
    expect(MARCAR).not.toMatch(/update public\.users/);
    expect(MARCAR).not.toMatch(/subscription_status/);
  });

  it('aguenta rodar duas vezes', () => {
    expect(MIGRATION).toMatch(/create table if not exists/);
    expect(MIGRATION).toMatch(/create or replace function/);
    expect(MIGRATION).toMatch(/drop policy if exists/);
  });
});
