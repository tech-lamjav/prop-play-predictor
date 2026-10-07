import { useContext } from 'react';
import { MoedaContexto, type ContextoDaMoeda } from '@/config/moeda-contexto';
import { definirMoedaAtiva, moedaAtiva } from '@/utils/moeda-ativa';
import { simboloDaMoeda } from '@/config/moedas';

/**
 * A moeda em que a pessoa lê o próprio dinheiro, ASSINADA.
 *
 * ⚠️ CHAMAR ISTO É O QUE FAZ A TELA REPINTAR quando a pessoa troca de moeda.
 * `fmtDinheiroDaPessoa` lê estado de módulo, que o React não enxerga; quem
 * desenha dinheiro da pessoa chama este hook, e a troca de moeda vira mudança
 * de contexto — que repinta só quem assinou.
 *
 * A primeira versão remontava a árvore inteira de rotas a cada troca, e isso
 * fechava o próprio modal em que a moeda é escolhida, perdendo o que a pessoa
 * tinha digitado.
 */
export function useMoeda(): ContextoDaMoeda {
  const ctx = useContext(MoedaContexto);
  if (!ctx) {
    // Fora do provider — teste de componente isolado, por exemplo. Ler a moeda
    // continua funcionando; trocar não tem a quem avisar.
    return { moeda: moedaAtiva(), trocarMoeda: definirMoedaAtiva };
  }
  return ctx;
}

/**
 * O símbolo da moeda da pessoa — "R$", "S/" —, ASSINADO.
 *
 * Para o prefixo de campo de valor e o seletor "R$ / u", que eram "R$" escrito à
 * mão e ignoravam a moeda escolhida.
 */
export function useSimboloDaMoeda(): string {
  return simboloDaMoeda(useMoeda().moeda);
}
