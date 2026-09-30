// ============================================================
// porteiro — de onde a pessoa está acessando, e se ela entra
// ============================================================
// Spec na issue #548, ticket #550.
//
// É o ÚNICO lugar que decide o país. A tela obedece o que esta função devolve;
// ela não lê cabeçalho, não consulta lista e não refaz a conta. Dois lugares
// decidindo o mesmo país acabariam discordando, e aí o bloqueio sairia por um
// critério enquanto a prova sairia por outro — e ninguém saberia qual valia.
//
// ── O QUE É DEVOLVIDO E O QUE É GRAVADO NÃO SÃO A MESMA COISA ───────────────
// Devolvido: o veredito DESTE momento, que é o que manda na tela.
// Gravado: o do PRIMEIRO acesso do dia, que é o que vira prova.
//
// Quem já tem linha no dia não a reescreve. Um registro que pode ser
// sobrescrito é um registro mais fraco, e o que ele precisa provar é justamente
// que ninguém mexeu depois. Alguém que atravesse a fronteira no meio do dia
// continua sendo barrado na hora — só não ganha uma segunda linha.
//
// ── ANÔNIMO RECEBE VEREDITO, MAS NÃO GERA LINHA ─────────────────────────────
// A página pública também precisa poder ser barrada. Mas o registro é da
// PESSOA, e sem pessoa não há linha — inventar uma chave para visitante faria
// o diário de presença contar quem nunca se cadastrou.
//
// Publicada COM verificação de JWT. A chave anônima é um JWT válido do projeto,
// então visitante deslogado também chega aqui — o que fica de fora é só quem
// não tem nenhuma credencial do projeto.
//
// Segredos (env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ehDoBrasil } from "../shared/faixas-do-brasil.ts";
import { ipDaRequisicao } from "../shared/origem-da-requisicao.ts";
import { decidir } from "./decisao.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * O dia é o de Brasília, e não o do relógio de quem acessa.
 *
 * A pergunta que o registro responde é fiscal e brasileira — "no dia tal,
 * tantas pessoas ativas" —, então o corte do dia tem que ser o mesmo que o
 * contador usa. Usar o fuso de cada pessoa faria a mesma visita cair em dias
 * diferentes conforme de onde ela veio, que é o oposto de um diário.
 */
const FUSO_DA_CASA = "America/Sao_Paulo";

function diaDeHoje(): string {
  // `en-CA` devolve no formato ano-mês-dia, que é o que o Postgres espera.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_DA_CASA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** O `sub` do token, ou null para quem chegou com a chave anônima. */
function pessoaDoToken(req: Request): string | null {
  const cabecalho = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!cabecalho) return null;
  try {
    // A assinatura já foi conferida pelo gateway antes de chegar aqui; o que
    // falta é só ler quem é.
    const payload = JSON.parse(atob(cabecalho.replace("Bearer ", "").split(".")[1]));
    return typeof payload?.sub === "string" && payload.sub !== "" ? payload.sub : null;
  } catch {
    return null;
  }
}

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );

  const ip = ipDaRequisicao(req.headers);
  const pessoa = pessoaDoToken(req);

  try {
    const [chave, quemE] = await Promise.all([
      supabase.from("ops_config").select("value").eq("key", "bloqueio_brasil_ligado").maybeSingle(),
      pessoa
        ? supabase.from("users").select("is_socio").eq("id", pessoa).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // ⚠️ Só a palavra 'sim' liga o bloqueio. Qualquer outra coisa — a chave
    // ausente, um valor digitado errado, a consulta falhando — deixa
    // desligado. Uma chave que desliga o acesso de um país inteiro não pode
    // ligar por acidente de digitação.
    const bloqueioLigado = chave.data?.value === "sim";
    const ehSocio = quemE.data?.is_socio === true;

    const decisao = decidir({ origem: ehDoBrasil(ip), bloqueioLigado, ehSocio });

    if (pessoa && ip) {
      // `ignoreDuplicates` é o "primeira do dia vence": a linha existente não é
      // tocada. Falhar aqui não pode derrubar a resposta — o registro é prova,
      // e prova que falta é um relatório incompleto, nunca um acesso quebrado.
      const { error } = await supabase
        .from("registro_de_presenca")
        .upsert(
          {
            user_id: pessoa,
            dia: diaDeHoje(),
            ip,
            origem: decisao.origem,
            veredito: decisao.veredito,
          },
          { onConflict: "user_id,dia", ignoreDuplicates: true },
        );
      if (error) console.error("[porteiro] registro de presenca falhou:", error.message);
    }

    // O `nao_sei` sai no log para o vigia poder contar (#554). Ele é a única
    // forma de o bloqueio morrer em silêncio, então ele precisa fazer barulho.
    if (decisao.origem === "nao_sei") {
      console.warn("[porteiro] origem desconhecida", JSON.stringify({ temIp: ip !== null }));
    }

    return json(decisao);
  } catch (erro) {
    // Defeito nosso não tranca ninguém. A pessoa entra, e o log conta.
    console.error("[porteiro] falhou, deixando entrar:", (erro as Error).message);
    return json({ origem: "nao_sei", veredito: "entrou" });
  }
});
