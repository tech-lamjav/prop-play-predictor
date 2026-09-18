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
    //
    // ⚠️ A 142 solta o `not null` do `vence_em` para caber VITALÍCIA, e este
    // guarda continua verde porque lê o arquivo da 131, que é história. Quem
    // for mexer nisto olha `crm-assinatura-vitalicia-migration.test.ts`, que
    // guarda o estado vigente.
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
    // O histórico é o que responde "quantas assinaturas manuais a gente deu este mês" e
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
   *
   * ⚠️ Lê a versão VIGENTE da função, que é a da 142, e não a da 131 guardada
   * acima. A 142 recria a função com um parâmetro novo, então é ela que está no
   * banco: um guarda apontado para a 131 aqui vigiaria código morto, e a
   * divergência que ele existe para pegar passaria batida.
   */
  const CONCESSOES = readFileSync(
    resolve(__dirname, '../../../supabase/functions/shared/concessoes.ts'),
    'utf8',
  );

  const DAR_VIGENTE = comando(
    lerMigration('20260916180000_142_crm_assinatura_vitalicia.sql'),
    /create or replace function public\.crm_dar_assinatura_manual/,
    '$function$;',
  );

  /** As colunas que `concessoes.ts` dá a um plano. */
  function noStripe(plano: string): string[] {
    const trecho = CONCESSOES.slice(CONCESSOES.indexOf(`${plano}: [`));
    const lista = trecho.slice(0, trecho.indexOf(']'));
    return [...lista.matchAll(/"([a-z_]+_subscription_status)"/g)].map((m) => m[1]).sort();
  }

  /** As colunas que o ramo do plano na migration escreve. */
  function naMigration(plano: string): string[] {
    const ramo = DAR_VIGENTE?.slice(DAR_VIGENTE.indexOf(`p_plano = '${plano}'`)) ?? '';
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

  /*
   * A função de registrar pagamento libera os acessos do plano de novo, e é
   * mais uma cópia da escada. Sem esta comparação ela podia liberar menos que o
   * Stripe e ninguém saberia: a concessão estava coberta, o pagamento não.
   */
  const REGISTRAR_VIGENTE = comando(
    lerMigration('20260916180000_142_crm_assinatura_vitalicia.sql'),
    /create or replace function public\.crm_registrar_pagamento/,
    '$function$;',
  );

  /** As colunas que o ramo do plano no registro de pagamento libera. */
  function noPagamento(plano: string): string[] {
    const ramo = REGISTRAR_VIGENTE?.slice(REGISTRAR_VIGENTE.indexOf(`v_plano = '${plano}'`)) ?? '';
    const ate = ramo.indexOf('where id = v_user_id');
    return [...ramo.slice(0, ate).matchAll(/([a-z_]+_subscription_status)/g)]
      .map((m) => m[1])
      .filter((c, i, todas) => todas.indexOf(c) === i)
      .sort();
  }

  for (const plano of PLANOS_A_VENDER) {
    it(`${plano}: registrar pagamento libera o mesmo que o Stripe`, () => {
      expect(REGISTRAR_VIGENTE).not.toBeNull();
      expect(noPagamento(plano)).toEqual(noStripe(plano));
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

describe('a escada de rebaixamento da 132, e por que ela saiu', () => {
  /**
   * ⚠️ HISTÓRIA, e não comportamento atual. Tudo aqui descreve a migration
   * 132, lida pelo NOME do arquivo — e ela deixou de ser vigente na 159.
   *
   * O nome antigo desta variável era `ENCERRAR_VIGENTE`, e ele mentia: prometia
   * o estado atual e conferia código removido. Os dois eixos da revisão
   * apontaram no mesmo lugar.
   *
   * Fica registrado porque a escada foi um conserto REAL, e apagar o teste
   * apagaria a memória dele: a primeira versão lia o plano da linha, guardava
   * numa variável e nunca a usava — zerava os três acessos de uma vez, e
   * encerrar um "Entrada" apagava futebol e análises que tinham vindo dos
   * interruptores por produto. A variável sem leitor era a pista.
   *
   * A escada estava certa enquanto o encerramento mexia em acesso. Na 159 ele
   * parou de mexer, porque a pergunta que ele fazia — "esta pessoa paga no
   * Stripe?" — não tem resposta confiável no nosso banco, e errar nela
   * derrubava o produto de quem estava pagando.
   */
  const ENCERRAR_132 = comando(
    lerMigration('20260913160000_132_crm_encerrar_por_plano.sql'),
    /create or replace function public\.crm_encerrar_assinatura_manual/,
    '$function$;',
  );

  it('usa o plano que estava guardado na linha', () => {
    expect(ENCERRAR_132).toMatch(/v_plano/);
    // Lido, e não só atribuído: um `if` sobre ele é a prova de que ele decide
    // alguma coisa.
    expect(ENCERRAR_132).toMatch(/if v_plano = |case v_plano/);
  });

  it('cada plano tem o próprio ramo de saída', () => {
    for (const plano of PLANOS_A_VENDER) {
      expect(ENCERRAR_132, plano).toContain(`'${plano}'`);
    }
  });

  it('encerrar um Entrada não encosta no futebol nem nas análises', () => {
    const ramo = ENCERRAR_132?.slice(ENCERRAR_132.indexOf("v_plano = 'entrada'")) ?? '';
    const ate = ramo.indexOf('where id = v_user_id');
    const escrita = ramo.slice(0, ate);
    expect(escrita).toMatch(/betinho_subscription_status/);
    expect(escrita).not.toMatch(/futebol_subscription_status/);
    expect(escrita).not.toMatch(/analytics_subscription_status/);
  });

  it('encerrar um Essencial não encosta nas análises', () => {
    const ramo = ENCERRAR_132?.slice(ENCERRAR_132.indexOf("v_plano = 'essencial'")) ?? '';
    const escrita = ramo.slice(0, ramo.indexOf('where id = v_user_id'));
    expect(escrita).toMatch(/futebol_subscription_status/);
    expect(escrita).toMatch(/betinho_subscription_status/);
    expect(escrita).not.toMatch(/analytics_subscription_status/);
  });

  it('⚠️ e essa escada SAIU na 159, junto com o rebaixamento', () => {
    // Este bloco inteiro descreve a 132, lida pelo nome do arquivo — então ele
    // continuaria verde mesmo depois de a função mudar. Teste verde guardando
    // código morto é pior que teste nenhum: parece conferido.
    //
    // A escada por plano foi um conserto REAL e fica registrada acima: a
    // primeira versão zerava os três acessos de uma vez, e a pista era uma
    // variável sem leitor. Ela estava certa enquanto o encerramento mexia em
    // acesso.
    //
    // Na 159 o encerramento parou de mexer em acesso, porque a pergunta que
    // ele fazia — "esta pessoa paga no Stripe?" — não tem resposta confiável no
    // nosso banco, e errar nela derrubava o produto de quem estava pagando.
    // Sem rebaixamento, não há escada a percorrer.
    const VIGENTE = comando(
      lerMigration('20260918180000_159_crm_encerrar_nao_tira_acesso.sql'),
      /create or replace function public\.crm_encerrar_assinatura_manual/,
      '$function$;',
    );
    expect(VIGENTE).not.toMatch(/update public\.users/);
    expect(VIGENTE).not.toMatch(/stripe_subscription_id/);
  });

  it('quem paga no Stripe continua com o acesso, por outra razão', () => {
    // O resultado é o mesmo de antes; a razão mudou, e a razão é o conserto.
    //
    // Antes: a função tentava ADIVINHAR quem paga no gateway e poupava essa
    // pessoa. A adivinhação usava um campo escrito num único evento do webhook,
    // então quem comprou por outro caminho era tratado como se não pagasse.
    //
    // Agora: ninguém é poupado porque ninguém é rebaixado. Tirar acesso é
    // decisão separada, nos interruptores por produto.
    expect(ENCERRAR_132).toMatch(/stripe_subscription_id is not null/);
  });
});
