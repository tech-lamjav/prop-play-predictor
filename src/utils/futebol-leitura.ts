import type { FutebolFixturePremissas, FutebolFixtureValueRow } from '@/services/futebol-data.service';
import {
  MERCADOS,
  PORTA_PREMISSAS,
  contaQueValem,
  melhorCandidato,
  premissasDaSaida,
  type MercadoInfo,
} from '@/utils/futebol-premissas';

// A leitura do jogo, calculada UMA vez e reusada em toda a tela (Protótipo 1b):
// resumo, bancada, ranking e hero derivam daqui, para não existirem duas verdades.
//
// Regra de honestidade da adaptação: o protótipo mostra Score/odd/chance sempre,
// mas no dado real esses números SÓ existem quando há odds coletadas
// (get_futebol_fixture_value). Sem odds, a leitura vive das premissas — o próprio
// protótipo tem esse padrão no "sem preço" do BTTS.

/** Casa uma linha de valor (odds reais) com um candidato de premissas. */
export function valueDoCandidato(
  valueRows: FutebolFixtureValueRow[] | null | undefined,
  market: string,
  outcome: string,
  line: number | null,
): FutebolFixtureValueRow | null {
  if (!valueRows?.length) return null;
  return (
    valueRows.find(
      (v) =>
        v.market === market &&
        v.outcome === outcome &&
        ((v.line_value == null && line == null) ||
          (v.line_value != null && line != null && Math.abs(v.line_value - line) < 0.011)),
    ) ?? null
  );
}

export interface MercadoResumo {
  mercado: MercadoInfo;
  /** O candidato que representa o mercado (saída/linha com mais premissas). */
  candidato: FutebolFixturePremissas;
  nValem: number;
  totalQueValem: number;
  /** Linha de valor real (odds), quando coletada. */
  value: FutebolFixtureValueRow | null;
  /**
   * Passa a régua? Com odds, régua de Score (40). Sem odds, a porta de contexto
   * (2+ premissas) — que é o que existe para afirmar.
   */
  passa: boolean;
}

export const REGUA_SCORE = 40;

export function resumoDosMercados(
  rows: FutebolFixturePremissas[] | null | undefined,
  valueRows: FutebolFixtureValueRow[] | null | undefined,
): MercadoResumo[] {
  if (!rows?.length) return [];
  return MERCADOS.flatMap((m) => {
    const c = melhorCandidato(rows, m.slug);
    if (!c) return [];
    const nValem = contaQueValem(m.slug, c.acesas);
    // Denominador só do lado da saída: para um Over, "defesas firmes" e as outras do
    // Under nunca poderiam acender, então contá-las fazia "2 de 8" onde o certo é
    // "2 de 3".
    const totalQueValem = premissasDaSaida(m, c.outcome, c.line_value, c.acesas).filter(
      (p) => p.peso == null || p.peso > 0,
    ).length;
    // O valor pode estar em qualquer saída do mercado; o candidato de contexto e o
    // de preço podem divergir. Preferimos o do próprio candidato; se não houver,
    // olhamos o melhor Score do mercado inteiro.
    const doCandidato = valueDoCandidato(valueRows, m.slug, c.outcome, c.line_value);
    const doMercado = (valueRows ?? [])
      .filter((v) => v.market === m.slug)
      .sort((a, b) => b.score - a.score)[0] ?? null;
    const value = doCandidato ?? doMercado;
    const passa = value ? value.score >= REGUA_SCORE : nValem >= PORTA_PREMISSAS;
    return [{ mercado: m, candidato: c, nValem, totalQueValem, value, passa }];
  });
}

/** A "melhor leitura do jogo": maior Score real; sem odds, mais contexto. */
export function melhorLeitura(resumos: MercadoResumo[]): MercadoResumo | null {
  if (!resumos.length) return null;
  const comValor = resumos.filter((r) => r.value != null);
  if (comValor.length) return [...comValor].sort((a, b) => (b.value!.score) - (a.value!.score))[0];
  return [...resumos].sort((a, b) => b.nValem - a.nValem)[0];
}
