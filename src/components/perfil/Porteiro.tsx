import React from 'react';
import { usePorteiro } from '@/hooks/use-porteiro';

/**
 * O sentinela que pergunta ao porteiro de onde a pessoa está acessando.
 *
 * Spec na issue #548, ticket #550.
 *
 * Monta uma vez no App, ao lado dos outros sentinelas, e não desenha nada.
 * Nesta fatia ele só faz a pergunta — quem obedece a resposta é a fatia
 * seguinte (#551). Separar assim é de propósito: dá para conferir que o
 * registro de presença nasce certo, com o produto funcionando igual para todo
 * mundo, antes de qualquer pessoa correr risco de ser barrada.
 *
 * A pergunta sai uma vez por carregamento de página, e não uma por tela: o
 * cache mora no hook.
 */
export const Porteiro: React.FC = () => {
  usePorteiro();
  return null;
};
