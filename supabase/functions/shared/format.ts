// shared/format.ts — helpers de formatação idênticos entre as funções de
// mensagem (Onda 3: consolidação do que estava duplicado 1:1; deriva entre
// cópias já quase causou bug — ver revisão 2026-07-20).

// Escapa HTML pro parse_mode: "HTML" do Telegram.
export function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
