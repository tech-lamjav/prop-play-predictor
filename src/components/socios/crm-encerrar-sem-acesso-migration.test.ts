import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { comando, lerMigration } from './crm-migration-de-teste';

// ============================================================================
// Encerrar registra o fim do acordo, e NÃO tira o produto
// ============================================================================
// A função decidia se podia rebaixar o acesso perguntando "esta pessoa tem
// assinatura no Stripe?", e respondia olhando um campo que o webhook escreve
// num único evento. Quem comprou por outro caminho nunca ganhava esse campo —
// mesmo pagando todo mês. Encerrar uma assinatura manual derrubava o acesso de
// gente que estava pagando, e ninguém ficava sabendo.
//
// Não dava para consertar trocando o sinal: não existe sinal confiável no nosso
// banco. A coluna de situação crua nasce vazia para todo mundo, e usá-la faria
// o sistema achar que ninguém paga no cartão. A fonte confiável é o Stripe, e
// função de banco não fala com ele.
//
// Então o conserto é parar de adivinhar.
// ============================================================================

const ARQUIVO = '20260918180000_159_crm_encerrar_nao_tira_acesso.sql';

const MIGRATION = lerMigration(ARQUIVO);

/**
 * O arquivo COM os comentários.
 *
 * `lerMigration` tira comentário de linha de propósito, porque as migrations do
 * CRM escrevem a versão errada do código dentro do comentário para explicar por
 * que ela não serve. Aqui tem um guarda que precisa do contrário: ele cobra que
 * um motivo esteja ESCRITO, e motivo mora em comentário.
 */
const MIGRATION_CRUA = readFileSync(
  resolve(__dirname, '../../../supabase/migrations', ARQUIVO),
  'utf8',
);

const ENCERRAR = comando(
  MIGRATION,
  /create or replace function public\.crm_encerrar_assinatura_manual/,
  '$function$;',
);

describe('crm_encerrar_assinatura_manual, depois da 159', () => {
  it('⚠️ NÃO escreve em nenhuma coluna de acesso', () => {
    // O guarda central. Qualquer `update public.users` aqui devolve o defeito:
    // o encerramento voltaria a decidir sobre acesso sem ter como saber quem
    // paga no gateway.
    expect(ENCERRAR).not.toBeNull();
    expect(ENCERRAR).not.toMatch(/update public\.users/);
    expect(ENCERRAR).not.toMatch(/_subscription_status/);
    expect(ENCERRAR).not.toMatch(/_period_end/);
    expect(ENCERRAR).not.toMatch(/subscription_product_type/);
  });

  it('⚠️ NÃO consulta mais o identificador do Stripe', () => {
    // Era a adivinhação. O campo é escrito só no evento de assinatura criada ou
    // alterada: nem a compra nem a fatura paga o preenchem.
    expect(ENCERRAR).not.toMatch(/stripe_subscription_id/);
    expect(ENCERRAR).not.toMatch(/tem_stripe/);
  });

  it('continua marcando o fim, e nunca apagando', () => {
    // Um acordo apagado é um acordo que ninguém consegue auditar, e o histórico
    // de pagamento pendura nessa linha.
    expect(ENCERRAR).toMatch(/set encerrada_em = now\(\), encerrada_por = \(select auth\.uid\(\)\)/);
    expect(ENCERRAR).not.toMatch(/delete from/i);
  });

  it('recusa encerrar o que não existe ou já foi encerrado', () => {
    expect(ENCERRAR).toMatch(/and encerrada_em is null/);
    expect(ENCERRAR).toMatch(/raise exception 'assinatura nao encontrada ou ja encerrada'/);
  });

  it('⚠️ a linha do tempo DIZ que o acesso não foi tirado', () => {
    // É a única coisa que impede o sócio de encerrar e ir embora achando que
    // cortou. Sem esta frase, a mudança troca um defeito silencioso por outro.
    expect(ENCERRAR).toMatch(/insert into public\.crm_anotacao/);
    expect(ENCERRAR).toMatch(/ACESSO NAO FOI TIRADO/);
    expect(ENCERRAR).toMatch(/acessos avulsos/);
  });

  it('diz qual plano acabou, e o plano é LIDO e não só declarado', () => {
    // Daqui a três meses alguém pergunta o que essa pessoa tinha, e a resposta
    // precisa estar junto do resto da conversa.
    //
    // ⚠️ `toMatch(/v_plano/)` sozinho ficava verde com a variável apenas
    // declarada — e variável sem leitor é exatamente a pista que denunciou o
    // defeito da 132, onde o plano era guardado e nunca usado. O guarda cobra
    // que ele apareça CONCATENADO no texto da anotação.
    expect(ENCERRAR).toMatch(/\|\| v_plano \|\|/);
  });

  it('⚠️ o rótulo do plano NÃO é zerado, e isso é deliberado', () => {
    // A 132 zerava `subscription_product_type` ao encerrar. Ela fazia isso
    // DEPOIS da verificação de Stripe, então não zerava para quem paga no
    // cartão. Zerar sempre apagaria o rótulo de quem paga no gateway; zerar só
    // às vezes exige a pergunta que não tem resposta confiável no nosso banco.
    //
    // A consequência é rótulo desencontrado na ficha, e não acesso indevido. O
    // conserto certo é a ficha derivar o plano da assinatura ABERTA, e é
    // trabalho próprio.
    expect(ENCERRAR).not.toMatch(/subscription_product_type/);
    expect(MIGRATION_CRUA).toMatch(/rótulo do plano/);
  });

  it('continua com portão de sócio e search_path travado', () => {
    expect(ENCERRAR).toMatch(/if not public\.eh_socio\(\)/);
    expect(ENCERRAR).toMatch(/security definer/);
    expect(ENCERRAR).toMatch(/set search_path to ''/);
  });

  it('revoga de public E de anon antes de conceder', () => {
    // No Supabase, revogar de PUBLIC não fecha o anônimo: o schema `public` dá
    // EXECUTE direto a `anon` e a `authenticated`.
    const f = /public\.crm_encerrar_assinatura_manual\(uuid\)/;
    expect(MIGRATION).toMatch(new RegExp(`revoke execute on function ${f.source} from public`));
    expect(MIGRATION).toMatch(new RegExp(`revoke execute on function ${f.source} from anon`));
    expect(MIGRATION).toMatch(new RegExp(`grant\\s+execute on function ${f.source} to authenticated`));
  });

  it('não monta SQL com texto vindo de fora', () => {
    expect(ENCERRAR).not.toMatch(/execute\s+(format|'|")/i);
    expect(ENCERRAR).not.toMatch(/quote_ident/);
  });
});
