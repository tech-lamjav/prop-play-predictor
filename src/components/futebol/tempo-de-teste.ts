import type { FutebolAccess } from '@/services/futebol-data.service';

/**
 * Quanto tempo sobra do teste grátis, já em texto.
 *
 * Isto é uma peça à parte porque a resposta aparece em dois lugares que não se
 * falam — a pílula do cabeçalho e a página de assinar — e cada um tinha a sua
 * conta. Enquanto o teste durava 7 dias as duas cópias diziam a mesma coisa por
 * sorte; com 48 horas elas divergiriam na primeira borda.
 *
 * A regra de unidade existe porque há DUAS coortes vivas ao mesmo tempo: quem
 * começou antes do corte tem até 7 dias gravados, quem começou depois tem 48
 * horas. Contar tudo em horas daria "faltam 161 horas", e contar tudo em dias
 * daria "2 dias" num teste de dois dias. Então a unidade acompanha a ordem de
 * grandeza, e nenhuma das duas telas precisa saber de coorte.
 */

/** Acima daqui a frase troca de unidade: é a duração de um teste novo. */
const HORAS_QUE_VIRAM_DIAS = 48;

/** Última reta: o chip muda de cor para avisar que está no fim. */
const HORAS_DA_ULTIMA_RETA = 12;

export type TempoDeTeste = {
  /** Texto curto, para a pílula: "31h", "7d", "<1h". */
  curto: string;
  /** Frase inteira, para texto corrido: "faltam 31 horas". */
  longo: string;
  /** Está na última reta — a tela pode chamar atenção. */
  acabando: boolean;
};

/**
 * Horas que faltam, arredondadas para cima. Nunca negativo.
 *
 * Prefere o número do servidor: é o relógio dele que decide o acesso, então
 * deixar a tela calcular a partir do horário do aparelho faria a pílula
 * discordar do gate num celular com a hora errada. A data de término é a
 * reserva, e cobre dois casos reais — resposta antiga guardada em cache pelo
 * react-query, e ambiente onde a migration 134 ainda não subiu.
 */
export function horasRestantes(
  access: FutebolAccess | undefined | null,
  agora: number = Date.now(),
): number | null {
  if (!access) return null;

  if (typeof access.hours_left === 'number') {
    return Math.max(0, access.hours_left);
  }

  if (!access.trial_ends_at) return null;
  const fim = new Date(access.trial_ends_at).getTime();
  if (Number.isNaN(fim)) return null;

  return Math.max(0, Math.ceil((fim - agora) / 3600000));
}

export function tempoDeTeste(
  access: FutebolAccess | undefined | null,
  agora: number = Date.now(),
): TempoDeTeste | null {
  if (!access || access.state !== 'trial') return null;

  const horas = horasRestantes(access, agora);
  if (horas === null) return null;

  const acabando = horas <= HORAS_DA_ULTIMA_RETA;

  if (horas > HORAS_QUE_VIRAM_DIAS) {
    const dias = Math.ceil(horas / 24);
    return {
      curto: `${dias}d`,
      longo: `${dias === 1 ? 'falta' : 'faltam'} ${dias} ${dias === 1 ? 'dia' : 'dias'}`,
      acabando,
    };
  }

  // Zero horas dentro do estado de teste é a última fração de hora. Dizer "0h"
  // numa pílula que só existe enquanto o teste vale faria a pessoa ler que
  // perdeu o acesso que ainda tem.
  if (horas <= 0) {
    return { curto: '<1h', longo: 'falta menos de 1 hora', acabando: true };
  }

  return {
    curto: `${horas}h`,
    longo: `${horas === 1 ? 'falta' : 'faltam'} ${horas} ${horas === 1 ? 'hora' : 'horas'}`,
    acabando,
  };
}
