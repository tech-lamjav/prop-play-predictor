import { MOEDA_PADRAO, ehMoedaConhecida, localeDaMoeda, moedaDoPais } from '@/config/moedas';
import { paisDoFuso } from '@/config/pais-do-fuso';

/**
 * A moeda em que o produto está escrevendo dinheiro AGORA.
 *
 * Mora ao lado do idioma ativo e funciona igual: estado de módulo, empurrado de
 * fora, para o formatador continuar puro e testável sem navegador. A razão de
 * não ser parâmetro em cada chamada é a mesma — a régua é do PRODUTO, e são
 * dezenas de chamadas.
 *
 * ⚠️ NÃO É CONVERSÃO. Trocar a moeda troca o símbolo e a pontuação, nunca o
 * número: 1.500 continua 1.500. Ver o aviso em `src/config/moedas.ts`.
 */

const CHAVE_GUARDADA = 'smartbetting.moeda';

let atual: string = MOEDA_PADRAO;

export function definirMoedaAtiva(moeda: string): void {
  atual = ehMoedaConhecida(moeda) ? moeda : MOEDA_PADRAO;
}

export function moedaAtiva(): string {
  return atual;
}

/** O idioma em que a moeda ativa se escreve. */
export function localeDaMoedaAtiva(): string {
  return localeDaMoeda(atual);
}

/** A escolha explícita de quem já trocou, se houver. */
export function moedaGuardada(): string | null {
  try {
    const guardada = localStorage.getItem(CHAVE_GUARDADA);
    return ehMoedaConhecida(guardada) ? guardada : null;
  } catch {
    // Navegador com armazenamento bloqueado. Cai no padrão, como quem nunca
    // escolheu.
    return null;
  }
}

export function guardarMoeda(moeda: string): void {
  try {
    localStorage.setItem(CHAVE_GUARDADA, moeda);
  } catch {
    // Não poder lembrar a escolha não impede de aplicá-la nesta sessão.
  }
}

/**
 * Qual moeda mostrar, em ordem de quem manda mais.
 *
 * 1. a escolha explícita da pessoa, que vence tudo;
 * 2. o país que ela informou no cadastro — vem do metadado da conta, e é por
 *    isso que isto não precisou de coluna nova no banco;
 * 3. o país do fuso do navegador, para quem criou conta antes de o campo de
 *    país existir;
 * 4. o real, que é de onde vem a base de hoje.
 */
export function moedaEscolhida(paisDoCadastro?: string | null): string {
  const explicita = moedaGuardada();
  if (explicita) return explicita;
  if (paisDoCadastro) return moedaDoPais(paisDoCadastro);
  return moedaDoPais(paisDoFuso());
}
