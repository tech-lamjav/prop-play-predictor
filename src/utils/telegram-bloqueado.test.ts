import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================================
// Quem bloqueou o bot para de ser tentado (#466)
// ============================================================================
// Bloquear o bot no Telegram faz a API responder 403 naquele chat, para sempre.
// O `telegram_chat_id` continua no banco, então o produto seguia tentando: o
// daily todo dia, o resumo toda segunda, a liquidação de 15 em 15 minutos.
//
// Nada quebrava — e é por isso que passou despercebido até o primeiro envio
// real da oferta pós-teste, em 17/09/2026, voltar 403. O estrago era de
// MEDIÇÃO: cada tentativa contava como enviada no funil de alguém que nunca
// receberia, diluindo a taxa de clique de todas as mensagens.
//
// ⚠️ ESTE TESTE LÊ TEXTO, como as outras guardas de borda e de SQL daqui: as
// funções são Deno e o CI não as executa neste projeto. O que ele prova é que
// a regra está escrita nos oito lugares e que ninguém voltou a chamar o
// Telegram por fora. O comportamento foi conferido à mão contra a API real.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');
const ler = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8');

/**
 * Espaço normalizado, como faz a guarda da vigência do limiar.
 *
 * Sem isto, a asserção vira refém de formatação: uma quebra de linha diferente
 * derruba um teste que deveria falar sobre ORDEM, e o time aprende a consertar
 * teste em vez de ler o que ele diz.
 */
const norm = (s: string) => s.replace(/\s+/g, ' ');

const MIGRATION = ler('supabase/migrations/20260918100000_151_telegram_bloqueado.sql');
const REMETENTE = ler('supabase/functions/shared/telegram.ts');
const WEBHOOK = ler('supabase/functions/telegram-webhook/index.ts');

/** As oito que falam com USUÁRIO. As de admin ficam de fora, de propósito. */
const FUNCOES_DE_USUARIO = [
  'notify-settlement',
  'notify-opportunities',
  'notify-published-opportunities',
  'notify-weekly-summary',
  'notify-kickoff',
  'notify-handoff',
  'winback-backfill',
  'notify-futebol-oferta',
];

/** Estas mandam DM para o ADMIN: não há usuário do outro lado para marcar. */
const FUNCOES_DE_ADMIN = ['ingest-fixtures', 'ops-healthcheck'];

describe('a marca no banco', () => {
  it('existe como coluna, e não como chat id apagado', () => {
    // Apagar o chat id faria toda consulta pular a pessoa sem editar nenhuma
    // delas. Mas o webhook acha o usuário PELO chat id: quem desbloqueasse
    // voltaria como desconhecido, e o caminho de volta morreria no uso.
    expect(MIGRATION).toContain('add column if not exists telegram_bloqueado_em timestamptz');
    expect(MIGRATION).toContain('comment on column public.users.telegram_bloqueado_em');
  });
});

describe('o remetente compartilhado', () => {
  it('marca no 403, e só no 403', () => {
    // 403 é "essa pessoa não me quer", e vale até ela agir. 5xx e timeout são
    // transitórios: marcar neles tiraria da lista quem só teve azar de rede.
    //
    // Por posição, e não por vizinhança: a primeira versão deste teste olhava
    // 400 caracteres depois do `if`, e uma implementação que marcasse ANTES da
    // checagem — ou seja, em todo erro — passava verde do mesmo jeito.
    const fonte = norm(REMETENTE);
    // A âncora é o `if (res.ok)`, e não o retorno inteiro que ela abria.
    //
    // O caminho feliz deixou de caber numa linha quando o envio passou a LER o
    // corpo da resposta para guardar o `message_id` do Telegram — que antes era
    // descartado, e com ele o único identificador capaz de casar um evento
    // nosso com a mensagem que existe no aplicativo da pessoa.
    //
    // O que este teste defende é a ORDEM — feliz, depois 403, depois a marca,
    // depois o "falhou" —, e ela continua sendo verificada linha a linha abaixo.
    // Amarrar a asserção ao formato exato do retorno transformava uma escolha
    // de escrita em requisito, e foi o que quebrou aqui.
    const sucesso = fonte.indexOf('if (res.ok) {');
    const checa403 = fonte.indexOf('if (res.status === 403)');
    const marca = fonte.indexOf('marcarBloqueado(supabase, userId)');
    const falhou = fonte.indexOf('desfecho: "falhou"');

    expect(sucesso, 'o caminho feliz sai primeiro').toBeGreaterThan(-1);
    expect(checa403, 'falta a checagem do 403').toBeGreaterThan(sucesso);
    expect(marca, 'a marca tem de vir DEPOIS da checagem do 403').toBeGreaterThan(checa403);
    expect(falhou, 'o "falhou" é a saída de baixo').toBeGreaterThan(marca);

    // E uma vez só: duas chamadas significariam uma fora do ramo do 403.
    expect(fonte.split('marcarBloqueado(supabase, userId)').length - 1).toBe(1);
  });

  it('deixa medição: o bloqueio vira evento', () => {
    // Metade do motivo desta mudança é poder responder "quantas pessoas
    // bloquearam o bot, e quando". Sem evento, a resposta não existe em lugar
    // nenhum — e a mudança que nasceu para consertar métrica não deixaria métrica.
    expect(REMETENTE).toContain('"telegram_bloqueado_detectado"');
  });

  it('a lista é paginada e a falha aparece no log', () => {
    // Sem `range`, o PostgREST corta em mil linhas e não avisa — a lista viria
    // incompleta e as pessoas do fim voltariam a ser tentadas, sem erro nenhum.
    // E erro engolido faz "ninguém está marcado" e "não consegui perguntar"
    // virarem a mesma linha de log.
    // E ORDENADA: paginar sem ORDER BY é pior que não paginar, porque o Postgres
    // não promete a mesma ordem entre páginas e linhas somem sem erro nenhum.
    expect(norm(REMETENTE)).toContain('.order("id") .range(de, de + PAGINA - 1)');
    expect(REMETENTE).toContain('console.error("carregarBloqueados falhou');
  });

  it('não lança quando a pessoa bloqueou: é pulo, não falha', () => {
    // Tratar como exceção empurra cada chamador a inventar o próprio jeito de
    // distinguir os dois — que é como a regra se perde de novo.
    expect(REMETENTE).toContain('desfecho: "bloqueada"');
    expect(REMETENTE).toContain('desfecho: "falhou"');
    expect(REMETENTE).not.toContain('throw new Error');
  });

  it('não sobrescreve a data de quem já estava marcado', () => {
    expect(REMETENTE).toContain('.is("telegram_bloqueado_em", null)');
  });

  it('e sabe desmarcar', () => {
    expect(REMETENTE).toContain('export async function limparBloqueio');
    expect(REMETENTE).toContain('telegram_bloqueado_em: null');
  });
});

describe('as oito funções que falam com usuário', () => {
  for (const nome of FUNCOES_DE_USUARIO) {
    const fonte = ler(`supabase/functions/${nome}/index.ts`);

    it(`${nome} manda pelo remetente compartilhado`, () => {
      expect(fonte).toContain('from "../shared/telegram.ts"');
      expect(fonte).toContain('enviarDm(');
    });

    it(`${nome} não chama o Telegram por fora`, () => {
      // É por aqui que a regra vazaria: um `fetch` novo, copiado de um vizinho
      // antigo, volta a tentar para sempre quem bloqueou.
      expect(fonte).not.toContain('api.telegram.org/bot');
    });

    if (nome !== 'notify-kickoff') {
      it(`${nome} pula quem está marcado, antes de tentar`, () => {
        // Marcar sem pular não resolve nada: a tentativa continua saindo todo
        // dia. É esta linha que faz a régua parar de bater na porta fechada.
        expect(fonte).toContain('carregarBloqueados(');
      });
    }
  }
});

describe('liquidar e avisar são coisas separadas', () => {
  const SETTLEMENT = ler('supabase/functions/notify-settlement/index.ts');

  it('a lista de candidatos não é filtrada pelos bloqueados', () => {
    // A primeira versão filtrava aqui, e o efeito era grave e calado: a aposta
    // nunca liquidava, a banca e o ROI congelavam no site, e o mesmo candidato
    // voltava a cada 15 minutos para sempre. Afirmado pela AUSÊNCIA do filtro,
    // e não pela presença de um apelido de variável, que é detalhe de escrita.
    expect(norm(SETTLEMENT)).not.toContain(
      'todosCandidatos.filter( (bet) => !bloqueadosSet.has(bet.user_id) )',
    );
  });

  it('e a decisão de não mandar vem DEPOIS de liquidar', () => {
    // A ordem é a regra inteira: liquidar é o produto funcionando, e o histórico
    // no site é de quem bloqueou também. Avisar é o que ela recusou.
    const fonte = norm(SETTLEMENT);
    const liquida = fonte.indexOf('const ok = await settleBet(supabase, bet, m, verdict);');
    const pula = fonte.indexOf('if (bloqueado) return "bloqueado";');
    expect(liquida, 'o settleBet sumiu do autoSettle').toBeGreaterThan(-1);
    expect(pula, 'o pulo tem de vir depois da liquidação').toBeGreaterThan(liquida);
  });
});

describe('o buraco conhecido do aviso de kickoff', () => {
  // Fica AFIRMADO em teste, e não escondido num comentário: a consulta
  // `get_due_kickoff_notifications` (migration 073) devolve só o chat do dono
  // do bolão, sem id de usuário. Sem id não dá para consultar a lista nem para
  // marcar ninguém — ali o 403 é só pulo da rodada.
  //
  // Quando alguém acrescentar o id do dono na consulta, este teste vai falhar,
  // e é para falhar mesmo: é o lembrete de apagar esta exceção.
  it('ainda manda sem id de usuário, então não pula nem marca', () => {
    // Afirmado pelo que o código FAZ — passar nulo no lugar do id — e não pela
    // presença da palavra "null" no arquivo, que não prova nada.
    const fonte = norm(ler('supabase/functions/notify-kickoff/index.ts'));
    expect(fonte).not.toContain('carregarBloqueados(');
    expect(fonte).toContain('sendTelegramMessage( supabase, null, row.owner_chat_id,');
  });
});

describe('as duas de admin ficam de fora', () => {
  for (const nome of FUNCOES_DE_ADMIN) {
    it(`${nome} não usa o remetente, porque não há usuário do outro lado`, () => {
      // Afirmar o que elas NÃO fazem, e não como elas mandam: a primeira versão
      // exigia `api.telegram.org` nelas, o que transformava o código velho em
      // requisito e quebraria no dia em que alguém o melhorasse.
      const fonte = ler(`supabase/functions/${nome}/index.ts`);
      expect(fonte).not.toContain('from "../shared/telegram.ts"');
    });
  }
});

describe('o caminho de volta', () => {
  it('chegar mensagem da pessoa tira a marca', () => {
    // O Telegram não entrega nada de um chat bloqueado: se a mensagem chegou,
    // ela desbloqueou. Sem isto, a marca vira sentença.
    expect(WEBHOOK).toContain('limparBloqueio(supabase, user.id)');
  });

  it('tocar num botão também tira — que é como a maioria volta', () => {
    // Neste bot quase toda interação é botão, e o ramo de callback responde e sai
    // antes do caminho comum. Sem limpeza própria, a marca virava sentença para
    // quem volta clicando em vez de digitar.
    const callbacks = ler('supabase/functions/telegram-webhook/callbacks.ts');
    expect(callbacks).toContain('limparBloqueio(supabase, user.id)');
  });

  it('compartilhar o contato de novo também tira', () => {
    expect(WEBHOOK).toContain('limparBloqueio(supabase, userMatch.id)');
  });

  it('reconectar pelo site também tira', () => {
    // O ramo do deep link responde e sai antes do caminho comum. Sem uma
    // limpeza própria, quem desbloqueasse e refizesse o vínculo continuaria
    // marcado, tendo feito tudo certo.
    expect(WEBHOOK).toContain('limparBloqueio(supabase, tok.user_id)');
  });
});
