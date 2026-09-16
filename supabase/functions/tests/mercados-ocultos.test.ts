// A vitrine do produto, do lado das notificações. Um mercado escondido no
// painel e não no Telegram é o vazamento que esta regra existe para impedir:
// o assinante recebe no celular o que sumiu da tela.
import { assertEquals } from "./_assert.ts";
import {
  carregarVitrine,
  filtrarMercadosOcultos,
  filtrarPelaVitrine,
  mercadoOcultoNaData,
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

// ---------------------------------------------------------------------------
// O período da vitrine (#439)
// ---------------------------------------------------------------------------
// Este arquivo testava só o filtro por NOME, e era exatamente esse o buraco: no
// dia em que o handicap voltou com data de corte, a lista de nomes esvaziou e a
// mensagem passou a tratá-lo como liberado para todos os jogos, inclusive os
// que o painel esconde. Três alertas foram entregues a 26 pessoas.
// ---------------------------------------------------------------------------

// 16/09/2026 às 9h BRT — o dia do vazamento.
const AGORA = Date.parse("2026-09-16T12:00:00Z");
// O estado real de produção: de volta à vitrine a partir de 17/09 às 00h BRT.
const PERIODO_FECHADO = [
  {
    market: "asian_handicap",
    ocultoDesde: "2024-01-01T03:00:00Z",
    ocultoAte: "2026-09-17T03:00:00Z",
  },
];

const jogo = (market: string, kickoff: string | null, id: number) => ({
  market,
  kickoff_utc: kickoff,
  fixture_id: id,
});

Deno.test("o cenario do vazamento: jogo de hoje nao vai, jogo de amanha vai", () => {
  const linhas = [
    jogo("asian_handicap", "2026-09-16T17:00:00", 1),
    jogo("asian_handicap", "2026-09-17T19:00:00", 2),
    jogo("goals_over_under", "2026-09-16T17:00:00", 3),
  ];
  assertEquals(filtrarPelaVitrine(linhas, PERIODO_FECHADO, AGORA), [
    jogo("asian_handicap", "2026-09-17T19:00:00", 2),
    jogo("goals_over_under", "2026-09-16T17:00:00", 3),
  ]);
});

Deno.test("o instante da volta ja esta liberado", () => {
  assertEquals(
    mercadoOcultoNaData("asian_handicap", "2026-09-17T03:00:00", PERIODO_FECHADO, AGORA),
    false,
  );
});

Deno.test("periodo aberto esconde o jogo de hoje", () => {
  const aberto = [
    { market: "asian_handicap", ocultoDesde: "2026-09-01T00:00:00Z", ocultoAte: null },
  ];
  assertEquals(
    mercadoOcultoNaData("asian_handicap", "2026-09-16T17:00:00", aberto, AGORA),
    true,
  );
});

Deno.test("vitrine vazia nao esconde nada", () => {
  const linhas = [jogo("asian_handicap", "2026-09-16T17:00:00", 1)];
  assertEquals(filtrarPelaVitrine(linhas, [], AGORA), linhas);
});

Deno.test("carrega a vitrine com o periodo", async () => {
  const supabase = {
    rpc: (nome: string) => {
      assertEquals(nome, "get_futebol_vitrine");
      return Promise.resolve({
        data: [
          {
            market: "asian_handicap",
            oculto_desde: "2024-01-01T03:00:00Z",
            oculto_ate: "2026-09-17T03:00:00Z",
          },
        ],
        error: null,
      });
    },
  };
  assertEquals(await carregarVitrine(supabase), {
    mercados: [
      {
        market: "asian_handicap",
        ocultoDesde: "2024-01-01T03:00:00Z",
        ocultoAte: "2026-09-17T03:00:00Z",
      },
    ],
    origem: "banco",
  });
});

Deno.test("sem a RPC nova, cai para a lista de nomes — sem data, mas sem mentir", async () => {
  const supabase = {
    rpc: (nome: string) =>
      nome === "get_futebol_vitrine"
        ? Promise.reject(new Error("function does not exist"))
        : Promise.resolve({ data: ["asian_handicap"], error: null }),
  };
  assertEquals(await carregarVitrine(supabase), {
    mercados: [{ market: "asian_handicap", ocultoDesde: null, ocultoAte: null }],
    origem: "sem-data",
  });
});

Deno.test("as duas RPCs fora do ar caem para o fallback", async () => {
  const supabase = { rpc: () => Promise.reject(new Error("boom")) };
  assertEquals(await carregarVitrine(supabase), {
    mercados: VITRINE_FALLBACK.map((market) => ({
      market,
      ocultoDesde: null,
      ocultoAte: null,
    })),
    origem: "fallback",
  });
});

Deno.test("resposta sem array cai para o degrau seguinte", async () => {
  const supabase = {
    rpc: (nome: string) =>
      nome === "get_futebol_vitrine"
        ? Promise.resolve({ data: null, error: null })
        : Promise.resolve({ data: null, error: { message: "boom" } }),
  };
  assertEquals(await carregarVitrine(supabase), {
    mercados: VITRINE_FALLBACK.map((market) => ({
      market,
      ocultoDesde: null,
      ocultoAte: null,
    })),
    origem: "fallback",
  });
});
