import { margemDaSaida } from '@/utils/futebol-settlement';
import type { LinhaPublicada } from './placar-agregacao';

// ============================================================================
// placar-margem.ts — o quão longe a aposta ficou de bater
// ============================================================================
// O drill mostrava "Red" e o lucro, e faltava a pergunta que vem em seguida:
// faltou um gol ou faltou quatro? A primeira é metodologia no caminho certo com
// azar em cima; a segunda é leitura errada do jogo.
//
// A conta é a da própria liquidação (o saldo `d`), e por isso ela mora lá. Aqui
// fica só a tradução para frase.
// ============================================================================

/** O placar final, do jeito que se lê: mandante primeiro. */
export function placarFinal(linha: LinhaPublicada): string | null {
  if (linha.goals_home == null || linha.goals_away == null) return null;
  return `${linha.goals_home}–${linha.goals_away}`;
}

const comVirgula = (n: number) => {
  const abs = Math.abs(n);
  const texto = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/0$/, '');
  return texto.replace('.', ',');
};

/**
 * A distância até a linha, em palavras.
 *
 * `null` quando o mercado não tem linha — em Resultado, Ambos marcam e Dupla
 * chance o placar já é a resposta inteira, e inventar uma margem ali seria
 * número sem significado.
 *
 * "Na linha" é o caso da anulada: o saldo deu exatamente a linha.
 */
export function margemEmPalavras(linha: LinhaPublicada): string | null {
  const d = margemDaSaida(
    { market: linha.market, outcome: linha.outcome, line_value: linha.line_value },
    linha.goals_home,
    linha.goals_away,
  );
  if (d == null) return null;
  if (Math.abs(d) < 0.001) return 'na linha';
  return d > 0 ? `sobrou ${comVirgula(d)}` : `faltou ${comVirgula(d)}`;
}
