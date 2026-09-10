// ============================================================================
// O comportamento, como a ficha conta
// ============================================================================
// Funções puras sobre o que a função do servidor devolveu. Nada aqui fala com
// o PostHog — quem fala é a edge function, porque a chave de consulta não pode
// viver no navegador.
// ============================================================================

export interface Comportamento {
  /** Quando começa a história que o PostHog ainda guarda. */
  primeiroEvento: string | null;
  ultimoEvento: string | null;
  eventos: number;
  sessoes: number;
  segundosDeTela: number;
  paginas: { caminho: string; vezes: number }[];
}

/**
 * `8100` → `2h 15min`.
 *
 * Sem casa decimal e sem segundos: o número serve para dizer se a pessoa passou
 * cinco minutos ou duas horas no produto, e a precisão além disso só ocupa
 * espaço. Menos de um minuto vira "menos de 1min", porque "0min" seria lido
 * como ausência.
 */
export function tempoDeTela(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) return 'sem tempo registrado';
  if (segundos < 60) return 'menos de 1min';

  const horas = Math.floor(segundos / 3600);
  const minutos = Math.round((segundos % 3600) / 60);

  if (horas === 0) return `${minutos}min`;
  // 60 minutos arredondados viram a hora seguinte, senão sai "2h 60min".
  if (minutos === 60) return `${horas + 1}h`;
  return minutos === 0 ? `${horas}h` : `${horas}h ${minutos}min`;
}

/**
 * A história que o PostHog guarda começa DEPOIS do cadastro?
 *
 * Se sim, o total de sessões é de um recorte e não de sempre — o plano
 * descartou o que era mais antigo. A ficha precisa poder dizer isso, senão
 * "2 sessões" para quem se cadastrou em março parece abandono, quando pode ser
 * só retenção de dados.
 *
 * A folga de um dia existe porque o cadastro e o primeiro evento acontecem com
 * segundos de diferença, e não exatamente no mesmo instante.
 */
export function historiaTruncada(
  comportamento: Comportamento,
  cadastradoEm: string | null,
): boolean {
  if (!comportamento.primeiroEvento || !cadastradoEm) return false;
  const UM_DIA = 24 * 60 * 60 * 1000;
  return Date.parse(comportamento.primeiroEvento) - Date.parse(cadastradoEm) > UM_DIA;
}
