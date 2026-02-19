/**
 * Configuração dos jogadores gratuitos disponíveis no plano freemium
 * 
 * Jogadores listados aqui podem ser acessados por usuários não assinantes.
 * Para adicionar/remover jogadores, basta atualizar esta lista.
 */

export const FREE_PLAYERS = [
  'Nikola Jokic',
  'Victor Wembanyama',
] as const;

/**
 * Verifica se um jogador está na lista de jogadores gratuitos
 */
export function isFreePlayer(playerName: string): boolean {
  return FREE_PLAYERS.some(
    (freePlayer) => playerName.toLowerCase() === freePlayer.toLowerCase()
  );
}

/**
 * Retorna a lista de nomes de jogadores gratuitos
 */
export function getFreePlayerNames(): readonly string[] {
  return FREE_PLAYERS;
}
