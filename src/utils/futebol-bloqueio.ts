import type { FutebolAccess, FutebolValueBoardRow } from '@/services/futebol-data.service';

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

/**
 * A faixa de acesso aparece para este acesso?
 *
 * Durante o teste grátis (estado saudável) NÃO mostramos faixa — o chip do
 * cabeçalho cuida disso. A faixa forte fica só pra expirado/deslogado, que é
 * hora de agir.
 *
 * Mora aqui, e não dentro do componente, porque o `useFaixaDeAcesso` precisa da
 * MESMA resposta para decidir se reserva o espaço dela antes de o banco
 * responder. Com duas cópias da regra, a memória do gancho passaria a guardar
 * uma decisão que a tela não toma mais no dia em que uma das duas mudasse.
 */
export function faixaDeAcessoAparece(access?: FutebolAccess | null): boolean {
  if (!access) return false;
  return access.state !== 'subscribed' && access.state !== 'trial';
}
