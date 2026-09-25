import { useSyncExternalStore } from 'react';

/**
 * Um sinal só, compartilhado: a pesquisa de perfil está na frente?
 *
 * Spec na issue #522, ticket #523.
 *
 * Existe porque duas partes distantes da árvore precisam da mesma resposta: o
 * sentinela que abre o pop-up, que é vizinho das rotas, e o hook de tour, que é
 * chamado de dentro de dezessete telas. Contexto não serviria sem envolver as
 * rotas inteiras num provedor novo; um sinal de módulo atravessa a árvore sem
 * pedir nada a ela.
 *
 * ⚠️ O padrão é **falso**, e isso é o que mantém as dezessete telas intactas:
 * quem não souber deste sinal — inclusive todo teste que já existia — continua
 * armando a tour exatamente como antes.
 */

let pendente = false;
const ouvintes = new Set<() => void>();

const ler = () => pendente;

function inscrever(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Liga e desliga o sinal. Quem chama é o sentinela da pesquisa. */
export function marcarPesquisaPendente(valor: boolean): void {
  if (pendente === valor) return;
  pendente = valor;
  ouvintes.forEach((ouvinte) => ouvinte());
}

export function usePesquisaPendente(): boolean {
  return useSyncExternalStore(inscrever, ler, ler);
}
