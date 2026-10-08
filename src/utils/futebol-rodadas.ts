// ============================================================
// futebol-rodadas.ts — o nome da rodada, no idioma ativo
// ============================================================
// O mart guarda o texto da API-Football, em inglês e em três formatos diferentes:
// "Regular Season - 22" nas ligas, "Group Stage - 3" na fase de grupos e
// "Round of 16" / "Quarter-finals" / "1/128-finals" no mata-mata. A tela precisa
// de duas versões: a CURTA, que cabe num chip da régua, e a LONGA, que vira
// título. Antes existia só um `prettyRound` que cuidava do "Regular Season" e
// deixava o resto em inglês na tela.
//
// ⚠️ As duas versões RECEBEM O TRADUTOR, e o parâmetro é obrigatório de
// propósito (#538): a frase em português vivia escrita aqui dentro, e tela em
// espanhol não teria como traduzi-la depois de pronta. Com o parâmetro
// obrigatório, quem esquecer de passá-lo não compila — em vez de mostrar
// português no meio do espanhol.
//
// O que NÃO muda é o lado esquerdo das comparações: os padrões continuam sendo
// casados contra o texto EM INGLÊS da fonte, que é identificador e não rótulo.
// Comparar contra o rótulo traduzido faria "Round of 16" deixar de ser
// reconhecido no dia em que a tela virasse espanhol.
// ============================================================

/** O tradutor, na forma mínima que este módulo usa. */
type Traduzir = (chave: string, valores?: Record<string, unknown>) => string;

/** Número da rodada quando a competição é de pontos corridos, senão null. */
export function numeroDaRodada(round: string | null | undefined): number | null {
  const m = (round ?? '').match(/Regular Season\s*-\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

/** true quando a lista de rodadas é de liga (pontos corridos), não de mata-mata. */
export function ehCampeonatoDePontos(rounds: string[]): boolean {
  return rounds.some((r) => numeroDaRodada(r) != null);
}

/**
 * [padrão no texto da fonte, sufixo da chave].
 *
 * A chave curta é `rodada.curto.<sufixo>` e a longa `rodada.longo.<sufixo>`, que
 * é o que permite uma tabela só para as duas versões.
 */
const FASES: Array<[RegExp, string]> = [
  [/^final$/i, 'final'],
  [/semi[- ]?finals?/i, 'semifinal'],
  [/quarter[- ]?finals?/i, 'quartas'],
  [/round of 16|1\/8[- ]?finals?/i, 'oitavas'],
  [/round of 32|1\/16[- ]?finals?/i, 'dezesseisAvos'],
  [/round of 64|1\/32[- ]?finals?/i, 'trintaEDoisAvos'],
  [/round of 128|1\/64[- ]?finals?/i, 'sessentaEQuatroAvos'],
  [/1\/128[- ]?finals?/i, 'primeiraFase'],
  [/1\/256[- ]?finals?/i, 'fasePreliminar'],
  [/play[- ]?offs?/i, 'playoff'],
  [/3rd qualifying/i, 'terceiraPreliminar'],
  [/2nd qualifying/i, 'segundaPreliminar'],
  [/1st qualifying/i, 'primeiraPreliminar'],
];

/** true quando a rodada é de mata-mata (nem pontos corridos, nem fase de grupos). */
export function ehMataMata(round: string | null | undefined): boolean {
  const r = (round ?? '').trim();
  if (!r || numeroDaRodada(r) != null) return false;
  return !/group stage/i.test(r);
}

/** Rótulo de chip: curto o suficiente pra caber na régua. */
export function rodadaCurta(round: string | null | undefined, t: Traduzir): string {
  const n = numeroDaRodada(round);
  if (n != null) return String(n);
  const r = (round ?? '').trim();
  if (!r) return t('rodada.semRodada');

  const grupo = r.match(/group stage\s*-\s*(\d+)/i);
  if (grupo) return t('rodada.curto.grupos', { numero: grupo[1] });
  const qual = r.match(/qualification round\s*(\d+)/i);
  if (qual) return t('rodada.curto.qualificacao', { numero: qual[1] });

  for (const [re, sufixo] of FASES) if (re.test(r)) return t(`rodada.curto.${sufixo}`);
  // Fase que não casa com padrão nenhum: o texto cru da fonte, em inglês. É
  // menos errado que inventar nome, e é o sinal de que falta um padrão aqui.
  return r;
}

/** Rótulo de título: a rodada por extenso. */
export function rodadaLonga(round: string | null | undefined, t: Traduzir): string {
  const n = numeroDaRodada(round);
  if (n != null) return t('rodada.longo.rodada', { numero: n });
  const r = (round ?? '').trim();
  if (!r) return t('rodada.longo.semNumero');

  const grupo = r.match(/group stage\s*-\s*(\d+)/i);
  if (grupo) return t('rodada.longo.grupos', { numero: grupo[1] });
  const qual = r.match(/qualification round\s*(\d+)/i);
  if (qual) return t('rodada.longo.qualificacao', { numero: qual[1] });
  if (/group stage/i.test(r)) return t('rodada.longo.faseDeGrupos');

  for (const [re, sufixo] of FASES) if (re.test(r)) return t(`rodada.longo.${sufixo}`);
  return r;
}
