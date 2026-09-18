import type { FutebolValueBoardRow } from '@/services/futebol-data.service';

/**
 * A linha veio SEM o conteúdo de valor, porque quem pediu não tem acesso.
 *
 * Desde a guarda `futebol_acesso_do_chamador` no banco, o board devolve a linha
 * com todas as colunas nulas em vez de devolvê-la inteira: a CONTAGEM sobrevive
 * (a home mostra "6 oportunidades" e seis cadeados) e o conteúdo não.
 *
 * O teste é pelo `market` porque ele é a primeira coisa que a tela leria e é
 * `not null` em toda linha de verdade — a saída sem mercado não existe no mart.
 *
 * ⚠️ Não confundir com "sem leitura": ali o board respondeu e não havia linha
 * nenhuma para aquele jogo. Aqui existe linha, e ela está fechada. As duas
 * coisas na mesma tela dizem frases diferentes de propósito.
 */
export function linhaBloqueada(o: Pick<FutebolValueBoardRow, 'market'> | null | undefined): boolean {
  return o != null && o.market == null;
}
