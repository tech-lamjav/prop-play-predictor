import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================================
// A oferta depois do teste do futebol (migration 150)
// ============================================================================
// Uma DM, uma vez, para quem vinculou o Telegram, teve o teste encerrado há 24
// horas e não assinou. É a primeira mensagem de VENDA do bot, e por isso as
// guardas aqui não são sobre o texto — são sobre quem recebe, quantas vezes e
// para onde o botão leva.
//
// ⚠️ O QUE ESTE TESTE PROVA, E O QUE NÃO PROVA.
// Ele prova que o SQL e a função de borda DIZEM a coisa certa. Este repositório
// não tem harness de SQL — sem `supabase/tests`, sem pgtap, e o CI não sobe
// banco —, então é a mesma natureza das outras guardas daqui:
// `futebol-vigencia-do-limiar.test.ts`, `shape-file-futebol.test.ts` e
// `funcao-sem-revoke.test.ts` também leem texto.
//
// O COMPORTAMENTO foi provado à mão contra um Postgres 16 de verdade, em
// contêiner descartável, com seis usuários montados para cair um em cada ramo:
// o alvo certo, a coorte antiga, o que virou assinante, o que venceu há duas
// horas, o sem Telegram e o com teste correndo. Isso não cabe no CI, mas cabe
// escrito aqui.
//
// ⚠️ POR QUE CLÁUSULA A CLÁUSULA NOS ALVOS, E CORPO INTEIRO NA RESERVA.
// São riscos diferentes. Nos alvos, o jeito de errar é APAGAR uma condição — e
// cada condição apagada é uma pessoa recebendo oferta que não deveria: quem já
// assinou, quem pediu silêncio, quem já recebeu. Substring pega remoção, que é
// o risco real, e uma lista de `and` não tem direção para inverter. Na reserva
// o risco é de ORDEM: registrar depois de mandar, ou devolver antes de contar
// as linhas, continua contendo as mesmas palavras e passa a mandar duas vezes.
// Ali vale o corpo inteiro.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');
const MIGRATION = resolve(
  RAIZ,
  'supabase/migrations/20260917200000_150_futebol_oferta_pos_teste.sql',
);
const FUNCAO = resolve(RAIZ, 'supabase/functions/notify-futebol-oferta/index.ts');
const GO = resolve(RAIZ, 'supabase/functions/go/index.ts');

const sql = readFileSync(MIGRATION, 'utf8');
const borda = readFileSync(FUNCAO, 'utf8');
const go = readFileSync(GO, 'utf8');

/** O SQL sem os comentários, para nenhuma guarda passar por causa de prosa. */
const sqlSemComentario = sql
  .split(/\r?\n/)
  .filter((l) => !l.trimStart().startsWith('--'))
  .join('\n');

/** O corpo de uma função, sem comentários e com espaço normalizado. */
function corpo(abre: string): string {
  const inicio = sqlSemComentario.indexOf(abre);
  expect(inicio, `não achei ${abre}`).toBeGreaterThan(-1);
  const depois = sqlSemComentario.slice(inicio);
  const primeiro = depois.indexOf('as $function$');
  const ultimo = depois.indexOf('$function$;');
  expect(primeiro, 'função sem corpo').toBeGreaterThan(-1);
  return depois
    .slice(primeiro + 'as $function$'.length, ultimo)
    .replace(/\s+/g, ' ')
    .trim();
}

describe('quem recebe a oferta', () => {
  const alvos = corpo('create or replace function public.get_futebol_oferta_pos_teste_targets(');

  // Cada linha destas é uma pessoa que NÃO pode receber. Apagar qualquer uma
  // passa despercebido em revisão e só aparece como reclamação.
  const exigencias: [string, string][] = [
    ['tem Telegram vinculado, o mais perto de onboarding que este banco tem', 'u.telegram_chat_id is not null'],
    ['entrou na coorte recortada, e não na lista fria inteira', 'u.futebol_trial_started_at >= p_desde'],
    ['o teste já acabou há p_horas', 'u.futebol_trial_ends_at <= now() - make_interval(hours => p_horas)'],
    [
      'não tem acesso vigente, pela mesma função que o resto do produto usa',
      'not public.futebol_acesso_vigente(u.futebol_subscription_status, u.futebol_trial_ends_at)',
    ],
    ['não mandou calar TUDO', 'coalesce(u.settlement_reminders_muted, false) = false'],
    ['não pediu para parar de receber oferta', 'coalesce(u.futebol_ofertas_muted, false) = false'],
    ['ainda não recebeu esta mensagem', 'from public.futebol_oferta_pos_teste_notifications n'],
  ];

  for (const [oQue, trecho] of exigencias) {
    it(`só entra quem ${oQue}`, () => {
      expect(alvos).toContain(trecho);
    });
  }

  it('o opt-out da oferta SOMA ao silêncio geral, não substitui', () => {
    // Chave própria porque venda não é serviço: quem recusa oferta continua
    // querendo o lembrete da própria aposta. Mas quem calou tudo não pediu
    // exceção para venda — então as duas condições convivem.
    expect(alvos).toContain('futebol_ofertas_muted');
    expect(alvos).toContain('settlement_reminders_muted');
  });

  it('não copia a regra de acesso com uma checagem de premium solta', () => {
    // `futebol_acesso_vigente` já devolve verdadeiro para assinante, qualquer
    // que seja a data do teste antigo. Uma segunda checagem aqui é a cópia por
    // onde os dois lados começam a divergir.
    expect(alvos).not.toContain("<> 'premium'");
  });
});

describe('uma por pessoa, para sempre', () => {
  it('a tabela tem o usuário como chave primária', () => {
    expect(sqlSemComentario).toContain('user_id      uuid primary key references public.users(id)');
  });

  it('separa reservada de enviada, e guarda o erro', () => {
    // A reserva nasce antes do envio: sem colunas separadas, uma linha reservada
    // e não enviada é indistinguível de uma entregue.
    expect(sqlSemComentario).toContain('reservada_em timestamptz not null default now()');
    expect(sqlSemComentario).toContain('enviada_em   timestamptz');
    expect(sqlSemComentario).toContain('erro         text');
  });

  it('a reserva insere primeiro e só depois diz se foi ela que inseriu', () => {
    // Corpo inteiro de propósito: registrar DEPOIS de mandar, ou devolver antes
    // de contar as linhas, usa as mesmas palavras e manda duas vezes.
    expect(corpo('create or replace function public.claim_futebol_oferta_pos_teste(')).toBe(
      'declare v_reservou boolean; begin ' +
        'insert into public.futebol_oferta_pos_teste_notifications (user_id) values (p_user_id) ' +
        'on conflict (user_id) do nothing; ' +
        'get diagnostics v_reservou = row_count; return v_reservou; end;',
    );
  });

  it('a vaga volta no 403, e só nele', () => {
    // O que decide não é "deu erro", é o que o erro PROVA. 403 é o Telegram
    // recusando: não entregou, e a oferta é uma por pessoa para sempre — manter
    // a reserva queimaria a chance de quem desbloquear amanhã. Timeout não prova
    // nada, e lá a reserva fica, porque dúvida virando segundo envio é o pior
    // desfecho possível numa mensagem de venda.
    expect(sqlSemComentario).toContain(
      'create or replace function public.release_futebol_oferta_pos_teste(',
    );

    // Espaço normalizado: a asserção fala de ORDEM, e não pode ser derrubada por
    // uma quebra de linha diferente.
    const fonte = borda.replace(/\s+/g, ' ');
    const bloqueada = fonte.indexOf('if (r.desfecho === "bloqueada")');
    const solta = fonte.indexOf('rpc( "release_futebol_oferta_pos_teste"');
    const catchDoEnvio = fonte.indexOf('} catch (e) {');

    expect(bloqueada, 'falta o ramo do bloqueado').toBeGreaterThan(-1);
    expect(solta, 'a devolução tem de estar no ramo do 403').toBeGreaterThan(bloqueada);
    expect(solta, 'e nunca no catch, que trata o timeout').toBeLessThan(catchDoEnvio);
  });
});

describe('a migration não liga a mensagem sozinha', () => {
  it('não agenda cron nenhum', () => {
    // Migration aplica sozinha no merge neste repositório. Mensagem de venda
    // que começa a sair por efeito colateral de um merge é o acidente que esta
    // guarda existe para impedir.
    expect(sqlSemComentario).not.toContain('cron.schedule');
    expect(sql).toContain('-- select cron.schedule(');
  });

  it('as três funções novas nascem fechadas para anon e authenticated', () => {
    for (const f of [
      'get_futebol_oferta_pos_teste_targets',
      'claim_futebol_oferta_pos_teste',
      'release_futebol_oferta_pos_teste',
    ]) {
      expect(sqlSemComentario, f).toContain(`revoke execute on function public.${f}`);
      expect(sqlSemComentario, f).toContain(`grant execute on function public.${f}`);
    }
  });
});

describe('a função de borda', () => {
  it('o modo padrão não manda nada', () => {
    expect(borda).toContain('const mode = url.searchParams.get("mode") || "report"');
  });

  it('respeita a janela de silêncio do bot, pelo fuso nomeado', () => {
    // O teste dura 48h e pode vencer de madrugada: sem isto, a oferta sai às 3.
    // E o fuso vem de `America/Sao_Paulo`, não de uma subtração de três horas
    // que passa a mentir no dia em que voltar o horário de verão.
    expect(borda).toContain('const QUIET_START = 9');
    expect(borda).toContain('const QUIET_END = 23');
    expect(borda).toContain('timeZone: "America/Sao_Paulo"');
    expect(borda).toContain('hora >= QUIET_START && hora < QUIET_END');
  });

  it('reserva ANTES de enviar', () => {
    const reserva = borda.indexOf('claim_futebol_oferta_pos_teste');
    const envio = borda.indexOf('await enviar(');
    expect(reserva).toBeGreaterThan(-1);
    expect(envio).toBeGreaterThan(-1);
    expect(reserva).toBeLessThan(envio);
  });

  it('quando o envio falha, grava o erro e mantém a reserva', () => {
    expect(borda).toContain('erro: motivo.slice(0, 500)');
  });

  it('valida os dois recortes que vêm pela URL', () => {
    // `horas` negativo incluiria teste ainda correndo; data podre viraria uma
    // régua silenciosamente vazia.
    expect(borda).toContain('Number.isNaN(Date.parse(desdeParam))');
    expect(borda).toContain('!Number.isFinite(horas) || horas < 1');
  });

  it('diz quantos ficaram para a próxima rodada', () => {
    expect(borda).toContain('ficaram_para_a_proxima');
  });

  it('o texto diz como parar de receber', () => {
    // Quem quer sair tem de conseguir sair lendo uma vez, no corpo da mensagem.
    expect(borda).toContain('/ofertas');
  });
});

describe('o botão leva para o checkout, e o clique é medido', () => {
  it('passa pelo redirecionador, como todas as DMs', () => {
    // O mapa do bot exige evento de enviada E de clicada; o clique só existe se
    // o link passar pelo `go`.
    expect(borda).toContain('trackedUrl(alvo.user_id, "assinar", CAMPANHA)');
    expect(borda).toContain('futebol_oferta_pos_teste_enviada');
  });

  it('o destino assinar existe no redirecionador e aponta para o checkout', () => {
    // `/futebol/comecar` é a landing de aquisição, e a CTA dela é começar de
    // graça — o contrário do que esta mensagem foi decidida para fazer.
    expect(go).toContain('if (dest === "assinar") return `${SITE}/futebol/assinar?${utm}`');
    expect(borda).not.toContain('futebol/comecar');
  });

  it('a campanha é própria, para não mexer na régua de reativação do daily', () => {
    expect(borda).toContain('const CAMPANHA = "oferta_pos_teste"');
  });
});
