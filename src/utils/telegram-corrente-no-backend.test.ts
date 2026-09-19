import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================================
// A corrente que liga envio, clique e chegada
// ============================================================================
// O defeito que isto conserta: o `trace_id` do envio e o do clique NUNCA foram
// o mesmo. O envio nascia com um trace por RODADA do cron — o mesmo para
// centenas de pessoas — e o `go` gerava outro na hora do clique. Casar os dois
// no PostHog só era possível por `distinct_id` mais horário, que é adivinhação.
//
// ⚠️ ESTE TESTE LÊ TEXTO, no mesmo padrão do `telegram-bloqueado.test.ts`: as
// funções são Deno e o vitest não as executa. O comportamento das funções puras
// é testado de verdade em `supabase/functions/tests/atribuicao.test.ts`, que só
// roda no CI (`deno test`). O que esta guarda prova é que a corrente está
// LIGADA nas quatro pontas — e ela existe porque, sem ela, remover o
// `delivery_id` do link não quebra teste nenhum aqui na máquina.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');
const ler = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8');
const norm = (s: string) => s.replace(/\s+/g, ' ');

/**
 * O fonte sem os comentários.
 *
 * Mesma precaução do guarda da oferta pós-teste, que tira a prosa do SQL "para
 * nenhuma guarda passar por causa de comentário". Aqui o problema é o inverso e
 * igualmente traiçoeiro: a asserção de que o id NÃO é sorteado falhava por
 * causa do comentário que EXPLICA por que sortear seria errado. Afirmar sobre
 * prosa é afirmar sobre o que alguém escreveu, não sobre o que o código faz.
 */
const semComentarios = (s: string) =>
  s
    .split(/\r?\n/)
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n');

const ATRIBUICAO = ler('supabase/functions/shared/atribuicao.ts');
const ATRIBUICAO_CODIGO = semComentarios(ATRIBUICAO);
const LINKS = ler('supabase/functions/shared/links.ts');
const GO = ler('supabase/functions/go/index.ts');
const DIARIO = ler('supabase/functions/notify-opportunities/index.ts');
const PUBLICADAS = ler('supabase/functions/notify-published-opportunities/index.ts');

describe('as chaves nascem num lugar só', () => {
  it('o módulo exporta as três chaves da corrente', () => {
    expect(ATRIBUICAO).toContain('export async function chaveDoLote');
    expect(ATRIBUICAO).toContain('export async function chaveDeEntrega');
    expect(ATRIBUICAO).toContain('export async function chaveDoLink');
  });

  it('a entrega é derivada, e não sorteada', () => {
    // `crypto.randomUUID()` aqui seria o defeito: `deliverPending` RETOMA
    // entregas de rodadas anteriores, e a mesma tentativa lógica viraria duas
    // entregas no painel — toda taxa de clique cairia pela metade sem nada ter
    // mudado no produto.
    expect(norm(ATRIBUICAO_CODIGO)).toContain(
      'digestCurto(`entrega:${campanha}:${lote}:${userId}`)',
    );
    expect(ATRIBUICAO_CODIGO).not.toContain('randomUUID');
  });
});

describe('o link carrega a atribuição', () => {
  it('o `trackedUrl` aceita a atribuição e a põe na URL', () => {
    expect(LINKS).toContain('atribuicao?: AtribuicaoDoLink');
    expect(norm(LINKS)).toContain('dl: atribuicao.deliveryId');
    expect(norm(LINKS)).toContain('bt: atribuicao.batchId');
    expect(norm(LINKS)).toContain('lk: atribuicao.linkId');
  });

  it('a assinatura NÃO foi alargada', () => {
    // A decisão de compatibilidade mais fácil de quebrar sem perceber. A
    // assinatura continua sendo sobre `<user>:<dest>` porque mensagem já
    // entregue no celular de alguém não se atualiza: assinar campo novo
    // invalidaria de uma vez todos os links em circulação.
    //
    // E é seguro: estes parâmetros são de MEDIÇÃO, não de autorização. Forjá-los
    // suja um relatório; não dá acesso a nada.
    expect(LINKS).toContain('hmacHex(`${userId}:${dest}`)');
  });

  it('a atribuição é opcional, para o link antigo continuar valendo', () => {
    expect(norm(LINKS)).toContain('if (!atribuicao) return base;');
  });
});

describe('o redirecionador fecha a corrente', () => {
  it('lê as três chaves do link', () => {
    expect(GO).toContain('url.searchParams.get("dl")');
    expect(GO).toContain('url.searchParams.get("bt")');
    expect(GO).toContain('url.searchParams.get("lk")');
  });

  it('exige o trio: meia atribuição é pior que nenhuma', () => {
    // Meia atribuição parece completa num relatório, e é aí que ela engana.
    expect(norm(GO)).toContain('dl && bt && lk');
  });

  it('usa a entrega como trace, em vez de gerar um órfão', () => {
    // Era ESTE o defeito: `generateTraceId()` no clique nascia sem nada do
    // outro lado com que se casar.
    expect(norm(GO)).toContain('atribuicao?.deliveryId ?? generateTraceId()');
  });

  it('o evento de clique carrega a corrente', () => {
    expect(GO).toContain('delivery_id: atribuicao?.deliveryId');
    expect(GO).toContain('batch_id: atribuicao?.batchId');
    expect(GO).toContain('link_id: atribuicao?.linkId');
  });

  it('a campanha passa por validação antes de virar propriedade', () => {
    // O `c=` é texto CRU da URL: qualquer um monta um link do `go` com a
    // campanha que quiser. Sem a porta, esse texto entrava direto no
    // `campaign_type` e criava uma fatia nova em todo gráfico que quebra por
    // campanha — até o gráfico ficar ilegível.
    expect(GO).toContain('campaign_type: campanhaValida(campaign)');
    expect(ATRIBUICAO).toContain('export function campanhaValida');
  });
});

describe('o registro de aposta pelo bot', () => {
  const CALLBACKS = ler('supabase/functions/telegram-webhook/callbacks.ts');
  const WEBHOOK = ler('supabase/functions/telegram-webhook/index.ts');

  for (const [nome, fonte] of [
    ['o botão de unidade', CALLBACKS],
    ['a resposta livre', WEBHOOK],
  ] as const) {
    it(`${nome} diz de qual JOGO era a aposta`, () => {
      // Sem isto, o registro pelo bot não casa com o funil da tela, que
      // identifica tudo por jogo e oportunidade.
      expect(fonte).toContain('game_id: pick.fixture_id');
    });
  }

  it('e NÃO inventa `opportunity_id` no bot', () => {
    // Afirmado pela AUSÊNCIA, de propósito. A chave canônica é
    // `fixture|mercado|saída|linha`, e `daily_opportunity_picks` guarda a saída
    // dentro de `bet_description`, em texto livre — não há de onde montá-la.
    // Quando alguém estruturar saída e linha na tabela, este teste falha, e é
    // para falhar: é o lembrete de fechar a lacuna e apagar esta exceção.
    expect(CALLBACKS).not.toContain('opportunity_id:');
    expect(WEBHOOK).not.toContain('opportunity_id:');
  });

  it('repassa a atribuição ao site, senão a chegada não tem o que reportar', () => {
    expect(GO).toContain('paramsDaAtribuicao');
    expect(GO).toContain('utm_medium');
  });
});

describe('as duas campanhas emitem a corrente no envio', () => {
  for (const [nome, fonte] of [
    ['o diário', DIARIO],
    ['as publicadas', PUBLICADAS],
  ] as const) {
    it(`${nome} deriva lote e entrega`, () => {
      expect(fonte).toContain('chaveDoLote(');
      expect(fonte).toContain('chaveDeEntrega(');
      expect(fonte).toContain('chaveDoLink(');
    });

    it(`${nome} manda delivery_id e batch_id no evento de envio`, () => {
      expect(fonte).toContain('delivery_id: deliveryId');
      expect(fonte).toContain('batch_id: batchId');
    });

    it(`${nome} guarda o message_id que o Telegram devolveu`, () => {
      expect(fonte).toContain('telegram_message_id: messageId');
    });

    it(`${nome} não chama o envio "lido" nem "recebido"`, () => {
      // A API do Telegram não dá confirmação de leitura. Nomear assim
      // convidaria a ler o número como audiência — e ninguém desconfiaria.
      expect(fonte).toContain('sent_status: "success"');
      expect(fonte).not.toContain('read_status');
      expect(fonte).not.toContain('delivered_status');
    });
  }
});
