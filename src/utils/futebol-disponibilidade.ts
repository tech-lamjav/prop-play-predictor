import type { FutebolFixtureDisponibilidade } from '@/services/futebol-data.service';
import { mesmaLinha } from '@/utils/futebol-leitura';
import { parseUtc } from '@/utils/futebol-datas';

/**
 * "Disponível desde" da saída analisada (issue #300).
 *
 * O backend entrega o início da disponibilidade CONTÍNUA ATUAL por oportunidade;
 * aqui só se escolhe a linha certa e se escreve a frase. A tela não calcula
 * nada: uma segunda implementação da regra de contiguidade seria uma segunda
 * chance de errá-la.
 */

/** A disponibilidade da saída que a tela está mostrando, ou null. */
export function disponivelDesdeDaSaida(
  linhas: readonly FutebolFixtureDisponibilidade[] | undefined,
  saida: { market: string; outcome: string; line_value: number | null } | null | undefined,
): string | null {
  if (!linhas?.length || !saida) return null;
  const achada = linhas.find(
    (l) =>
      l.market === saida.market &&
      l.outcome === saida.outcome &&
      mesmaLinha(l.line_value, saida.line_value),
  );
  return achada?.disponivel_desde ?? null;
}

/**
 * A frase, em horário de Brasília.
 *
 * Devolve null quando não há valor — o que acontece de propósito nas chaves
 * anteriores à estreia do snapshot, em que o horário dataria a estreia e não a
 * publicação. Nesse caso a tela não escreve nada, em vez de escrever um horário
 * que não é verdade.
 */
export function rotuloDisponivelDesde(disponivelDesde: string | null | undefined): string | null {
  const quando = parseUtc(disponivelDesde ?? null);
  if (!quando) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(quando)
    .replace(', ', ' às ');
}
