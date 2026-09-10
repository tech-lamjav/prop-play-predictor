import { useMemo } from 'react';
import type {
  FutebolFixtureValueRow,
  FutebolValueBoardRow,
} from '@/services/futebol-data.service';
import { escalaDeExibicao, type FutebolScoreVersion } from '@/utils/futebol-score';
import { demoFutebolBoard, demoFixtureValueRows } from './futebol';

/**
 * A escala que o produto está usando, para a demonstração herdar (#333).
 *
 * ⚠️ Recebe **a mesma janela que a tela exibe**, e não o board cru. A legenda de
 * faixas deriva da janela; se a demonstração herdar de outra fonte, o tour volta
 * a anunciar uma régua diferente da que está ao lado dele — que é o defeito
 * inteiro, só que mais difícil de ver.
 *
 * Janela indeterminada resolve na escala que o produto publica hoje, e a regra
 * disso mora em `escalaDeExibicao` — a mesma que a tela real usa. Eram duas
 * cópias, e as duas caíam em `legacy` por causa da inferência por forma que a
 * contração matou (#310).
 */
function useEscalaDoProduto(
  janela: readonly { score_versao?: FutebolScoreVersion }[] | null | undefined,
): FutebolScoreVersion {
  return escalaDeExibicao(janela ?? []);
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
