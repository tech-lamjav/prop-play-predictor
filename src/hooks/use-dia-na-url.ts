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
const DIA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** O nome do parâmetro, num lugar só — as três telas precisam concordar. */
export const PARAM_DO_DIA = 'dia';

/** Monta o destino preservando o dia. `null` cai na rota limpa. */
export function comDia(rota: string, dia: string | null | undefined): string {
  return dia && DIA_RE.test(dia) ? `${rota}?${PARAM_DO_DIA}=${dia}` : rota;
}

/**
 * O dia escolhido, lido da URL, e como trocá-lo.
 *
 * Devolve `null` quando não há dia válido no endereço — quem chama decide o
 * padrão, porque ele não é o mesmo nas três telas (a home cai em hoje, a lista
 * de oportunidades cai no primeiro dia com linha).
 *
 * A troca usa `replace`: clicar cinco dias seguidos não deve encher o histórico
 * de cinco passos, e o botão voltar tem de sair da tela, não desfazer cliques
 * de seta.
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
