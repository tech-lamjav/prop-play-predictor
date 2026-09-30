// ============================================================
// resolver-pais — preenche o país das linhas do registro de presença
// ============================================================
// Spec na issue #548, ticket #553.
//
// É o que transforma o diário de presença em relatório. O porteiro grava o
// endereço e segue em frente; aqui, depois e sem pressa, o endereço vira país.
//
// ── POR QUE ISTO NÃO ACONTECE NA HORA ───────────────────────────────────────
// Em tempo real o porteiro só pergunta "é do Brasil?", que tem resposta local e
// instantânea. "De que país é" precisa de uma tabela dez vezes maior, e colocar
// isso no caminho de quem chega custaria a toda pessoa do mundo para atender um
// relatório que alguém lê uma vez por mês.
//
// Falhar aqui não afeta ninguém navegando, e é de propósito: uma linha sem país
// é um relatório incompleto, nunca um acesso quebrado.
//
// ── RODAR DE NOVO É SEGURO ──────────────────────────────────────────────────
// A fila é "linhas com `pais_resolvido_em` vazio". Uma linha resolvida sai da
// fila e não volta — inclusive a que não deu para resolver, que fica marcada
// como tentada e sem país. Sem essa marca, as linhas impossíveis voltariam para
// sempre e a fila nunca esvaziaria.
//
// ── COMO AGENDAR ────────────────────────────────────────────────────────────
// Segue o padrão da casa: pg_cron chamando esta função com `x-cron-secret`. O
// SQL está comentado no fim da migration 168, e depende de dois segredos no
// vault que precisam ser criados à mão — sem eles o cron roda mudo, que já
// aconteceu três vezes nesta casa.
//
// ?mode=report → devolve o que faria, sem escrever nada.
//
// Segredos (env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { paisDoIp } from "../shared/pais-do-ip.ts";

const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

/**
 * Quantas linhas por execução.
 *
 * Folgado para a escala de hoje — a 40 MB por ano a cada mil pessoas ativas,
 * uma execução diária nunca encontra mil linhas pendentes. O teto existe para
 * o caso de alguém ligar isto depois de meses sem rodar, quando a fila
 * acumulada poderia estourar o tempo da função.
 */
const POR_VEZ = 1000;

interface LinhaPendente {
  ip: string;
}

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }
  const apenasRelatar = new URL(req.url).searchParams.get("mode") === "report";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );

  try {
    const { data, error } = await supabase
      .from("registro_de_presenca")
      .select("ip")
      .is("pais_resolvido_em", null)
      .order("criado_em", { ascending: true })
      .limit(POR_VEZ);

    if (error) return json({ error: error.message }, 500);

    const pendentes = (data ?? []) as LinhaPendente[];
    if (pendentes.length === 0) return json({ pendentes: 0, atualizadas: 0 });

    // ── Agrupa por país ───────────────────────────────────────────────────
    //
    // O país é função do endereço, então todas as linhas do mesmo endereço
    // recebem o mesmo país. Agrupar troca "uma escrita por linha" por "uma
    // escrita por país encontrado" — que na prática são menos de dez, porque a
    // operação atende quatro mercados.
    //
    // A chave `sem_pais` junta duas situações que terminam igual: endereço que
    // não deu para ler, e endereço de fora da região do LACNIC. As duas viram
    // linha marcada como tentada e sem país.
    const porPais = new Map<string, Set<string>>();
    for (const { ip } of pendentes) {
      const pais = paisDoIp(ip) ?? "sem_pais";
      const conjunto = porPais.get(pais) ?? new Set<string>();
      conjunto.add(ip);
      porPais.set(pais, conjunto);
    }

    const resumo = Object.fromEntries(
      [...porPais].map(([pais, ips]) => [pais, ips.size]),
    );

    if (apenasRelatar) {
      return json({ pendentes: pendentes.length, modo: "report", enderecos_por_pais: resumo });
    }

    let atualizadas = 0;
    const agora = new Date().toISOString();

    for (const [pais, ips] of porPais) {
      // ⚠️ O filtro por `pais_resolvido_em` vazio fica na escrita também, e não
      // só na leitura. Entre uma e outra pode ter passado outra execução, e sem
      // ele esta aqui reescreveria o que aquela já tinha resolvido.
      const { error: erroDaEscrita, count } = await supabase
        .from("registro_de_presenca")
        .update(
          { pais: pais === "sem_pais" ? null : pais, pais_resolvido_em: agora },
          { count: "exact" },
        )
        .is("pais_resolvido_em", null)
        .in("ip", [...ips]);

      if (erroDaEscrita) {
        // Um país que falhou não impede os outros: as linhas dele continuam na
        // fila e voltam na próxima execução.
        console.error(`[resolver-pais] ${pais} falhou:`, erroDaEscrita.message);
        continue;
      }
      atualizadas += count ?? 0;
    }

    console.log(
      `[resolver-pais] ${pendentes.length} pendentes, ${atualizadas} atualizadas`,
      JSON.stringify(resumo),
    );
    return json({ pendentes: pendentes.length, atualizadas, enderecos_por_pais: resumo });
  } catch (erro) {
    console.error("[resolver-pais] falhou:", (erro as Error).message);
    return json({ error: (erro as Error).message }, 500);
  }
});
