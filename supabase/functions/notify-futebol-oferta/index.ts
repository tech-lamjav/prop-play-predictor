// ============================================================================
// notify-futebol-oferta — a oferta depois que o teste do futebol acaba
// ============================================================================
// Uma DM, uma vez, para quem tem Telegram vinculado, teve o teste do futebol
// encerrado há pelo menos 24 horas e não assinou. Item 12 do MAPA_MENSAGENS_BOT.
//
// DOIS MODOS, e o padrão é o que não manda nada:
//
//   ?mode=report → NÃO escreve e NÃO envia. Diz quantos receberiam e quem, por
//                  id. É o que se roda antes de ligar qualquer coisa.
//   ?mode=send   → reserva, manda, registra.
//
// A RESERVA VEM ANTES DO ENVIO, e o que acontece com ela na falha depende do
// que a falha PROVA:
//
//   · timeout e 5xx não provam nada — ninguém sabe se o Telegram entregou. A
//     reserva FICA, o erro é gravado na linha, e devolver a vaga é decisão
//     humana, com `release_futebol_oferta_pos_teste`. Soltar ali transformaria
//     dúvida em segundo envio, o pior desfecho de uma mensagem de venda;
//   · 403 prova que NÃO entregou: o Telegram recusou. A reserva volta, porque
//     esta oferta é uma por pessoa para sempre e quem bloqueou hoje pode
//     desbloquear amanhã. Não há risco de repetição: a marca de bloqueado passa
//     a pular essa pessoa nas próximas rodadas.
//
// A janela de silêncio é a mesma do resto do bot: 09h–22h59 de Brasília. O
// teste dura 48 horas e pode vencer de madrugada; sem esta guarda, a oferta
// sairia às 3.
//
// O botão passa pelo redirecionador `go`, como todas as DMs: é ele que registra
// o clique e fecha o funil enviado → clicou, que o mapa exige. O destino é
// `assinar` (/futebol/assinar, o checkout) e NÃO a landing de aquisição, que
// oferece começar de graça para quem já testou.
//
// Proteção: header `x-cron-secret` == env CRON_SECRET, o mesmo padrão dos
// outros crons. Segredos: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// TELEGRAM_BOT_TOKEN, CRON_SECRET.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateTraceId, trackEvent } from "../shared/posthog.ts";
import { trackedUrl } from "../shared/links.ts";
import { esc } from "../shared/format.ts";
import { carregarBloqueados, enviarDm } from "../shared/telegram.ts";

// O token do bot passou a ser lido dentro de `shared/telegram.ts`, que é quem
// fala com a API agora. A variável de ambiente continua a mesma.
const TABELA = "futebol_oferta_pos_teste_notifications";

/** A campanha, para separar este clique do daily no `notification_clicks`. */
const CAMPANHA = "oferta_pos_teste";

/** Genéricas só entre 09:00 e 22:59 BRT, igual ao notify-settlement. */
const QUIET_START = 9;
const QUIET_END = 23;

/** Teto por rodada: um disparo grande demais é sintoma, não sucesso. */
const MAX_POR_RODADA = 200;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * A hora de Brasília, pelo fuso nomeado.
 *
 * Mesma forma do notify-settlement. Contar `getUTCHours() - 3` na mão dá o
 * mesmo número hoje e passa a mentir no dia em que o país voltar a ter horário
 * de verão — e esse erro aparece como mensagem de madrugada, não como falha.
 */
function horaBrt(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  ) % 24;
}

/**
 * O texto, aprovado pelo dono do produto em 17/09/2026.
 *
 * Tom sóbrio, pela régua de voz do mapa: o Betinho fala em primeira pessoa
 * quando AGE sobre uma aposta da pessoa, e aqui ele não age, ele oferece. Duas
 * exceções deliberadas: "a gente" na frase do produto, e "eu paro" no opt-out —
 * essa última é ação de verdade, e é a frase que precisa soar como promessa.
 *
 * Sem urgência e sem convite a apostar (LC 224/2025), e o caminho para parar de
 * receber vem no corpo: quem quer sair tem de conseguir sair lendo uma vez.
 */
function mensagem(nome: string | null): string {
  return [
    `⚽ <b>${esc(nome || "E aí")}, seu teste do futebol terminou.</b>`,
    "",
    "Enquanto ele estava de pé, você viu as oportunidades do dia com a nota de cada uma e o motivo por trás dela — a mesma leitura que a gente usa por dentro.",
    "",
    "O acesso está pausado. Para voltar a ver, é só assinar.",
    "",
    "Não quer mensagem sobre planos? Manda /ofertas que eu paro.",
  ].join("\n");
}

async function enviar(
  supabase: any,
  userId: string,
  chatId: string,
  texto: string,
  url: string,
): Promise<{ desfecho: "enviada" | "bloqueada"; erro?: string }> {
  const r = await enviarDm(supabase, userId, {
    chat_id: chatId,
    text: texto,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[{ text: "Ver os planos do futebol", url }]],
    },
  });
  if (r.desfecho === "falhou") throw new Error(r.erro);
  return { desfecho: r.desfecho, erro: r.erro };
}

type Alvo = {
  user_id: string;
  chat_id: string;
  user_name: string | null;
  trial_ends_at: string;
};

serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "report";

  // Os dois recortes têm padrão no banco. Ficam aqui para dar para alargar a
  // coorte em lote, sem migration, quando o primeiro envio provar que funciona
  // — e por isso são validados: `horas` negativo incluiria teste ainda
  // correndo, e uma data podre viraria uma régua silenciosamente vazia.
  const desdeParam = url.searchParams.get("desde");
  const horasParam = url.searchParams.get("horas");

  if (desdeParam && Number.isNaN(Date.parse(desdeParam))) {
    return json({ error: `desde não é uma data: ${desdeParam}` }, 400);
  }
  const horas = horasParam == null ? null : Number(horasParam);
  if (horas != null && (!Number.isFinite(horas) || horas < 1)) {
    return json({ error: `horas tem de ser um número >= 1: ${horasParam}` }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );

  const { data, error } = await supabase.rpc(
    "get_futebol_oferta_pos_teste_targets",
    {
      ...(desdeParam ? { p_desde: desdeParam } : {}),
      ...(horas != null ? { p_horas: horas } : {}),
    },
  );
  if (error) return json({ error: error.message }, 500);

  const alvos = (data || []) as Alvo[];
  const hora = horaBrt();
  const naJanela = hora >= QUIET_START && hora < QUIET_END;

  if (mode === "report") {
    // Sem nome e sem chat id: para conferir a régua bastam quantos e quais ids.
    return json({
      mode,
      elegiveis: alvos.length,
      nesta_rodada: Math.min(alvos.length, MAX_POR_RODADA),
      ficariam_para_a_proxima: Math.max(0, alvos.length - MAX_POR_RODADA),
      dentro_da_janela: naJanela,
      hora_brt: hora,
      amostra: alvos.slice(0, 10).map((a) => ({
        user_id: a.user_id,
        trial_ends_at: a.trial_ends_at,
      })),
    });
  }

  if (mode !== "send") return json({ error: `modo desconhecido: ${mode}` }, 400);

  if (!naJanela) {
    return json({
      mode,
      enviados: 0,
      motivo: "fora da janela de silêncio",
      hora_brt: hora,
    });
  }

  const traceId = generateTraceId();

  // Quem bloqueou o bot sai ANTES da reserva, com uma consulta só para a rodada.
  // A ordem importa: a reserva não é desfeita, então reservar para depois
  // descobrir o 403 queimaria a única oferta que essa pessoa tem — e ela pode
  // desbloquear amanhã. Foi neste envio que o problema apareceu (#466).
  const bloqueadosSet = await carregarBloqueados(supabase);

  let enviados = 0;
  let pulados = 0;
  let falhas = 0;
  let bloqueados = 0;

  for (const alvo of alvos.slice(0, MAX_POR_RODADA)) {
    if (bloqueadosSet.has(alvo.user_id)) {
      bloqueados++;
      continue;
    }

    const { data: reservou, error: erroReserva } = await supabase.rpc(
      "claim_futebol_oferta_pos_teste",
      { p_user_id: alvo.user_id },
    );
    if (erroReserva || reservou !== true) {
      pulados++;
      continue;
    }

    try {
      const botao = await trackedUrl(alvo.user_id, "assinar", CAMPANHA);
      const r = await enviar(
        supabase,
        alvo.user_id,
        alvo.chat_id,
        mensagem(alvo.user_name),
        botao,
      );
      // Bloqueou entre a lista e o envio: a RESERVA VOLTA, e só neste caso.
      //
      // 403 é a única falha que PROVA que não entregou — o Telegram recusou.
      // Sem entrega, a oferta desta pessoa não foi gastada, e ela é uma por
      // pessoa para sempre: manter a reserva queimaria a única chance de quem
      // pode desbloquear amanhã. E não há risco de mandar duas vezes, porque a
      // marca de bloqueado passa a pular essa pessoa nas próximas rodadas.
      //
      // O timeout do `catch` abaixo é o oposto: ele não prova nada, então lá a
      // reserva fica.
      if (r.desfecho === "bloqueada") {
        bloqueados++;
        await supabase.rpc("release_futebol_oferta_pos_teste", {
          p_user_id: alvo.user_id,
        });
        continue;
      }
      await supabase.from(TABELA).update({ enviada_em: new Date().toISOString() })
        .eq("user_id", alvo.user_id);
      enviados++;
      await trackEvent(
        "futebol_oferta_pos_teste_enviada",
        { channel: "telegram", trial_ends_at: alvo.trial_ends_at },
        alvo.user_id,
        traceId,
      ).catch(() => {});
    } catch (e) {
      // A reserva FICA. Registrar o erro é o que permite alguém olhar depois e
      // decidir, em vez de a régua decidir sozinha mandar de novo.
      falhas++;
      const motivo = e instanceof Error ? e.message : String(e);
      await supabase.from(TABELA).update({ erro: motivo.slice(0, 500) })
        .eq("user_id", alvo.user_id);
      console.error(`falha ao enviar para ${alvo.user_id}:`, motivo);
    }
  }

  return json({
    mode,
    elegiveis: alvos.length,
    enviados,
    pulados,
    falhas,
    bloqueados,
    ficaram_para_a_proxima: Math.max(0, alvos.length - MAX_POR_RODADA),
    hora_brt: hora,
  });
});
