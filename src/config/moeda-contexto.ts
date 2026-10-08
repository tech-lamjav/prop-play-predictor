import { createContext } from 'react';

/**
 * O contexto da moeda, num arquivo só dele.
 *
 * Separado do provider para o provider exportar só componente — senão a
 * recarga rápida do Vite deixa de funcionar naquele arquivo — e para o hook de
 * assinatura poder morar em `hooks/`, com os outros.
 */
export interface ContextoDaMoeda {
  moeda: string;
  trocarMoeda: (moeda: string) => void;
}

export const MoedaContexto = createContext<ContextoDaMoeda | null>(null);
