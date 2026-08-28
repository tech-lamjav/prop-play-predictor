// ============================================================
// prefs.ts — centro de controle /mensagens (código PURO)
// ============================================================
// Onda 6 da revisão / embrião do item 17 (preferências): o usuário pergunta
// "o que eu recebo do Betinho?" e controla cada recorrente num lugar só.
// O mute continuava existindo espalhado (🔕 na liquidação, botão no resumo);
// aqui é a visão consolidada. Testado no CI: tests/prefs.test.ts
export interface MessagePrefs {
  settlementMuted: boolean;
  weeklyMuted: boolean;
  publicationEnabled: boolean;
  publicationAvailable: boolean;
}

export function prefsText(p: MessagePrefs): string {
  const liq = p.settlementMuted ? "silenciada 🔕" : "ativada";
  const res = p.weeklyMuted ? "silenciado 🔕" : "ativado";
  const publication = p.publicationAvailable
    ? (p.publicationEnabled ? "ativados" : "pausados 🔕")
    : "indisponíveis";
  const publicationExplanation = p.publicationAvailable
    ? "Quando uma oportunidade entra no painel antes do jogo."
    : `Seu acesso ao Futebol está inativo. A preferência está ${p.publicationEnabled ? "ativada" : "pausada"} e será mantida quando você voltar.`;
  return [
    `📬 <b>O que eu te mando</b>`,
    "",
    `🔔 Liquidação de apostas — <b>${liq}</b>`,
    `<i>Quando um jogo seu termina: fecho a aposta sozinho quando dá, ou te pergunto o resultado.</i>`,
    "",
    `📊 Resumo semanal — <b>${res}</b>`,
    `<i>Segunda de manhã: como fecharam seus últimos 7 dias.</i>`,
    "",
    `⚽ Oportunidades do dia — <b>automático</b>`,
    `<i>Só em dia com pick bom. Se você não clica, ele para sozinho.</i>`,
    "",
    `⚽ Alertas de oportunidades — <b>${publication}</b>`,
    `<i>${publicationExplanation}</i>`,
  ].join("\n");
}

// Rótulo do botão reflete a AÇÃO (o que acontece ao tocar), não o estado.
export function prefsKeyboard(p: MessagePrefs): unknown[][] {
  return [
    [{ text: p.settlementMuted ? "Reativar liquidação" : "Silenciar liquidação", callback_data: "prefliq" }],
    [{ text: p.weeklyMuted ? "Reativar resumo semanal" : "Silenciar resumo semanal", callback_data: "prefres" }],
    [{ text: p.publicationEnabled ? "Pausar alertas de oportunidades" : "Retomar alertas de oportunidades", callback_data: "prefpub" }],
  ];
}
