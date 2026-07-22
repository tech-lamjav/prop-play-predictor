// ============================================================
// keyboards.ts — teclados inline do bot (código PURO, sem env)
// ============================================================
// Separado de telegram-api.ts pra ser testável sem --allow-env: importar
// telegram-api.ts puxa config.ts, que lê Deno.env no topo do módulo (o
// `deno test` do CI roda sem permissões). Mesmo motivo do digest.ts ser
// auto-contido. Testado no CI: supabase/functions/tests/confirmation.test.ts

// Espelha config.ts BETS_DASHBOARD_URL (constante pura; manter em sincronia).
const BETS_DASHBOARD_URL = "https://www.smartbetting.app/bets"

// Teclado do recibo de registro: ações direto na mensagem em vez do "textão"
// com link. [✅ Green][❌ Red] reusam o handler settle:<id>:<won|lost> (o mesmo
// do lembrete/auto-liquidação — status='pending' guarda contra toque duplo).
// [✏️ Editar] abre o site JÁ no modal de edição desta aposta (?edit=<id>);
// [📊 Ver banca] abre o dashboard.
function confirmationKeyboard(betId: string): { inline_keyboard: Array<Array<Record<string, string>>> } {
  return {
    inline_keyboard: [
      [
        { text: "✅ Green", callback_data: `settle:${betId}:won` },
        { text: "❌ Red", callback_data: `settle:${betId}:lost` }
      ],
      [
        { text: "✏️ Editar", url: `${BETS_DASHBOARD_URL}?edit=${betId}` },
        { text: "📊 Ver banca", url: BETS_DASHBOARD_URL }
      ]
    ]
  }
}

export { confirmationKeyboard }
