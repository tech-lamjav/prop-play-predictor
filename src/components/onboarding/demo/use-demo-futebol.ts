import { useMemo } from 'react';
import type {
  FutebolFixtureValueRow,
  FutebolValueBoardRow,
} from '@/services/futebol-data.service';
import { versaoDaJanela, type FutebolScoreVersion } from '@/utils/futebol-score';
import { demoFutebolBoard, demoFixtureValueRows } from './futebol';

/**
 * A escala que o produto está usando, para a demonstração herdar (#333).
 *
 * ⚠️ Recebe **a mesma janela que a tela exibe**, e não o board cru. A legenda de
 * faixas deriva da janela; se a demonstração herdar de outra fonte, o tour volta
 * a anunciar uma régua diferente da que está ao lado dele — que é o defeito
 * inteiro, só que mais difícil de ver.
 *
 * Janela indeterminada — vazia, ou misturando as duas escalas — resolve na
 * escala que o produto PUBLICA hoje, `contexto_v1`.
 *
 * Era `legacy`, e a justificativa era o contrato antigo: linha sem
 * `score_versao` e com componentes de preço numéricos era deduzida como legacy,
 * e a linha de demonstração tinha essa forma. A contração do #310 matou a
 * dedução e tirou os componentes do contrato, e com isso o padrão virou
 * defeito — dia sem oportunidade publicada é janela vazia, e o tour anunciaria
 * 40+ enquanto o board publica 30+.
 *
 * `legacy` continua sendo herdado quando a janela é mesmo antiga: é o caso do
 * histórico point-in-time, e ali acompanhar é o certo.
 */
function useEscalaDoProduto(
  janela: readonly { score_versao?: FutebolScoreVersion }[] | null | undefined,
): FutebolScoreVersion {
  return versaoDaJanela(janela ?? []) === 'legacy' ? 'legacy' : 'contexto_v1';
}

/** O board de exemplo, na escala que o produto está usando. */
export function useDemoFutebolBoard(
  janela: readonly { score_versao?: FutebolScoreVersion }[] | null | undefined,
): FutebolValueBoardRow[] {
  const escala = useEscalaDoProduto(janela);
  return useMemo(() => demoFutebolBoard(escala), [escala]);
}

/** As saídas de exemplo do detalhe do jogo, na escala que o produto está usando. */
export function useDemoFixtureValueRows(
  janela: readonly { score_versao?: FutebolScoreVersion }[] | null | undefined,
): FutebolFixtureValueRow[] {
  const escala = useEscalaDoProduto(janela);
  return useMemo(() => demoFixtureValueRows(escala), [escala]);
}
