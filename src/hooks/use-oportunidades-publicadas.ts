import { useQuery } from '@tanstack/react-query';
import { futebolDataService } from '@/services/futebol-data.service';
import type { LinhaPublicada } from '@/components/placar/placar-agregacao';

export type EstadoDoPlacar =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'pronto'; publicadas: LinhaPublicada[] };

/**
 * As oportunidades publicadas num período, com o placar do jogo.
 *
 * Traz a FOTO DE NASCIMENTO de cada uma — a odd, a nota e a faixa da publicação
 * —, que é o que o placar da metodologia julga (ADR 0003). A RPC é restrita a
 * sócio no banco: quem não é recebe erro, e a tela já está atrás do portão.
 *
 * A RPC devolve tudo que TOCA o período pelos dois eixos: jogo dentro do
 * intervalo, ou detecção dentro do intervalo. Quem escolhe o eixo é a tela, com
 * as duas datas na mão — são perguntas diferentes, e uma consulta serve as duas.
 *
 * Não liquida nada: o veredito sai da regra do site, no módulo de agregação.
 */
export function useOportunidadesPublicadas(
  de: string,
  ate: string,
  /**
   * Desligada, a consulta não sai.
   *
   * Existe para a segunda janela da tela, que só tem sentido comparando. Chamar
   * com datas quaisquer "para não ter hook condicional" rodava a consulta
   * inteira do placar à toa, disputando o mesmo limite de tempo da primeira.
   */
  ativa = true,
): EstadoDoPlacar {
  const consulta = useQuery({
    queryKey: ['socios', 'placar', de, ate],
    // A chamada vive no service de futebol, com as outras RPCs do módulo: é
    // lá que mora o escape de tipo da RPC que os tipos gerados não conhecem, e
    // ter uma segunda casa para isso multiplicaria o `as any`.
    queryFn: () => futebolDataService.getOportunidadesPublicadas(de, ate),
    // O histórico de um período passado não muda a cada minuto: o que muda é o
    // jogo de hoje liquidando. Cinco minutos é o suficiente para o sócio ver a
    // conta andar sem a tela consultar a cada clique de filtro.
    staleTime: 5 * 60 * 1000,
    enabled: ativa,
  });

  if (consulta.isError) return { tipo: 'erro' };
  if (consulta.data === undefined) return { tipo: 'carregando' };
  return { tipo: 'pronto', publicadas: consulta.data };
}
