// ============================================================
// stake.ts — parsing do valor da aposta (código PURO)
// ============================================================
// Extraído de index.ts na Onda 3 (move-only) pra ser testável no CI
// (supabase/functions/tests/stake.test.ts). Regra-mestra do fluxo de valor
// (item 15): a decisão é pela FORMA da mensagem — número puro × resto —
// nunca pelo tempo. Um registro de aposta real nunca é só um número.

// número do texto do usuário (force reply do "Outro valor"): "R$ 50", "50,00", "50 reais"
export function parseStake(text: string): number | null {
  const m = String(text ?? "").replace(",", ".").match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const v = parseFloat(m[1])
  return v > 0 && v <= 1_000_000 ? v : null
}

// número PURO (com enfeites monetários no máximo): candidato a resposta de
// valor. Qualquer palavra além de reais/conto/pila/paus desarma — print e
// aposta em texto seguem pro fluxo normal de extração.
export function isBareNumber(text: string): boolean {
  return /^\s*r?\$?\s*\d+(?:[.,]\d+)?\s*(reais|conto|pila|paus)?\s*$/i.test(String(text ?? ""))
}
