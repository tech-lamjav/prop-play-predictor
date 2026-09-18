// ============================================================================
// shared/telegram.ts — mandar DM num lugar só, e lembrar de quem bloqueou
// ============================================================================
// Cada função de borda tinha o seu `fetch` para a API do Telegram, copiado uma
// da outra. Enquanto era só um POST, a duplicação era inofensiva. Deixou de ser
// quando apareceu uma regra que precisa valer para TODAS: quem bloqueou o bot
// para de ser tentado (#466).
//
// O 403 é definitivo até a pessoa agir: o Telegram responde "Forbidden: bot was
// blocked by the user" naquele chat, e vai responder de novo amanhã. É diferente
// de um 5xx ou de um timeout, que são transitórios e NÃO marcam ninguém — errar
// esse lado tiraria da lista quem só teve azar de rede.
//
// A marca sai sozinha quando a pessoa volta a falar com o bot: falar prova que
// desbloqueou, e quem percebe isso é o `telegram-webhook`.
// ============================================================================

import { trackEvent } from "./posthog.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";

/**
 * O cliente do supabase-js, no mínimo que este módulo usa.
 *
 * Tipado por forma, e não importando o tipo do pacote: as funções de borda
 * criam o cliente com versões diferentes do `@supabase/supabase-js`, e amarrar
 * o tipo aqui faria este módulo quebrar quando uma delas subisse de versão.
 */
type Erro = { message?: string } | null;

type Banco = {
  from: (tabela: string) => {
    update: (valores: Record<string, unknown>) => {
      eq: (coluna: string, valor: string) => {
        is: (coluna: string, valor: null) => PromiseLike<{ error: Erro }>;
        not: (
          coluna: string,
          op: string,
          valor: null,
        ) => PromiseLike<{ error: Erro }>;
      };
    };
    select: (colunas: string) => {
      not: (coluna: string, op: string, valor: null) => {
        order: (coluna: string) => {
          range: (
            de: number,
            ate: number,
          ) => PromiseLike<{ data: { id: string }[] | null; error: Erro }>;
        };
      };
    };
  };
};

export type Desfecho = "enviada" | "bloqueada" | "falhou";

export type Resultado = { desfecho: Desfecho; erro?: string };

/** Quantos ids por página. O PostgREST corta em 1000 por padrão, calado. */
const PAGINA = 1000;

/**
 * Os ids de quem bloqueou o bot.
 *
 * Uma consulta por rodada, e não uma por pessoa: o daily manda para centenas, e
 * perguntar ao banco a cada envio seria trocar um problema de métrica por um de
 * latência. Os marcados são minoria e cabem num `Set`.
 *
 * ⚠️ PAGINADO E ORDENADO, e as duas coisas juntas. Sem `range`, o PostgREST
 * devolve as primeiras mil linhas e não diz que cortou. E paginar sem `order` é
 * pior do que não paginar: sem ORDER BY o Postgres não promete a mesma ordem
 * entre duas consultas, então linhas podem aparecer duas vezes numa página e
 * sumir de outra — a lista sairia incompleta do mesmo jeito, agora com a
 * aparência de estar certa.
 *
 * ⚠️ FALHA ABERTA, e gritando. Se o banco não responder, a lista sai vazia e a
 * rodada tenta todo mundo — que é o comportamento anterior a esta mudança, ou
 * seja, degradação e não regressão. O que NÃO pode é isso acontecer em silêncio:
 * o `console.error` é o que separa "ninguém está marcado" de "não consegui
 * perguntar", que sem ele são a mesma linha de log.
 */
export async function carregarBloqueados(supabase: Banco): Promise<Set<string>> {
  const ids = new Set<string>();

  for (let pagina = 0; ; pagina++) {
    const de = pagina * PAGINA;
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .not("telegram_bloqueado_em", "is", null)
      .order("id")
      .range(de, de + PAGINA - 1);

    if (error) {
      console.error("carregarBloqueados falhou; a rodada vai tentar todo mundo", error);
      return ids;
    }

    const linhas = data ?? [];
    for (const u of linhas) ids.add(u.id);
    if (linhas.length < PAGINA) return ids;
  }
}

/**
 * Manda a DM e devolve o desfecho, sem lançar.
 *
 * Não lança de propósito: "a pessoa bloqueou" não é falha da nossa rodada, e
 * tratar como exceção empurra cada chamador a inventar o próprio jeito de
 * distinguir os dois — que é exatamente como a regra se perde.
 *
 * `userId` nulo manda sem marcar ninguém: é o caso das DMs de admin, que não
 * têm usuário do lado de lá.
 */
export async function enviarDm(
  supabase: Banco,
  userId: string | null,
  body: Record<string, unknown>,
): Promise<Resultado> {
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (res.ok) return { desfecho: "enviada" };

  const texto = await res.text();

  if (res.status === 403) {
    if (userId) {
      await marcarBloqueado(supabase, userId);
      // A medição que faltava (#466): sem este evento, "quantas pessoas
      // bloquearam o bot, e quando" não tem resposta em lugar nenhum — e essa
      // pergunta é metade do motivo desta mudança existir.
      //
      // Dispara no 403, e não dentro de `marcarBloqueado`: quem já está marcado
      // é pulado antes de chegar aqui, então na prática é um evento por pessoa.
      // Repetir significa que alguém bloqueou de novo depois de voltar, o que é
      // informação, não ruído.
      await trackEvent(
        "telegram_bloqueado_detectado",
        { channel: "telegram" },
        userId,
      ).catch(() => {});
    }
    return { desfecho: "bloqueada", erro: `telegram 403: ${texto}` };
  }

  return { desfecho: "falhou", erro: `telegram ${res.status}: ${texto}` };
}

/**
 * Marca, sem sobrescrever a data de quem já estava marcado.
 *
 * O erro é registrado, não engolido: se a escrita falhar, a pessoa continua
 * sendo tentada amanhã — e a diferença entre "não bloqueou" e "não consegui
 * gravar" tem de caber no log, senão vira mistério.
 */
export async function marcarBloqueado(
  supabase: Banco,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ telegram_bloqueado_em: new Date().toISOString() })
    .eq("id", userId)
    .is("telegram_bloqueado_em", null);
  if (error) console.error("marcarBloqueado falhou", userId, error);
}

/**
 * Tira a marca. Chamado quando chega mensagem da pessoa: falar com o bot é a
 * prova de que ela desbloqueou.
 */
export async function limparBloqueio(
  supabase: Banco,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ telegram_bloqueado_em: null })
    .eq("id", userId)
    .not("telegram_bloqueado_em", "is", null);
  // Falhar aqui prende a pessoa fora de todas as mensagens mesmo depois de ela
  // desbloquear. É o erro mais caro dos três, e o mais invisível.
  if (error) console.error("limparBloqueio falhou", userId, error);
}
