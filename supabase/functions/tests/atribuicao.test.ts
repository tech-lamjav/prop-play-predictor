import { assert, assertEquals } from "./_assert.ts";
import {
  chaveDeEntrega,
  chaveDoLink,
  chaveDoLote,
  oportunidadeDoDestino,
  paramsDaAtribuicao,
} from "../shared/atribuicao.ts";

// ============================================================================
// A corrente que liga envio, clique e chegada (#analytics)
// ============================================================================
// O defeito que isto conserta: o `trace_id` do envio e o do clique NUNCA foram
// o mesmo. O envio nasce com um trace por rodada do cron; o `go` gera outro na
// hora do clique. Casá-los no PostHog só era possível por `distinct_id` mais
// horário — adivinhação, não correlação.
//
// O que estes testes protegem é a propriedade que torna o `delivery_id` útil:
// ele é DETERMINÍSTICO. Se um reenvio produzir id diferente para a mesma
// tentativa lógica, o painel conta duas entregas onde houve uma, e toda taxa de
// clique cai pela metade sem nada ter mudado no produto.
// ============================================================================

Deno.test("a mesma entrega dá sempre o mesmo id", async () => {
  const a = await chaveDeEntrega("daily_opportunities", "2026-09-19", "user-1");
  const b = await chaveDeEntrega("daily_opportunities", "2026-09-19", "user-1");
  assertEquals(a, b, "reenvio da mesma tentativa lógica não pode criar entrega nova");
});

Deno.test("pessoas diferentes, entregas diferentes", async () => {
  const a = await chaveDeEntrega("daily_opportunities", "2026-09-19", "user-1");
  const b = await chaveDeEntrega("daily_opportunities", "2026-09-19", "user-2");
  assert(a !== b, "duas pessoas no mesmo lote não podem compartilhar delivery_id");
});

Deno.test("rodadas diferentes, entregas diferentes", async () => {
  const hoje = await chaveDeEntrega("daily_opportunities", "2026-09-19", "user-1");
  const ontem = await chaveDeEntrega("daily_opportunities", "2026-09-18", "user-1");
  assert(hoje !== ontem, "o envio de ontem e o de hoje são entregas distintas");
});

Deno.test("campanhas diferentes, entregas diferentes", async () => {
  // O diário e o alerta de publicação podem sair para a mesma pessoa no mesmo
  // dia. Sem a campanha na derivação, os dois colidiriam.
  const diario = await chaveDeEntrega("daily_opportunities", "2026-09-19", "user-1");
  const publicada = await chaveDeEntrega("published_opportunities", "2026-09-19", "user-1");
  assert(diario !== publicada);
});

Deno.test("o id tem 16 hex — a mesma largura da assinatura do link", async () => {
  const id = await chaveDeEntrega("daily_opportunities", "2026-09-19", "user-1");
  assertEquals(id.length, 16);
  assert(/^[0-9a-f]{16}$/.test(id), `esperado 16 hex, veio ${id}`);
});

Deno.test("o lote é estável e não se confunde com a entrega", async () => {
  const lote1 = await chaveDoLote("daily_opportunities", "2026-09-19");
  const lote2 = await chaveDoLote("daily_opportunities", "2026-09-19");
  const entrega = await chaveDeEntrega("daily_opportunities", "2026-09-19", "user-1");

  assertEquals(lote1, lote2);
  assert(lote1 !== entrega, "lote e entrega são conceitos diferentes e ids diferentes");
});

Deno.test("cada link da mensagem tem id próprio", async () => {
  // Uma mensagem leva vários links: três picks e um 'ver todas'. Sem isto, os
  // quatro cliques seriam indistinguíveis dentro da mesma entrega, e a
  // pergunta 'qual CTA funciona' ficaria sem resposta.
  const entrega = await chaveDeEntrega("published_opportunities", "lote-7", "user-1");
  const pick = await chaveDoLink(entrega, "jogo-123|match_winner|Home|");
  const board = await chaveDoLink(entrega, "board");

  assert(pick !== board);
  assertEquals(pick, await chaveDoLink(entrega, "jogo-123|match_winner|Home|"));
});

Deno.test("os UTMs obrigatórios sempre saem", () => {
  const pares = paramsDaAtribuicao({
    deliveryId: "d1",
    batchId: "b1",
    linkId: "l1",
    campaignId: "c1",
    campaignType: "published_opportunities",
  });
  const m = new Map(pares);

  assertEquals(m.get("utm_source"), "telegram");
  assertEquals(m.get("utm_medium"), "bot");
  assertEquals(m.get("utm_campaign"), "published_opportunities");
  assertEquals(m.get("delivery_id"), "d1");
  assertEquals(m.get("batch_id"), "b1");
  assertEquals(m.get("link_id"), "l1");
});

Deno.test("opcional ausente não vira a string 'null' na URL", () => {
  // `utm_content=null` do lado do site é um valor que aparece em relatório, e
  // alguém acaba tratando 'null' como um conteúdo de verdade.
  const pares = paramsDaAtribuicao({
    deliveryId: "d1",
    batchId: "b1",
    linkId: "l1",
    campaignId: "c1",
    campaignType: "daily_opportunities",
    segment: null,
    sentAt: null,
    opportunityId: null,
    utmContent: null,
  });
  const chaves = pares.map(([k]) => k);

  assert(!chaves.includes("segment"));
  assert(!chaves.includes("sent_at"));
  assert(!chaves.includes("opportunity_id"));
  assert(!chaves.includes("utm_content"));
});

Deno.test("opcional presente viaja", () => {
  const m = new Map(
    paramsDaAtribuicao({
      deliveryId: "d1",
      batchId: "b1",
      linkId: "l1",
      campaignId: "c1",
      campaignType: "daily_opportunities",
      segment: "B",
      sentAt: "2026-09-19T10:00:00Z",
      opportunityId: "123|match_winner|Home|",
    }),
  );

  assertEquals(m.get("segment"), "B");
  assertEquals(m.get("sent_at"), "2026-09-19T10:00:00Z");
  assertEquals(m.get("opportunity_id"), "123|match_winner|Home|");
});

Deno.test("o destino do bot vira a identidade que o site usa", () => {
  // O `dest` é `jogo-<fixture>|<mercado>|<saída>|<linha>` e o site identifica
  // oportunidade por `<fixture>|<mercado>|<saída>|<linha>`. A MESMA composição,
  // com um prefixo a mais — é isso que faz as duas pontas casarem sem tradutor.
  assertEquals(
    oportunidadeDoDestino("jogo-123|match_winner|Home|"),
    "123|match_winner|Home|",
  );
  assertEquals(
    oportunidadeDoDestino("jogo-77|goals_over_under|Over|2.5"),
    "77|goals_over_under|Over|2.5",
  );
});

Deno.test("tela não é oportunidade", () => {
  // Carimbar `opportunity_id` em board/bank/assinar inventaria uma oportunidade
  // que a mensagem não citou.
  assertEquals(oportunidadeDoDestino("board"), null);
  assertEquals(oportunidadeDoDestino("bank"), null);
  assertEquals(oportunidadeDoDestino("assinar"), null);
});

Deno.test("jogo sem saída também não é oportunidade", () => {
  // `jogo-123` sozinho leva à tela do jogo, sem apontar linha nenhuma.
  assertEquals(oportunidadeDoDestino("jogo-123"), null);
});
