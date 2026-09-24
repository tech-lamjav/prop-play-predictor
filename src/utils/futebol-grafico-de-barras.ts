import { EH_BINARIA, type SerieHistorico } from '@/utils/futebol-historico';

/**
 * Os números e as contas do gráfico de barras, sem nada de React.
 *
 * Moram fora do componente por dois motivos. O primeiro é de camada: são
 * funções puras sobre a série, e a única coisa que o componente acrescenta a
 * elas é pixel. O segundo é mecânico — um arquivo que exporta componente e
 * função junto quebra o recarregamento rápido do Vite, e a regra de lint que
 * cobra isso descreve exatamente esta separação.
 */

export const d1 = (v: number) => v.toFixed(1).replace('.', ',');

export const dia = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

/** Gol é inteiro, gol esperado é decimal, e métrica binária é sim ou não. */
export const rotuloValor = (v: number | null, metrica: SerieHistorico['metrica']) => {
  if (v == null) return '';
  if (EH_BINARIA(metrica)) return v ? 'sim' : 'não';
  return metrica === 'xg' ? d1(v) : String(Math.round(v));
};

/**
 * A média das barras, no rótulo do gráfico.
 *
 * Numa métrica binária a média é a FRAÇÃO de jogos, e escrevê-la como "média 0,4"
 * embaixo de uma premissa que compara 40% contra 40% seria o gráfico falando outra
 * língua que o card (#355).
 */
export const rotuloMedia = (v: number, metrica: SerieHistorico['metrica']) =>
  EH_BINARIA(metrica) ? `${Math.round(v * 100)}% dos jogos` : `média ${d1(v)}`;

/**
 * O teto da escala compartilhada entre as séries desenhadas juntas.
 *
 * Compartilhar a escala é o que faz altura comparar: em caixas separadas, cada
 * time ganhava a própria escala e barra alta de um valia menos que barra baixa
 * do outro.
 */
export function tetoDaEscala(series: SerieHistorico[], referencia?: number): number {
  const valores = series.flatMap((s) => s.jogos.map((j) => j.valor)).filter((v): v is number => v != null);
  return Math.max(...valores, referencia ?? 0, 1);
}

/**
 * Cabe rótulo de dados em cima de cada barra?
 *
 * Gol é um caractere e cabe quase sempre; o gol esperado tem decimal e é o que
 * aperta. Com a janela em dez jogos são ~25px por barra e o rótulo mede ~17.
 */
export function cabeRotulo(series: SerieHistorico[]): boolean {
  const total = series.reduce((n, s) => n + s.jogos.length, 0);
  return total <= 24 || series.every((s) => s.metrica !== 'xg');
}
