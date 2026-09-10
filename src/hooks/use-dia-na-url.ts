import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

// ============================================================================
// O dia selecionado mora na URL, e não em cada tela
// ============================================================================
// As três telas de futebol têm seletor de dia, e cada uma guardava o dia do seu
// jeito: a agenda já usava `?dia=`, a home e as oportunidades usavam estado
// local. O efeito aparecia na navegação — quem estava vendo amanhã na home e
// clicava em "Ver todas" caía na lista de HOJE, porque o destino nascia com o
// estado zerado e voltava ao padrão.
//
// Com o dia na URL o link carrega o contexto, o F5 não perde a escolha, e o
// endereço vira compartilhável. É também o que a agenda já fazia certo.
// ============================================================================

/** `2026-09-11`. Formato do seletor e da chave do dia BRT no resto do módulo. */
export const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * O nome do parâmetro, num lugar só — as três telas precisam concordar.
 *
 * A agenda (`FutebolJogos`) consome esta constante e a regex, mas continua com
 * o SETTER próprio, e isso é de propósito: ao trocar de dia ela descarta o
 * `?jogo=`, porque o jogo selecionado pertencia ao dia anterior. O `trocar`
 * daqui preserva os outros parâmetros, que é o certo para as outras duas telas
 * e seria errado lá.
 */
export const PARAM_DO_DIA = 'dia';

/**
 * Monta o destino preservando o dia. `null` ou dia inválido caem na rota limpa.
 *
 * Usa `URLSearchParams` em vez de concatenar: hoje os dois destinos são rotas
 * secas, mas uma rota que já tivesse query viraria uma URL com dois pontos de
 * interrogação, quebrada e difícil de enxergar.
 */
export function comDia(rota: string, dia: string | null | undefined): string {
  if (!dia || !DIA_RE.test(dia)) return rota;
  const [caminho, query] = rota.split('?');
  const params = new URLSearchParams(query);
  params.set(PARAM_DO_DIA, dia);
  return `${caminho}?${params.toString()}`;
}

/**
 * O dia escolhido, lido da URL, e como trocá-lo.
 *
 * Devolve `null` quando não há dia válido no endereço — quem chama decide o
 * padrão, porque ele não é o mesmo nas três telas: a home cai em hoje, a lista
 * de oportunidades cai no primeiro dia com linha, e a agenda cai em hoje pelo
 * `brtToday()` dela.
 *
 * A troca usa `replace`: clicar cinco dias seguidos não deve encher o histórico
 * de cinco passos, e o botão voltar tem de sair da tela, não desfazer cliques
 * de seta.
 *
 * Devolve tupla, e não objeto como os outros hooks daqui, porque as duas telas
 * substituíram exatamente um `useState<string | null>(null)` por esta chamada —
 * a mesma forma manteve o diff numa linha por tela.
 */
export function useDiaNaUrl(): [string | null, (dia: string) => void] {
  const [params, setParams] = useSearchParams();
  const bruto = params.get(PARAM_DO_DIA);
  const dia = DIA_RE.test(bruto ?? '') ? bruto : null;

  const trocar = useCallback(
    (novo: string) => {
      const proximos = new URLSearchParams(params);
      proximos.set(PARAM_DO_DIA, novo);
      setParams(proximos, { replace: true });
    },
    [params, setParams],
  );

  return [dia, trocar];
}
