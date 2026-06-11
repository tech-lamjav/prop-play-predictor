// ============================================================
// Config canônico dos palpites especiais (funil de projeção).
// ============================================================
// Fonte única de verdade para o default de quais fases do funil estão
// habilitadas. Existe porque `round_of_16` (Oitavas) foi adicionado depois
// (migration 053) e nunca entrou no default do schema (migration 037), que só
// tem {finalist, round_of_32, semifinalist, quarterfinalist}.
//
// Isso fazia admin e jogador divergirem ao resolver a chave faltante:
//   - Admin   (`!!config[type]`)          → undefined vira OFF
//   - Jogador (`config[type] !== false`)  → undefined vira ON  → card renderiza
//
// Resultado: a Oitavas aparecia pro jogador mesmo o admin mostrando desligada.
// Normalizando o config em ambos os pontos de consumo, a chave faltante resolve
// para o mesmo default canônico nos dois lados.

export const SPECIAL_STAGE_KEYS = [
  'round_of_32',
  'round_of_16',
  'quarterfinalist',
  'semifinalist',
  'finalist',
] as const;

export type SpecialStageKey = (typeof SPECIAL_STAGE_KEYS)[number];

/** Default canônico: todas as fases do funil habilitadas. */
export const DEFAULT_SPECIAL_CONFIG: Record<SpecialStageKey, boolean> = {
  round_of_32: true,
  round_of_16: true,
  quarterfinalist: true,
  semifinalist: true,
  finalist: true,
};

/**
 * Normaliza o config do bolão preenchendo chaves faltantes com o default
 * canônico. Use sempre que for consumir `special_predictions_config` — assim
 * admin e jogador enxergam exatamente o mesmo conjunto de fases habilitadas.
 */
export function normalizeSpecialConfig(
  config: Record<string, boolean> | null | undefined,
): Record<SpecialStageKey, boolean> {
  return { ...DEFAULT_SPECIAL_CONFIG, ...(config ?? {}) };
}
