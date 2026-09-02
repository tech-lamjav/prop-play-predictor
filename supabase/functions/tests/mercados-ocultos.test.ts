// A vitrine do produto, do lado das notificações. Um mercado escondido no
// painel e não no Telegram é o vazamento que esta regra existe para impedir:
// o assinante recebe no celular o que sumiu da tela.
import { assertEquals } from "./_assert.ts";
import {
  carregarMercadosOcultos,
  filtrarMercadosOcultos,
  VITRINE_FALLBACK,
} from "../shared/mercados-ocultos.ts";

const linha = (market: string, id: number) => ({ market, fixture_id: id });

Deno.test("filtra as linhas do mercado oculto", () => {
  const linhas = [
    linha("goals_over_under", 1),
    linha("asian_handicap", 2),
    linha("match_winner", 3),
  ];
  assertEquals(filtrarMercadosOcultos(linhas, ["asian_handicap"]), [
    linha("goals_over_under", 1),
    linha("match_winner", 3),
  ]);
});

Deno.test("sem mercado oculto devolve tudo", () => {
  const linhas = [linha("goals_over_under", 1), linha("asian_handicap", 2)];
  assertEquals(filtrarMercadosOcultos(linhas, []), linhas);
});

Deno.test("esconde mais de um mercado", () => {
  const linhas = [linha("btts", 1), linha("asian_handicap", 2), linha("double_chance", 3)];
  assertEquals(filtrarMercadosOcultos(linhas, ["asian_handicap", "btts"]), [
    linha("double_chance", 3),
  ]);
});

Deno.test("carrega a lista da RPC", async () => {
  const supabase = {
    rpc: (nome: string) => {
      assertEquals(nome, "get_futebol_mercados_ocultos");
      return Promise.resolve({ data: ["asian_handicap"], error: null });
    },
  };
  assertEquals(await carregarMercadosOcultos(supabase), {
    mercados: ["asian_handicap"],
    origem: "banco",
  });
});

Deno.test("RPC com erro cai para o fallback, e a mensagem sai SEM o mercado escondido", async () => {
  const supabase = {
    rpc: () => Promise.resolve({ data: null, error: { message: "boom" } }),
  };
  assertEquals(await carregarMercadosOcultos(supabase), {
    mercados: [...VITRINE_FALLBACK],
    origem: "fallback",
  });
});

Deno.test("RPC inexistente (código antes da migration) cai para o fallback", async () => {
  const supabase = {
    rpc: () => Promise.reject(new Error("function does not exist")),
  };
  assertEquals(await carregarMercadosOcultos(supabase), {
    mercados: [...VITRINE_FALLBACK],
    origem: "fallback",
  });
});

Deno.test("resposta sem array cai para o fallback", async () => {
  const supabase = { rpc: () => Promise.resolve({ data: null, error: null }) };
  assertEquals(await carregarMercadosOcultos(supabase), {
    mercados: [...VITRINE_FALLBACK],
    origem: "fallback",
  });
});
