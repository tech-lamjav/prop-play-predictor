/**
 * Impressão de oportunidade — "foi exibida", e não "foi renderizada".
 *
 * A lista monta dezenas de linhas de uma vez, e a maioria nasce muito abaixo da
 * dobra. Contar render como impressão infla o denominador do funil e faz a taxa
 * de abertura despencar sem nada ter piorado — o número muda quando alguém
 * mexe na paginação, não quando o produto muda.
 *
 * A régua: metade do cartão visível por cerca de um segundo. Os dois lados
 * importam. Só área não basta, porque rolagem rápida atravessa a lista inteira
 * e marcaria tudo; só tempo não basta, porque um cartão parado logo abaixo da
 * dobra ficaria "visível" para sempre.
 *
 * Não existia nenhum `IntersectionObserver` no repositório antes disto — daí o
 * hook nascer aqui, com a mesma disciplina do `useScrollDepthPixel`: cada marco
 * dispara no máximo uma vez, e a memória do que já disparou vive em `ref`.
 */

import { useCallback, useEffect, useRef } from 'react';

/** Metade do cartão. */
export const FRACAO_VISIVEL = 0.5;
/** Cerca de um segundo parado na tela. */
export const PERMANENCIA_MS = 1000;

/**
 * O que já foi impresso, por carregamento de página.
 *
 * Vive no módulo, e não no componente, porque a regra é "uma vez por
 * `opportunity_id` em CADA carregamento da página" — e os cartões remontam
 * sozinhos toda vez que alguém mexe num filtro. Com a memória dentro do cartão,
 * trocar a faixa e voltar reemitiria a impressão da mesma oportunidade.
 *
 * Quem zera é a página, no seu próprio `useEffect` de montagem.
 */
const jaImpressas = new Set<string>();

/** Zera a memória. A página chama isto uma vez, ao montar. */
export function reiniciarImpressoes(): void {
  jaImpressas.clear();
}

/** Só para teste: diz se uma chave já foi contada. */
export function jaFoiImpressa(chave: string): boolean {
  return jaImpressas.has(chave);
}

export type OpcoesDeImpressao = {
  /** `opportunity_id` — a chave da deduplicação. */
  chave: string;
  /**
   * Falso enquanto não há o que medir (lista carregando, cartão bloqueado).
   *
   * Opcional, e por padrão ligado: quem não passa `aoAparecer` já está dizendo
   * que não quer medir, e exigir os dois obrigava todo chamador a escrever
   * `{ ativo: !!aoAparecer, aoAparecer: aoAparecer ?? (() => {}) }` — uma
   * cerimônia que apareceu três vezes idêntica e denunciava a API torta.
   */
  ativo?: boolean;
  /** Chamado uma única vez, quando a régua fecha. Sem ele, não se mede nada. */
  aoAparecer?: () => void;
};

/**
 * Devolve um `ref` para pendurar no elemento do cartão.
 *
 * `ref` de função e não `useRef`: o elemento troca quando a lista reordena, e
 * a função é chamada nas duas pontas (com o nó novo, e com `null` no antigo),
 * o que dá o lugar exato para trocar o observador sem vazar o anterior.
 */
export function useImpressaoDeOportunidade({
  chave,
  ativo = true,
  aoAparecer,
}: OpcoesDeImpressao) {
  // Medir exige as duas coisas: alguém interessado no resultado e permissão
  // para medir. Derivar aqui é o que dispensa a cerimônia no chamador.
  const ligado = ativo && !!aoAparecer;
  // O callback mais recente, sem entrar nas dependências do efeito: ele nasce
  // novo a cada render do pai, e se estivesse nas dependências o observador
  // seria desmontado e remontado a cada render — perdendo o cronômetro no meio.
  const aoAparecerRef = useRef<(() => void) | undefined>(aoAparecer);
  useEffect(() => {
    aoAparecerRef.current = aoAparecer;
  }, [aoAparecer]);

  const observadorRef = useRef<IntersectionObserver | null>(null);
  const timerRef = useRef<number | null>(null);

  const limpar = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    observadorRef.current?.disconnect();
    observadorRef.current = null;
  }, []);

  useEffect(() => limpar, [limpar]);

  return useCallback(
    (el: HTMLElement | null) => {
      limpar();
      if (!el || !ligado || !chave) return;
      if (jaImpressas.has(chave)) return;
      // jsdom e navegadores antigos não têm o observador. Sem ele não há como
      // saber se apareceu, e o certo é não contar — inventar a impressão seria
      // exatamente o defeito que este hook existe para evitar.
      if (typeof IntersectionObserver === 'undefined') return;

      const obs = new IntersectionObserver(
        (entradas) => {
          const e = entradas[0];
          if (!e) return;

          // ── Metade do CARTÃO, ou metade da TELA ──────────────────────────
          //
          // A proporção do observador é sempre relativa ao próprio elemento, e
          // isso cria um buraco: um cartão MAIS ALTO que a janela nunca atinge
          // 0,5 de si mesmo, por mais que ocupe a tela inteira. No celular o
          // `OppMobileCard` chega perto disso, e o efeito seria impressão que
          // NUNCA dispara — o pior tipo de falha de medição, porque o número
          // simplesmente não existe e ninguém desconfia.
          //
          // Então a régua tem duas portas: metade do cartão visível, OU metade
          // da altura da janela preenchida por ele. Quem é pequeno passa pela
          // primeira; quem é grande, pela segunda.
          const alturaVisivel = e.intersectionRect?.height ?? 0;
          const alturaDaJanela = typeof window !== 'undefined' ? window.innerHeight : 0;
          const cobreATela =
            alturaDaJanela > 0 && alturaVisivel >= alturaDaJanela * FRACAO_VISIVEL;
          const apareceu =
            e.isIntersecting && (e.intersectionRatio >= FRACAO_VISIVEL || cobreATela);

          if (apareceu) {
            if (timerRef.current != null) return;
            timerRef.current = window.setTimeout(() => {
              timerRef.current = null;
              // Reconfere na hora de contar: dois cartões da mesma oportunidade
              // podem existir ao mesmo tempo (a lista tem versão de desktop e
              // de celular no DOM), e ambos venceriam o cronômetro.
              if (jaImpressas.has(chave)) return;
              jaImpressas.add(chave);
              aoAparecerRef.current?.();
              limpar();
            }, PERMANENCIA_MS);
          } else if (timerRef.current != null) {
            // Saiu antes de completar: o cronômetro recomeça do zero na próxima
            // vez. Passagem rápida não vira impressão.
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        },
        // Vários limiares, e não só 0,5: o observador só REPORTA quando cruza um
        // limiar declarado. Com um limiar único, o cartão alto — que nunca
        // chega a 0,5 de si mesmo — não geraria notificação nenhuma, e a porta
        // da "metade da tela" acima nunca chegaria a ser avaliada.
        { threshold: [0, 0.25, FRACAO_VISIVEL, 0.75, 1] },
      );
      obs.observe(el);
      observadorRef.current = obs;
    },
    [chave, ligado, limpar],
  );
}
